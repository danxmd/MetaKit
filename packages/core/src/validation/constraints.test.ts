import { describe, expect, it } from 'vitest';
import { ModelCalculator } from '../calc/calculator';
import { createModelStore } from '../model/commands';
import type { Model } from '../model/types';
import type { Constraint } from '../meta/rule-types';
import type { Kit } from '../meta/types';
import { SAMPLE, emptySampleModel, sampleKit } from '../testing/sample-kit';
import { validateModel } from './validate';

function setup(taskConstraints: Constraint[]) {
  const base = sampleKit();
  const kit: Kit = {
    ...base,
    classes: {
      ...base.classes,
      [SAMPLE.flowNode]: {
        ...base.classes[SAMPLE.flowNode]!,
        constraints: [
          {
            id: 'k_inherited',
            formula: "Name != ''",
            message: 'Every node needs a name.',
          },
        ],
      },
      [SAMPLE.task]: {
        ...base.classes[SAMPLE.task]!,
        constraints: taskConstraints,
      },
    },
    relations: {
      ...base.relations,
      [SAMPLE.flow]: {
        ...base.relations[SAMPLE.flow]!,
        constraints: [
          { id: 'k_rel', formula: 'from != to', message: 'No self loops.' },
        ],
      },
    },
    modelTypes: {
      ...base.modelTypes,
      [SAMPLE.process]: {
        ...base.modelTypes[SAMPLE.process]!,
        constraints: [
          {
            id: 'k_model',
            formula: 'count(objects("Task")) < 2',
            message: 'Too many tasks.',
            severity: 'warning',
          },
        ],
      },
    },
  };
  const store = createModelStore(emptySampleModel(), { kit });
  const calc = new ModelCalculator(kit, () => store.state as Model);
  calc.attach(store);
  const task = (attrs: Record<string, unknown>) =>
    (
      store.execute({
        type: 'createElement',
        class: SAMPLE.task,
        x: 0,
        y: 0,
        attrs,
      } as never) as unknown as { value: string }
    ).value;
  return { kit, store, calc, task };
}

describe('constraints in validation', () => {
  const effortConstraint = {
    id: 'k_effort',
    formula: 'Effort > 0',
    message: 'Effort must be above zero',
  };

  it('reports a violated constraint with its message on the object', () => {
    const { kit, store, calc, task } = setup([effortConstraint]);
    const t = task({ [SAMPLE.attEffort]: 0 });
    const issues = validateModel(kit, store.state as Model, calc).filter(
      (i) => i.code === 'constraint',
    );
    expect(issues).toEqual([
      {
        id: t,
        severity: 'error',
        code: 'constraint',
        constraint: 'k_effort',
        attr: SAMPLE.attEffort,
        message: 'Effort must be above zero',
      },
    ]);
  });

  it('is silent when the constraint holds, and without a calculator', () => {
    const { kit, store, calc, task } = setup([effortConstraint]);
    task({ [SAMPLE.attEffort]: 0 });
    expect(
      validateModel(kit, store.state as Model).some(
        (i) => i.code === 'constraint',
      ),
    ).toBe(false);
    store.execute({
      type: 'setAttribute',
      target: Object.keys(store.state.elements)[0],
      attr: SAMPLE.attEffort,
      value: 3,
    } as never);
    expect(
      validateModel(kit, store.state as Model, calc).some(
        (i) => i.code === 'constraint',
      ),
    ).toBe(false);
  });

  it('evaluates a formula message and takes the severity of the constraint', () => {
    const { kit, store, calc, task } = setup([
      {
        id: 'k_msg',
        formula: 'Effort > 5',
        message: '= "Effort " + Effort + " is too low"',
        severity: 'warning',
      },
    ]);
    task({ [SAMPLE.attEffort]: 2 });
    const found = validateModel(kit, store.state as Model, calc).find(
      (i) => i.constraint === 'k_msg',
    )!;
    expect(found.message).toBe('Effort 2 is too low');
    expect(found.severity).toBe('warning');
  });

  it('checks inherited, relation and model type constraints', () => {
    const { kit, store, calc, task } = setup([]);
    const a = task({ [SAMPLE.attName]: '' });
    task({ [SAMPLE.attName]: 'B' });
    store.execute({
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: a,
    } as never);
    const codes = validateModel(kit, store.state as Model, calc)
      .filter((i) => i.code === 'constraint')
      .map((i) => i.constraint)
      .sort();
    expect(codes).toEqual(['k_inherited', 'k_model', 'k_rel']);
  });

  it('reports a formula that cannot be evaluated as a warning', () => {
    const { kit, store, calc, task } = setup([
      { id: 'k_bad', formula: 'Nope > 1', message: 'Nope.' },
    ]);
    task({});
    const issue = validateModel(kit, store.state as Model, calc).find(
      (i) => i.constraint === 'k_bad',
    )!;
    expect(issue.code).toBe('formula-error');
    expect(issue.severity).toBe('warning');
    expect(issue.constraint).toBe('k_bad');
    expect(issue.message).toContain('name that does not exist');
  });

  it('names a formula attribute that fails', () => {
    const { kit, store, calc, task } = setup([]);
    task({ [SAMPLE.attEffort]: 1 });
    const broken: Kit = {
      ...kit,
      classes: {
        ...kit.classes,
        [SAMPLE.task]: {
          ...kit.classes[SAMPLE.task]!,
          attributes: kit.classes[SAMPLE.task]!.attributes.map((a) =>
            a.key === 'Cost' ? { ...a, formula: 'Effort / 0' } : a,
          ),
        },
      },
    };
    calc.setKit(broken);
    const issue = validateModel(broken, store.state as Model, calc).find(
      (i) => i.code === 'formula-error' && i.attr === SAMPLE.attCost,
    )!;
    expect(issue.message).toContain('Cost');
    expect(issue.message).toContain('divides by zero');
  });
});
