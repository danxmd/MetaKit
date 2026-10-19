import { describe, expect, it } from 'vitest';
import {
  createKitStore,
  effectiveAttributes,
  validateKit,
  type ClassId,
  type Kit,
  type ModelTypeId,
} from '@metakit-app/core';
import agentPipeline from '../../../../kits/agent-pipeline/kit.json';
import {
  attributeKeys,
  emptyDraft,
  keyFromLabel,
  stepProblems,
  summary,
  withKind,
  withLabel,
  wizardCommands,
  type WizardDraft,
} from './concept-wizard';

const kit = () => structuredClone(agentPipeline) as unknown as Kit;
const classId = (k: Kit, key: string) =>
  Object.values(k.classes).find((c) => c.key === key)!.id;
const pipeline = 'mt_pipeline' as ModelTypeId;

function apply(k: Kit, draft: WizardDraft) {
  const store = createKitStore(k);
  const { commands, id } = wizardCommands(k, draft);
  store.execute({ type: 'batch', commands });
  return { store, id };
}

describe('keys from names', () => {
  it('makes a PascalCase key that nothing else uses', () => {
    expect(keyFromLabel('Assigned to', [])).toBe('AssignedTo');
    expect(keyFromLabel('risk owner', ['RiskOwner'])).toBe('RiskOwner2');
    expect(keyFromLabel('9 lives', [])).toBe('_9Lives');
    expect(keyFromLabel('Café menu', [])).toBe('CafeMenu');
    expect(keyFromLabel('!!!', [])).toBe('Item');
  });

  it('follows the name until the key is changed by hand', () => {
    const k = kit();
    let d = withLabel(k, emptyDraft(k, 'class'), 'Risk');
    expect(d.key).toBe('Risk');
    d = withLabel(k, { ...d, key: 'Hazard', keyEdited: true }, 'Big risk');
    expect(d.key).toBe('Hazard');
    // "Task" is taken in this Kit.
    expect(withLabel(k, emptyDraft(k, 'class'), 'Task').key).toBe('Task2');
  });
});

describe('the steps', () => {
  it('asks for a name and a free key', () => {
    const k = kit();
    const d = emptyDraft(k, 'class');
    expect(stepProblems(k, d, 'basics')).toEqual(['Give the class a name.']);
    const taken = { ...withLabel(k, d, 'X'), key: 'Task', keyEdited: true };
    expect(stepProblems(k, taken, 'basics')[0]).toContain(
      'already has the key "Task"',
    );
    const bad = { ...taken, key: '1st' };
    expect(stepProblems(k, bad, 'basics')[0]).toContain('starts with a letter');
    expect(stepProblems(k, withLabel(k, d, 'Risk'), 'basics')).toEqual([]);
  });

  it('a relation needs a start and an end', () => {
    const k = kit();
    const d = withLabel(k, emptyDraft(k, 'relation'), 'Reviews');
    expect(stepProblems(k, d, 'connects')).toHaveLength(2);
    const task = classId(k, 'Task');
    expect(
      stepProblems(k, { ...d, from: [task], to: [task] }, 'connects'),
    ).toEqual([]);
  });

  it('checks attribute names, choice options and inherited keys', () => {
    const k = kit();
    let d = withLabel(k, emptyDraft(k, 'class'), 'Reviewer');
    d = {
      ...d,
      attributes: [
        ...d.attributes,
        { label: '', type: 'text', options: '', required: false },
        { label: 'Level', type: 'choice', options: 'Junior', required: false },
      ],
    };
    const problems = stepProblems(k, d, 'attributes');
    expect(problems).toContain('Attribute 2 has no name.');
    expect(problems.some((p) => p.includes('at least two options'))).toBe(true);
    // Human extends Actor, which has a Name.
    const child = {
      ...withLabel(k, emptyDraft(k, 'class'), 'Lead'),
      parent: classId(k, 'Actor'),
    };
    expect(stepProblems(k, child, 'attributes')[0]).toContain(
      'already inherited from Actor',
    );
    expect(stepProblems(k, { ...child, attributes: [] }, 'attributes')).toEqual(
      [],
    );
  });

  it('the last step repeats what earlier steps still need', () => {
    const k = kit();
    const d = withLabel(k, emptyDraft(k, 'relation'), 'Reviews');
    expect(stepProblems(k, d, 'where')).toHaveLength(2);
  });
});

describe('what it makes', () => {
  it('a class with its look, attributes and model type, valid, in one undo step', () => {
    const k = kit();
    const d: WizardDraft = {
      ...withLabel(k, emptyDraft(k, 'class', { modelType: pipeline }), 'Risk'),
      help: 'Something that could go wrong.',
      base: 'hexagon',
      fill: '#ffc9c9',
      attributes: [
        { label: 'Name', type: 'text', options: '', required: true },
        { label: 'Likelihood', type: 'integer', options: '', required: false },
        { label: 'Notes', type: 'long', options: '', required: false },
        {
          label: 'Status',
          type: 'choice',
          options: 'Open\nClosed\n',
          required: false,
        },
      ],
    };
    expect(stepProblems(k, d, 'where')).toEqual([]);
    const { store, id } = apply(k, d);
    const made = store.state.classes[id as ClassId]!;
    expect(made.key).toBe('Risk');
    expect(made.help).toEqual({ en: 'Something that could go wrong.' });
    expect(made.attributes.map((a) => [a.key, a.type])).toEqual([
      ['Name', 'text'],
      ['Likelihood', 'integer'],
      ['Notes', 'text'],
      ['Status', 'choice'],
    ]);
    expect(made.attributes[3]).toMatchObject({ options: ['Open', 'Closed'] });
    const shape = store.state.shapes[made.shape!]!;
    expect(shape.kind).toBe('node');
    expect(JSON.stringify(shape)).toContain('#ffc9c9');
    expect(store.state.modelTypes[pipeline]!.classes).toContain(id);
    expect(validateKit(store.state)).toEqual([]);
    expect(store.undo()).toBe(true);
    expect(store.state.classes[id as ClassId]).toBeUndefined();
    expect(store.state.modelTypes[pipeline]!.classes).not.toContain(id);
  });

  it('a child class inherits, and an abstract class is not added to model types', () => {
    const k = kit();
    const actor = classId(k, 'Actor');
    const d = {
      ...withLabel(k, emptyDraft(k, 'class'), 'Robot'),
      parent: actor,
      abstract: true,
      attributes: [],
    };
    const { store, id } = apply(k, d);
    const keys = effectiveAttributes(store.state, id as ClassId).map(
      (a) => a.key,
    );
    expect(keys).toContain('Name');
    expect(
      Object.values(store.state.modelTypes).some((t) =>
        t.classes.includes(id as ClassId),
      ),
    ).toBe(false);
    expect(validateKit(store.state)).toEqual([]);
  });

  it('a relation class with its ends, line and model types', () => {
    const k = kit();
    const task = classId(k, 'Task');
    const artifact = classId(k, 'Artifact');
    const d = {
      ...withLabel(k, emptyDraft(k, 'relation'), 'Reviews'),
      from: [task],
      to: [artifact],
      lineStyle: 'dashed' as const,
    };
    expect(stepProblems(k, d, 'where')).toEqual([]);
    const { store, id } = apply(k, d);
    const made = store.state.relations[id as never]!;
    expect(made).toMatchObject({
      key: 'Reviews',
      from: [task],
      to: [artifact],
    });
    for (const t of Object.values(store.state.modelTypes))
      expect(t.relations).toContain(id);
    expect(validateKit(store.state)).toEqual([]);
  });

  it('switching kind keeps the name and the description', () => {
    const k = kit();
    const d = {
      ...withLabel(k, emptyDraft(k, 'class'), 'Approval'),
      help: 'A yes or no.',
    };
    const r = withKind(k, d, 'relation');
    expect(r).toMatchObject({
      kind: 'relation',
      label: 'Approval',
      key: 'Approval',
      help: 'A yes or no.',
    });
    expect(attributeKeys(r)).toEqual([]);
  });

  it('says in plain words what will be made', () => {
    const k = kit();
    const task = classId(k, 'Task');
    const lines = summary(k, {
      ...withLabel(
        k,
        emptyDraft(k, 'relation', { modelType: pipeline }),
        'Reviews',
      ),
      from: [task],
      to: [task],
    });
    expect(lines).toEqual([
      'A relation class "Reviews" (key Reviews).',
      'It connects Task to Task.',
      'No attributes.',
      'Model types that allow it: Pipeline.',
    ]);
  });
});
