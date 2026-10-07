import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  validateToolLibrary,
  type ElementId,
  type Model,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  clone,
  emptySampleModel,
  SAMPLE,
  sampleTool,
} from '@metakit-app/core/testing';
import {
  attachRules,
  createBehaviour,
  silentHost,
} from '@metakit-app/behaviour';
import {
  ACTION_TYPES,
  attributesFor,
  canCancel,
  classesFor,
  eventGroups,
  filtersFor,
  formulaProblem,
  RuleEditorModel,
} from './rule-editor-model';

function tool(): ToolLibrary {
  const t = clone(sampleTool());
  t.classes[SAMPLE.task]!.attributes.push(
    { id: 'att_status', key: 'Status', type: 'text' },
    { id: 'att_owner', key: 'Owner', type: 'text' },
  );
  return t;
}

/** The plan's rule, built only through the model. */
function buildPlanRule(t: ToolLibrary): RuleEditorModel {
  const m = new RuleEditorModel(t);
  m.setLabel('High-priority tasks need an owner');
  m.setEvent('attribute.changed');
  m.setClass(SAMPLE.task as never);
  m.setAttribute('Priority');
  m.setCondition("Priority == 'High' && Owner == null");
  const a = m.addAction('setAttribute')!;
  m.updateAction(a, { attribute: 'Status', value: 'Needs owner' });
  const b = m.addAction('message')!;
  m.updateAction(b, {
    kind: 'warning',
    text: "= 'Task \"' + Name + '\" is high priority but has no owner.'",
  });
  return m;
}

describe('eventGroups', () => {
  it('offers every event once, grouped, with plain labels', () => {
    const groups = eventGroups();
    expect(groups.map((g) => g.label)).toEqual([
      'Object',
      'Connector',
      'Attribute',
      'Table',
      'Model',
      'View',
      'App',
      'Selection',
      'On demand',
    ]);
    const all = groups.flatMap((g) => g.events.map((e) => e.event));
    expect(all).toHaveLength(25);
    expect(new Set(all).size).toBe(25);
    for (const g of groups)
      for (const e of g.events) expect(e.label).not.toMatch(/[._]/);
  });

  it('knows which events can cancel and which pickers they use', () => {
    expect(canCancel('object.deleting')).toBe(true);
    expect(canCancel('object.deleted')).toBe(false);
    expect(filtersFor('attribute.changed')).toEqual({
      class: true,
      attribute: true,
      relation: false,
    });
    expect(filtersFor('connector.created')).toEqual({
      class: false,
      attribute: false,
      relation: true,
    });
    expect(filtersFor('app.started')).toEqual({
      class: false,
      attribute: false,
      relation: false,
    });
  });
});

describe('pickers', () => {
  it('lists classes and the attribute keys of a class with inherited ones', () => {
    const t = tool();
    expect(classesFor(t).map((c) => c.key)).toContain('Task');
    const keys = attributesFor(t, SAMPLE.task as never);
    expect(keys).toEqual(
      expect.arrayContaining(['Name', 'Priority', 'Status']),
    );
    expect(attributesFor(t, SAMPLE.task as never, true)).not.toContain('Cost');
    expect(attributesFor(t, undefined)).toContain('GatewayKind');
  });
});

describe('formulaProblem', () => {
  it('reports a syntax error in plain words and ignores plain text', () => {
    expect(formulaProblem('hello')).toBeNull();
    expect(formulaProblem("= Priority == 'High'")).toBeNull();
    expect(formulaProblem('= 1 +')).toMatch(/\(at character \d+/);
    expect(formulaProblem('=')).toMatch(/empty/);
  });
});

describe('RuleEditorModel', () => {
  it('starts as a valid rule that reacts to attribute changes', () => {
    const m = new RuleEditorModel(tool());
    expect(m.toRule()).toMatchObject({
      label: 'New rule',
      when: { event: 'attribute.changed' },
      then: [],
    });
    expect(m.id).toMatch(/^rule_/);
    expect(RuleEditorModel.newRuleId()).not.toBe(RuleEditorModel.newRuleId());
    expect(m.valid).toBe(true);
    expect(m.messages().map((x) => x.level)).toEqual(['hint']);
  });

  it('builds the plan rule, valid for the tool library', () => {
    const t = tool();
    const m = buildPlanRule(t);
    expect(m.messages()).toEqual([]);
    expect(m.toRule()).toEqual({
      id: m.id,
      label: 'High-priority tasks need an owner',
      when: {
        event: 'attribute.changed',
        class: SAMPLE.task,
        attribute: 'Priority',
      },
      if: "= Priority == 'High' && Owner == null",
      then: [
        { action: 'setAttribute', attribute: 'Status', value: 'Needs owner' },
        {
          action: 'message',
          kind: 'warning',
          text: "= 'Task \"' + Name + '\" is high priority but has no owner.'",
        },
      ],
    });
    t.rules[m.id] = m.toRule();
    expect(validateToolLibrary(t)).toEqual([]);
  });

  it('runs the rule it built in the engine', () => {
    const t = tool();
    const m = buildPlanRule(t);
    t.rules[m.id] = m.toRule();
    const store = createModelStore(emptySampleModel(), { tool: t });
    const seen: string[] = [];
    const b = createBehaviour({
      store,
      tool: () => t,
      host: silentHost({ message: (k, x) => void seen.push(`${k}: ${x}`) }),
    });
    attachRules(b, { store, tool: () => t });
    const id = (
      store.execute({
        type: 'createElement',
        class: SAMPLE.task as never,
        x: 0,
        y: 0,
        attrs: { [SAMPLE.attName]: 'Pack' },
      }) as unknown as { value: ElementId }
    ).value;
    store.execute({
      type: 'setAttribute',
      target: id,
      attr: SAMPLE.attPriority as never,
      value: 'High',
    });
    expect((store.state as Model).elements[id]!.attrs['att_status']).toBe(
      'Needs owner',
    );
    expect(seen).toEqual([
      'warning: Task "Pack" is high priority but has no owner.',
    ]);
  });

  it('adds the = to a condition and removes an empty one', () => {
    const m = new RuleEditorModel(tool());
    m.setCondition('Priority == 1');
    expect(m.toRule().if).toBe('= Priority == 1');
    m.setCondition('   ');
    expect(m.toRule()).not.toHaveProperty('if');
  });

  it('drops filters that do not fit a new event, and the command entry', () => {
    const m = new RuleEditorModel(tool());
    m.setClass(SAMPLE.task as never);
    m.setAttribute('Priority');
    m.setEvent('object.created');
    expect(m.toRule().when).toEqual({
      event: 'object.created',
      class: SAMPLE.task,
    });
    m.setEvent('app.started');
    expect(m.toRule().when).toEqual({ event: 'app.started' });
    m.setEvent('command');
    expect(m.toRule().command).toEqual({
      label: 'New rule',
      place: 'context',
    });
    m.setCommand('Mark', 'toolbar');
    expect(m.toRule().command).toEqual({ label: 'Mark', place: 'toolbar' });
    m.setEvent('object.created');
    expect(m.toRule()).not.toHaveProperty('command');
  });

  it('forgets an attribute the new class does not have', () => {
    const m = new RuleEditorModel(tool());
    m.setAttribute('Priority');
    m.setClass(SAMPLE.gateway as never);
    expect(m.toRule().when).not.toHaveProperty('attribute');
  });

  it('adds every action type with a blank form', () => {
    for (const type of ACTION_TYPES) {
      const m = new RuleEditorModel(tool());
      expect(m.addAction(type)).toEqual([0]);
      expect(m.toRule().then[0]!.action).toBe(type);
    }
    const m = new RuleEditorModel(tool());
    m.addAction('setAttribute');
    expect(m.messages().find((x) => x.level === 'error')).toMatchObject({
      where: 'Action 1',
    });
  });

  it('reorders, edits and removes actions', () => {
    const m = new RuleEditorModel(tool());
    m.addAction('delete');
    m.addAction('message');
    m.moveAction([1], -1);
    expect(m.toRule().then.map((a) => a.action)).toEqual(['message', 'delete']);
    m.moveAction([0], -1);
    m.moveAction([1], 1);
    expect(m.toRule().then.map((a) => a.action)).toEqual(['message', 'delete']);
    m.updateAction([0], { text: 'Hi', kind: 'error' });
    expect(m.actionAt([0])).toMatchObject({ text: 'Hi', kind: 'error' });
    m.updateAction([1], { target: '= Owner' });
    m.updateAction([1], { target: undefined });
    expect(m.actionAt([1])).toEqual({ action: 'delete' });
    m.changeActionType([0], 'cancel');
    expect(m.actionAt([0])).toEqual({ action: 'cancel', reason: '' });
    m.removeAction([0]);
    expect(m.toRule().then).toEqual([{ action: 'delete' }]);
  });

  it('edits nested branches of a question by path', () => {
    const m = new RuleEditorModel(tool());
    m.addAction('ask');
    m.updateAction([0], { text: 'Sure?' });
    expect(m.addAction('delete', [0, 'then'])).toEqual([0, 'then', 0]);
    expect(m.addAction('cancel', [0, 'else'])).toEqual([0, 'else', 0]);
    m.addAction('message', [0, 'else']);
    m.updateAction([0, 'else', 1], { text: 'Kept' });
    m.moveAction([0, 'else', 1], -1);
    expect(m.toRule().then[0]).toEqual({
      action: 'ask',
      text: 'Sure?',
      then: [{ action: 'delete' }],
      else: [
        { action: 'message', kind: 'info', text: 'Kept' },
        { action: 'cancel', reason: '' },
      ],
    });
    m.removeAction([0, 'else', 0]);
    m.addAction('ask', [0, 'then']);
    expect(m.addAction('delete', [0, 'then', 1, 'then'])).toEqual([
      0,
      'then',
      1,
      'then',
      0,
    ]);
    expect(m.addAction('delete', [3, 'then'])).toBeNull();
  });

  it('explains problems in the form instead of the file paths', () => {
    const m = buildPlanRule(tool());
    m.setCondition('Priority ==');
    m.updateAction([1], { text: '= 1 +' });
    m.setLabel('');
    const msgs = m.messages();
    expect(msgs.map((x) => x.where)).toEqual(
      expect.arrayContaining(['If', 'Action 2', 'Name']),
    );
    expect(m.valid).toBe(false);
    for (const x of msgs) expect(x.text).not.toMatch(/rules\./);
  });

  it('needs a command name for a command rule, and hints about useless cancel', () => {
    const m = new RuleEditorModel(tool());
    m.setEvent('command');
    m.setCommand('  ', 'model');
    expect(m.messages().filter((x) => x.level === 'error')).toEqual([
      {
        level: 'error',
        where: 'Command',
        text: 'The command label cannot be empty.',
      },
    ]);
    const n = new RuleEditorModel(tool());
    n.setEvent('object.created');
    n.addAction('cancel');
    expect(n.messages().some((x) => x.level === 'hint')).toBe(true);
    n.setEvent('object.creating');
    expect(n.messages().some((x) => x.level === 'hint')).toBe(false);
  });

  it('turns typed text into the type of the attribute', () => {
    const m = new RuleEditorModel(tool());
    m.setClass(SAMPLE.task as never);
    expect(m.valueFromText('Effort', '5')).toBe(5);
    expect(m.valueFromText('Effort', 'abc')).toBe('abc');
    expect(m.valueFromText('Name', '5')).toBe('5');
    expect(m.valueFromText('Effort', '= 1 + 1')).toBe('= 1 + 1');
  });

  it('does not change the rule it was given', () => {
    const t = tool();
    const rule = buildPlanRule(t).toRule();
    const again = new RuleEditorModel(t, rule);
    again.setLabel('Other');
    expect(rule.label).toBe('High-priority tasks need an owner');
  });
});
