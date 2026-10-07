import { describe, expect, it } from 'vitest';
import type { ElementId } from '../ids';
import {
  createModelStore,
  type ModelCommand,
  type ModelStore,
} from '../model/commands';
import {
  SAMPLE,
  emptySampleModel,
  sampleTool,
  clone,
} from '../testing/sample-tool';
import { hasErrors, issuesFor, validateModel } from './validate';

const tool = sampleTool();
const codes = (store: ModelStore) =>
  validateModel(tool, store.state).map((i) => i.code);

/** A correct little process: Start -> Task -> End, with the model title set. */
function goodProcess(): ModelStore {
  const store = createModelStore(emptySampleModel(), { tool });
  store.execute({
    type: 'batch',
    commands: [
      {
        type: 'createElement',
        class: SAMPLE.start,
        x: 0,
        y: 0,
        id: 'el_start',
        attrs: { [SAMPLE.attName]: 'Start' },
      },
      {
        type: 'createElement',
        class: SAMPLE.task,
        x: 150,
        y: 0,
        id: 'el_task',
        attrs: { [SAMPLE.attName]: 'Review order', [SAMPLE.attEffort]: 2 },
      },
      {
        type: 'createElement',
        class: SAMPLE.end,
        x: 300,
        y: 0,
        id: 'el_end',
        attrs: { [SAMPLE.attName]: 'Done' },
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_start',
        to: 'el_task',
        id: 'cn_a',
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_task',
        to: 'el_end',
        id: 'cn_b',
      },
      {
        type: 'setAttribute',
        target: 'model',
        attr: SAMPLE.attTitle,
        value: 'Order handling',
      },
    ],
  });
  return store;
}

const run = (store: ModelStore, ...commands: ModelCommand[]) =>
  commands.forEach((c) => store.execute(c));

describe('a correct model', () => {
  it('has no issues', () => {
    expect(validateModel(tool, goodProcess().state)).toEqual([]);
  });

  it('gives the same list twice', () => {
    const store = goodProcess();
    run(store, {
      type: 'setAttribute',
      target: 'el_task',
      attr: SAMPLE.attName,
      value: '',
    });
    expect(validateModel(tool, store.state)).toEqual(
      validateModel(tool, store.state),
    );
  });

  it('is not changed by validating', () => {
    const store = goodProcess();
    const before = store.state;
    const history = store.history();
    validateModel(tool, before);
    expect(store.state).toBe(before);
    expect(store.history()).toEqual(history);
  });
});

describe('issues carry their location', () => {
  it('names the element, attribute, severity, code and a sentence', () => {
    const store = goodProcess();
    run(store, {
      type: 'setAttribute',
      target: 'el_task',
      attr: SAMPLE.attName,
      value: '',
    });
    const [issue] = validateModel(tool, store.state);
    expect(issue).toEqual({
      id: 'el_task',
      severity: 'warning',
      code: 'required',
      attr: SAMPLE.attName,
      message: 'Task: Name is required.',
    });
  });

  it('uses the element name in messages when it has one', () => {
    const store = goodProcess();
    run(store, {
      type: 'setAttribute',
      target: 'el_task',
      attr: SAMPLE.attEffort,
      value: -3,
    });
    const issue = validateModel(tool, store.state).find(
      (i) => i.code === 'min',
    )!;
    expect(issue.message).toBe(
      'Task "Review order": Effort must be at least 0.',
    );
  });
});

describe('validation never blocks', () => {
  it('lets every command through on a model full of warnings', () => {
    const store = goodProcess();
    run(
      store,
      {
        type: 'setAttribute',
        target: 'el_task',
        attr: SAMPLE.attName,
        value: 'x'.repeat(50),
      },
      {
        type: 'setAttribute',
        target: 'el_task',
        attr: SAMPLE.attEffort,
        value: 'lots',
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_end',
        to: 'el_start',
      },
    );
    expect(validateModel(tool, store.state).length).toBeGreaterThan(2);
    expect(
      store.execute({ type: 'move', id: 'el_task' as ElementId, x: 1, y: 1 })
        .ok,
    ).toBe(true);
  });
});

describe('required attributes', () => {
  it('reports empty text, null and a missing value, but not an optional empty one', () => {
    const store = goodProcess();
    run(store, {
      type: 'setAttribute',
      target: 'el_task',
      attr: SAMPLE.attName,
      value: '',
    });
    expect(codes(store)).toEqual(['required']);
    run(store, {
      type: 'setAttribute',
      target: 'el_task',
      attr: SAMPLE.attName,
      value: null,
    });
    expect(codes(store)).toEqual(['required']);
    run(
      store,
      {
        type: 'setAttribute',
        target: 'el_task',
        attr: SAMPLE.attName,
        value: 'ok',
      },
      {
        type: 'setAttribute',
        target: 'el_task',
        attr: SAMPLE.attEffort,
        value: null,
      },
    );
    expect(codes(store)).toEqual([]);
  });

  it('reports the missing model title', () => {
    const store = goodProcess();
    run(store, {
      type: 'setAttribute',
      target: 'model',
      attr: SAMPLE.attTitle,
      value: '',
    });
    const issues = validateModel(tool, store.state);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'model',
      code: 'required',
      attr: SAMPLE.attTitle,
    });
  });

  it('counts zero as a value', () => {
    const store = goodProcess();
    const t = clone(tool);
    (
      t.classes[SAMPLE.task]!.attributes.find(
        (a) => a.id === SAMPLE.attEffort,
      ) as { required?: boolean }
    ).required = true;
    run(store, {
      type: 'setAttribute',
      target: 'el_task',
      attr: SAMPLE.attEffort,
      value: 0,
    });
    expect(validateModel(t, store.state)).toEqual([]);
  });
});

describe('attribute constraints', () => {
  it('reports each kind of violation with its code', () => {
    const store = goodProcess();
    const set = (target: string, attr: string, value: unknown) =>
      store.execute({
        type: 'setAttribute',
        target: target as never,
        attr: attr as never,
        value: value as never,
      });
    set('el_task', SAMPLE.attName, 'x'.repeat(21));
    set('el_task', SAMPLE.attCode, 'abc');
    set('el_task', SAMPLE.attEffort, 1.25);
    set('el_task', SAMPLE.attPriority, 'Urgent');
    set('model', SAMPLE.attVersion, 2.5);
    const found = validateModel(tool, store.state).map(
      (i) => `${i.id}:${i.code}`,
    );
    expect(found).toEqual(
      expect.arrayContaining([
        'model:not-integer',
        'el_task:max-length',
        'el_task:pattern',
        'el_task:decimals',
        'el_task:not-an-option',
      ]),
    );
    expect(found).toHaveLength(5);
  });

  it('reports a value of the wrong type', () => {
    const store = goodProcess();
    run(store, {
      type: 'setAttribute',
      target: 'el_task',
      attr: SAMPLE.attEffort,
      value: 'two',
    });
    expect(codes(store)).toEqual(['wrong-type']);
  });

  it('ignores formula attributes', () => {
    const store = goodProcess();
    expect(
      validateModel(tool, store.state).some((i) => i.attr === SAMPLE.attCost),
    ).toBe(false);
  });
});

describe('connections', () => {
  it('reports a connector whose ends the relation does not allow', () => {
    const store = goodProcess();
    run(
      store,
      {
        type: 'createElement',
        class: SAMPLE.lane,
        x: 0,
        y: 100,
        id: 'el_lane',
        attrs: { att_lanename: 'Sales' },
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_lane',
        to: 'el_task',
        id: 'cn_bad',
      },
    );
    const issues = validateModel(tool, store.state);
    expect(issues.map((i) => i.code)).toEqual(['from-not-allowed']);
    expect(issues[0]).toMatchObject({ id: 'cn_bad', severity: 'warning' });
    expect(issues[0]!.message).toBe(
      'Sequence flow: Lane cannot be at the start of a Sequence flow. Allowed: Flow node.',
    );
  });

  it('reports a bad TO end as well', () => {
    const store = goodProcess();
    run(
      store,
      {
        type: 'createElement',
        class: SAMPLE.lane,
        x: 0,
        y: 100,
        id: 'el_lane',
        attrs: { att_lanename: 'Sales' },
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_task',
        to: 'el_lane',
        id: 'cn_bad',
      },
    );
    expect(validateModel(tool, store.state).map((i) => i.code)).toEqual([
      'to-not-allowed',
    ]);
  });

  it('accepts a subclass where an abstract class is allowed', () => {
    expect(validateModel(tool, goodProcess().state)).toEqual([]);
  });

  it('reports a missing end as an error, once per end', () => {
    const model = clone(goodProcess().state) as ReturnType<
      typeof emptySampleModel
    >;
    delete (model.elements as Record<string, unknown>).el_end;
    const issues = validateModel(tool, model);
    expect(
      issues
        .filter((i) => i.code === 'dangling-end')
        .map((i) => [i.id, i.severity]),
    ).toEqual([['cn_b', 'error']]);
    expect(hasErrors(issues)).toBe(true);
    expect(issues.find((i) => i.code === 'dangling-end')!.message).toBe(
      'Sequence flow ends at el_end, which is not in the model.',
    );
  });

  it('reports a container that is missing', () => {
    const model = clone(goodProcess().state) as ReturnType<
      typeof emptySampleModel
    >;
    (model.elements as Record<string, { parent?: string }>).el_task!.parent =
      'el_ghost';
    expect(validateModel(tool, model).map((i) => i.code)).toEqual([
      'dangling-parent',
    ]);
  });
});

describe('what the model type allows', () => {
  it('reports a class that is not allowed', () => {
    const store = goodProcess();
    const t = clone(tool);
    t.modelTypes[SAMPLE.process]!.classes = t.modelTypes[
      SAMPLE.process
    ]!.classes.filter((c) => c !== SAMPLE.lane);
    run(store, {
      type: 'createElement',
      class: SAMPLE.lane,
      x: 0,
      y: 100,
      attrs: { att_lanename: 'Sales' },
    });
    const issues = validateModel(t, store.state);
    expect(issues.map((i) => i.code)).toEqual(['class-not-in-model-type']);
  });

  it('allows a subclass of a listed class', () => {
    const store = goodProcess();
    const t = clone(tool);
    t.modelTypes[SAMPLE.process]!.classes = [SAMPLE.flowNode, SAMPLE.lane];
    expect(validateModel(t, store.state)).toEqual([]);
  });

  it('reports a relation that is not allowed', () => {
    const store = goodProcess();
    const t = clone(tool);
    t.modelTypes[SAMPLE.process]!.relations = [];
    t.modelTypes[SAMPLE.process]!.views = [];
    expect(validateModel(t, store.state).map((i) => i.code)).toEqual([
      'relation-not-in-model-type',
      'relation-not-in-model-type',
    ]);
  });

  it('reports an unknown model type as an error', () => {
    const model = clone(goodProcess().state) as ReturnType<
      typeof emptySampleModel
    >;
    model.manifest.modelType = 'mt_gone' as never;
    const issues = validateModel(tool, model);
    expect(issues[0]).toMatchObject({
      id: 'model',
      severity: 'error',
      code: 'unknown-model-type',
    });
  });
});

describe('cardinalities', () => {
  it('reports a second start event once, for the model', () => {
    const store = goodProcess();
    run(store, {
      type: 'createElement',
      class: SAMPLE.start,
      x: 0,
      y: 200,
      attrs: { [SAMPLE.attName]: 'Second' },
    });
    const issues = validateModel(tool, store.state);
    expect(issues.map((i) => [i.id, i.code])).toEqual([
      ['model', 'count-above-max'],
    ]);
    expect(issues[0]!.message).toBe(
      'The model has 2 Start event elements, but at most 1 is allowed.',
    );
  });

  it('reports a missing start event', () => {
    const store = goodProcess();
    run(store, { type: 'delete', id: 'el_start' });
    const issues = validateModel(tool, store.state);
    expect(issues.map((i) => i.code)).toEqual(['count-below-min']);
    expect(issues[0]!.message).toBe(
      'The model has 0 Start event elements, but at least 1 is needed.',
    );
  });

  it('counts subclasses towards a limit on their parent class', () => {
    const store = goodProcess();
    const t = clone(tool);
    t.modelTypes[SAMPLE.process]!.cardinalities = [
      { kind: 'count', class: SAMPLE.flowNode, max: 2 },
    ];
    expect(validateModel(t, store.state).map((i) => i.code)).toEqual([
      'count-above-max',
    ]);
  });

  it('reports an incoming flow into a start event, on that element', () => {
    const store = goodProcess();
    run(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: 'el_task',
      to: 'el_start',
    });
    const issues = validateModel(tool, store.state);
    expect(issues.map((i) => [i.id, i.code])).toEqual([
      ['el_start', 'degree-above-max'],
    ]);
    expect(issues[0]!.message).toBe(
      'Start event "Start" has 1 Sequence flow entering it, but at most 0 are allowed.',
    );
  });

  it('reports a degree below the minimum', () => {
    const store = goodProcess();
    const t = clone(tool);
    t.modelTypes[SAMPLE.process]!.cardinalities = [
      {
        kind: 'degree',
        class: SAMPLE.task,
        relation: SAMPLE.flow,
        end: 'from',
        min: 2,
      },
    ];
    const issues = validateModel(t, store.state);
    expect(issues.map((i) => i.code)).toEqual(['degree-below-min']);
    expect(issuesFor(issues, 'el_task')).toHaveLength(1);
  });
});

describe('stale definitions', () => {
  it('keeps values for removed attributes and reports them as information', () => {
    const store = goodProcess();
    run(store, {
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 300,
      attrs: { [SAMPLE.attName]: 'Old', att_removed: 'legacy' },
    });
    const issues = validateModel(tool, store.state);
    expect(issues.map((i) => [i.code, i.severity, i.attr])).toEqual([
      ['unknown-attribute', 'info', 'att_removed'],
    ]);
    const old = Object.values(store.state.elements).find(
      (e) => e.attrs.att_removed,
    );
    expect(old!.attrs.att_removed).toBe('legacy');
  });

  it('reports elements of a removed class as information and skips their other checks', () => {
    const model = clone(goodProcess().state) as ReturnType<
      typeof emptySampleModel
    >;
    (model.elements as Record<string, { class: string }>).el_task!.class =
      'cls_removed';
    const issues = validateModel(tool, model);
    expect(issues.map((i) => [i.id, i.code, i.severity])).toEqual([
      ['el_task', 'unknown-class', 'info'],
    ]);
  });

  it('reports connectors of a removed relation class as information', () => {
    const model = clone(goodProcess().state) as ReturnType<
      typeof emptySampleModel
    >;
    (model.connectors as Record<string, { relation: string }>).cn_a!.relation =
      'rel_removed';
    expect(
      validateModel(tool, model)
        .filter((i) => i.id === 'cn_a')
        .map((i) => [i.code, i.severity]),
    ).toEqual([['unknown-relation', 'info']]);
  });

  it('reports a model made with another tool', () => {
    const model = clone(goodProcess().state) as ReturnType<
      typeof emptySampleModel
    >;
    model.manifest.tool = 'tool_other' as never;
    expect(validateModel(tool, model)[0]).toMatchObject({
      id: 'model',
      code: 'tool-mismatch',
    });
  });

  it('reports abstract classes in imported data', () => {
    const model = clone(goodProcess().state) as ReturnType<
      typeof emptySampleModel
    >;
    (model.elements as Record<string, { class: string }>).el_task!.class =
      SAMPLE.flowNode;
    expect(validateModel(tool, model).map((i) => i.code)).toContain(
      'abstract-class',
    );
  });
});

describe('order', () => {
  it('lists the model, then elements, then connectors, each in drawing order', () => {
    const store = goodProcess();
    run(
      store,
      {
        type: 'setAttribute',
        target: 'model',
        attr: SAMPLE.attTitle,
        value: '',
      },
      {
        type: 'setAttribute',
        target: 'el_end',
        attr: SAMPLE.attName,
        value: '',
      },
      {
        type: 'setAttribute',
        target: 'el_start',
        attr: SAMPLE.attName,
        value: '',
      },
      {
        type: 'setAttribute',
        target: 'cn_b' as never,
        attr: SAMPLE.attCondition,
        value: 7,
      },
      {
        type: 'setAttribute',
        target: 'cn_a' as never,
        attr: SAMPLE.attCondition,
        value: 7,
      },
    );
    expect(validateModel(tool, store.state).map((i) => i.id)).toEqual([
      'model',
      'el_start',
      'el_end',
      'cn_a',
      'cn_b',
    ]);
    run(store, { type: 'reorder', id: 'el_end', to: 'back' });
    expect(validateModel(tool, store.state).map((i) => i.id)).toEqual([
      'model',
      'el_end',
      'el_start',
      'cn_a',
      'cn_b',
    ]);
  });

  it('lists a class with several problems in attribute order', () => {
    const store = goodProcess();
    run(
      store,
      {
        type: 'setAttribute',
        target: 'el_task',
        attr: SAMPLE.attName,
        value: '',
      },
      {
        type: 'setAttribute',
        target: 'el_task',
        attr: SAMPLE.attCode,
        value: 'abc',
      },
      {
        type: 'setAttribute',
        target: 'el_task',
        attr: SAMPLE.attEffort,
        value: -1,
      },
    );
    expect(validateModel(tool, store.state).map((i) => i.attr)).toEqual([
      SAMPLE.attName,
      SAMPLE.attCode,
      SAMPLE.attEffort,
    ]);
  });
});
