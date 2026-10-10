import {
  createModelStore,
  inDrawingOrder,
  type Model,
  type ModelCommand,
  type RandomSource,
} from '@metakit-app/core';
import {
  SAMPLE,
  clone,
  emptySampleModel,
  sampleKit,
} from '@metakit-app/core/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FormatError } from './errors';
import {
  exportMkModel,
  importMkModel,
  MkModelError,
  toMkModel,
} from './mkmodel';

const kit = sampleKit();

function seeded(seed: number): RandomSource {
  let a = seed >>> 0;
  return {
    getRandomValues(array: Uint8Array) {
      for (let i = 0; i < array.length; i++) {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        array[i] = ((t ^ (t >>> 14)) >>> 0) & 255;
      }
      return array;
    },
  };
}

function process(): Model {
  const store = createModelStore(emptySampleModel(), { kit });
  store.execute({
    type: 'batch',
    commands: [
      {
        type: 'createElement',
        class: SAMPLE.lane,
        x: 0,
        y: 0,
        w: 600,
        h: 200,
        id: 'el_lane',
        attrs: { att_lanename: 'Sales' },
      },
      {
        type: 'createElement',
        class: SAMPLE.start,
        x: 20,
        y: 40,
        parent: 'el_lane',
        id: 'el_start',
        attrs: { [SAMPLE.attName]: 'Start' },
      },
      {
        type: 'createElement',
        class: SAMPLE.task,
        x: 150,
        y: 40,
        parent: 'el_lane',
        id: 'el_task',
        attrs: { [SAMPLE.attName]: 'Review', [SAMPLE.attEffort]: 2.5 },
      },
      {
        type: 'createElement',
        class: SAMPLE.end,
        x: 300,
        y: 40,
        parent: 'el_lane',
        id: 'el_end',
        attrs: { [SAMPLE.attName]: 'Done' },
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_start',
        to: 'el_task',
        id: 'cn_a',
        bends: [{ x: 100, y: 70 }],
      },
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_task',
        to: 'el_end',
        id: 'cn_b',
        attrs: { [SAMPLE.attCondition]: 'approved' },
      },
      {
        type: 'setAttribute',
        target: 'model',
        attr: SAMPLE.attTitle,
        value: 'Orders',
      },
      { type: 'updateManifest', folder: 'Sales/2026' },
    ],
  });
  return store.state as Model;
}

/** What must survive a round trip. Position keys are regenerated, so they are replaced by their rank. */
function essence(model: Model) {
  const rank = (items: Record<string, { id: string; pos: string }>) =>
    Object.fromEntries(inDrawingOrder(items).map((x, i) => [x.id, i]));
  const elementRank = rank(model.elements);
  const connectorRank = rank(model.connectors);
  const strip = <T extends { pos: string }>(x: T): Omit<T, 'pos'> => {
    const copy: Partial<T> = { ...x };
    delete copy.pos;
    return copy as Omit<T, 'pos'>;
  };
  return {
    manifest: model.manifest,
    attrs: model.attrs,
    elements: Object.fromEntries(
      Object.values(model.elements).map((e) => [
        e.id,
        { ...strip(e), rank: elementRank[e.id] },
      ]),
    ),
    connectors: Object.fromEntries(
      Object.values(model.connectors).map((c) => [
        c.id,
        { ...strip(c), rank: connectorRank[c.id] },
      ]),
    ),
  };
}

describe('export', () => {
  it('writes keys instead of ids, in drawing order, with the details a person would want', () => {
    const file = toMkModel(kit, process());
    expect(file.modelType).toBe('Process');
    expect(file.elements.map((e) => [e.id, e.class])).toEqual([
      ['el_lane', 'Lane'],
      ['el_start', 'StartEvent'],
      ['el_task', 'Task'],
      ['el_end', 'EndEvent'],
    ]);
    expect(file.elements[2]).toMatchObject({
      parent: 'el_lane',
      attributes: { Name: 'Review', Effort: 2.5, Priority: 'Medium' },
    });
    expect(file.connectors![0]).toMatchObject({
      relation: 'SequenceFlow',
      from: 'el_start',
      to: 'el_task',
      bends: [{ x: 100, y: 70 }],
    });
    expect(file.connectors![1]!.attributes).toEqual({ Condition: 'approved' });
    expect(file.attributes).toEqual({ Title: 'Orders' });
    expect(file.tool).toEqual({
      id: 'tool_sample',
      name: 'Sample',
      version: '1.0.0',
    });
  });

  it('is canonical text that ends with a newline and parses back to the same file', () => {
    const text = exportMkModel(kit, process());
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(
      JSON.parse(JSON.stringify(toMkModel(kit, process()))),
    );
    expect(exportMkModel(kit, process())).toBe(text);
  });

  it('leaves out empty attribute lists and bends', () => {
    const file = toMkModel(kit, emptySampleModel());
    expect(file).not.toHaveProperty('attributes');
    expect(file).not.toHaveProperty('connectors');
  });
});

describe('round trip', () => {
  it('loses nothing', () => {
    const model = process();
    const back = importMkModel(kit, exportMkModel(kit, model));
    expect(essence(back)).toEqual(essence(model));
    expect(inDrawingOrder(back.elements).map((e) => e.id)).toEqual(
      inDrawingOrder(model.elements).map((e) => e.id),
    );
  });

  it('is stable when exported again', () => {
    const text = exportMkModel(kit, process());
    expect(exportMkModel(kit, importMkModel(kit, text))).toBe(text);
  });

  it('keeps values for attributes the Kit no longer has, under their ids', () => {
    const model = clone(process()) as unknown as {
      elements: Record<
        string,
        { attrs: Record<string, unknown>; class: string }
      >;
      connectors: Record<string, { relation: string }>;
    };
    model.elements.el_task!.attrs.att_removed = 'legacy';
    model.elements.el_end!.class = 'cls_removed';
    model.connectors.cn_a!.relation = 'rel_removed';
    const text = exportMkModel(kit, model as never);
    expect(text).toContain('att_removed');
    expect(text).toContain('cls_removed');
    expect(text).toContain('rel_removed');
    expect(essence(importMkModel(kit, text))).toEqual(essence(model as never));
  });

  it('survives random models', () => {
    const intent = fc.record({
      op: fc.integer({ min: 0, max: 6 }),
      a: fc.nat({ max: 500 }),
      b: fc.integer({ min: -300, max: 300 }),
      c: fc.integer({ min: -300, max: 300 }),
    });
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(intent, { minLength: 1, maxLength: 40 }),
        (seed, intents) => {
          const store = createModelStore(emptySampleModel(), {
            kit,
            random: seeded(seed),
          });
          const classes = [
            SAMPLE.task,
            SAMPLE.gateway,
            SAMPLE.start,
            SAMPLE.end,
            SAMPLE.lane,
          ];
          for (const i of intents) {
            const els = inDrawingOrder(store.state.elements);
            const el = els[i.a % Math.max(1, els.length)];
            const el2 = els[(i.a + i.b + 1000) % Math.max(1, els.length)];
            const cns = inDrawingOrder(store.state.connectors);
            const commands: (ModelCommand | null)[] = [
              {
                type: 'createElement',
                class: classes[i.a % 5]!,
                x: i.b,
                y: i.c,
                ...(el && i.c % 3 === 0 ? { parent: el.id } : {}),
                attrs: {
                  [SAMPLE.attName]: `n${i.a}`,
                  ...(i.b % 2 ? { att_unknown: [i.b, { k: null }] } : {}),
                },
              },
              el && el2
                ? {
                    type: 'createConnector',
                    relation: SAMPLE.flow,
                    from: el.id,
                    to: el2.id,
                    bends: i.b % 2 ? [{ x: i.b, y: i.c }] : [],
                  }
                : null,
              el
                ? {
                    type: 'setAttribute',
                    target: el.id,
                    attr: SAMPLE.attEffort,
                    value: i.b / 4,
                  }
                : null,
              el && el2
                ? { type: 'reorder', id: el.id, to: { after: el2.id } }
                : null,
              cns[0]
                ? {
                    type: 'setAttribute',
                    target: cns[0].id,
                    attr: SAMPLE.attCondition,
                    value: `c${i.c}`,
                  }
                : null,
              el
                ? {
                    type: 'resize',
                    id: el.id,
                    w: 10 + Math.abs(i.b),
                    h: 10 + Math.abs(i.c),
                  }
                : null,
              {
                type: 'setAttribute',
                target: 'model',
                attr: SAMPLE.attTitle,
                value: `t${i.a}`,
              },
            ];
            const command = commands[i.op];
            if (command) {
              try {
                store.execute(command);
              } catch {
                // Commands that do not apply to this state are skipped.
              }
            }
          }
          const model = store.state as Model;
          const text = exportMkModel(kit, model);
          const back = importMkModel(kit, text, { random: seeded(seed + 1) });
          expect(essence(back)).toEqual(essence(model));
          expect(exportMkModel(kit, back)).toBe(text);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('hand-written files', () => {
  const handWritten = {
    formatVersion: 1,
    kind: 'mkmodel',
    name: 'Hand made',
    modelType: 'Process',
    attributes: { Title: 'By hand' },
    elements: [
      {
        id: 'start',
        class: 'StartEvent',
        x: 0,
        y: 0,
        attributes: { Name: 'Begin' },
      },
      {
        id: 'review',
        class: 'Task',
        x: 150,
        y: 0,
        w: 100,
        h: 50,
        attributes: { Name: 'Review', Priority: 'High' },
      },
      { id: 'end', class: 'EndEvent', x: 300, y: 0 },
    ],
    connectors: [
      { relation: 'SequenceFlow', from: 'start', to: 'review' },
      {
        relation: 'SequenceFlow',
        from: 'review',
        to: 'end',
        attributes: { Condition: 'ok' },
      },
    ],
  };

  it('creates ids for names that are not ids and rewrites every reference', () => {
    const model = importMkModel(kit, handWritten);
    const els = inDrawingOrder(model.elements);
    expect(els.map((e) => e.id)).toSatisfy((ids: string[]) =>
      ids.every((id) => /^el_[0-9a-z]{10}$/.test(id)),
    );
    expect(new Set(els.map((e) => e.id)).size).toBe(3);
    const [start, review, end] = els;
    const cns = inDrawingOrder(model.connectors);
    expect(cns.map((c) => [c.from, c.to])).toEqual([
      [start!.id, review!.id],
      [review!.id, end!.id],
    ]);
    expect(cns.every((c) => /^cn_/.test(c.id))).toBe(true);
    expect(review).toMatchObject({
      w: 100,
      h: 50,
      class: SAMPLE.task,
      attrs: { [SAMPLE.attName]: 'Review', [SAMPLE.attPriority]: 'High' },
    });
    expect(end).toMatchObject({ w: 120, h: 60 });
    expect(model.attrs).toEqual({ [SAMPLE.attTitle]: 'By hand' });
    expect(model.manifest).toMatchObject({
      name: 'Hand made',
      tool: SAMPLE.kit,
      toolVersion: '1.0.0',
      modelType: SAMPLE.process,
    });
    expect(model.manifest.id).toMatch(/^mdl_/);
  });

  it('puts elements in drawing order by position in the file', () => {
    const model = importMkModel(kit, handWritten);
    expect(
      inDrawingOrder(model.elements).map((e) => model.elements[e.id]!.x),
    ).toEqual([0, 150, 300]);
  });

  it('allows a container listed after its contents', () => {
    const file = clone(handWritten) as typeof handWritten & {
      elements: Record<string, unknown>[];
    };
    file.elements[0]!.parent = 'lane';
    file.elements.push({
      id: 'lane',
      class: 'Lane',
      x: 0,
      y: 0,
      attributes: { LaneName: 'A' },
    });
    const model = importMkModel(kit, file);
    const lane = Object.values(model.elements).find(
      (e) => e.class === SAMPLE.lane,
    )!;
    expect(
      Object.values(model.elements).find((e) => e.parent === lane.id),
    ).toBeDefined();
  });

  it('accepts text and parsed data alike', () => {
    expect(importMkModel(kit, JSON.stringify(handWritten)).manifest.name).toBe(
      'Hand made',
    );
  });
});

describe('problems are reported with their place', () => {
  const base = () =>
    clone({
      formatVersion: 1,
      kind: 'mkmodel',
      name: 'X',
      modelType: 'Process',
      elements: [{ id: 'a', class: 'Task', x: 0, y: 0 }],
      connectors: [] as unknown[],
    });
  const issues = (file: unknown) => {
    try {
      importMkModel(kit, file);
    } catch (error) {
      expect(error).toBeInstanceOf(MkModelError);
      return (error as MkModelError).issues;
    }
    throw new Error('expected a failure');
  };

  it('names an unknown class and suggests the nearest one', () => {
    const file = base();
    file.elements[0]!.class = 'Taks';
    expect(issues(file)).toEqual([
      {
        path: 'elements[0].class',
        message: expect.stringContaining(
          'Unknown class "Taks". Did you mean "Task"?',
        ),
      },
    ]);
  });

  it('names an unknown attribute and lists the known ones', () => {
    const file = base() as ReturnType<typeof base> & {
      elements: { attributes?: Record<string, unknown> }[];
    };
    file.elements[0]!.attributes = { Prio: 'High' };
    const [issue] = issues(file);
    expect(issue!.path).toBe('elements[0].attributes.Prio');
    expect(issue!.message).toMatch(
      /Unknown attribute "Prio" on the class "Task"\. Did you mean "Priority"\? Known: Name, Code, Priority, Effort, Cost\./,
    );
  });

  it('reports every problem, not just the first', () => {
    const file = base() as ReturnType<typeof base> & {
      elements: Record<string, unknown>[];
    };
    file.modelType = 'Procss';
    file.elements.push(
      { id: 'b', class: 'Nope', x: 'left', y: 0 },
      { id: 'a', class: 'Task', x: 0, y: 0 },
    );
    file.connectors.push(
      { relation: 'SequenceFlow', from: 'a', to: 'ghost' },
      { relation: 'Flow', from: 'a', to: 'b' },
    );
    const found = issues(file).map((i) => i.path);
    expect(found).toEqual(
      expect.arrayContaining([
        'modelType',
        'elements[2].id',
        'elements[1].class',
        'elements[1].x',
        'connectors[0].to',
        'connectors[1].relation',
      ]),
    );
    expect(() => importMkModel(kit, file)).toThrow(
      /problems:\n {2}modelType: Unknown model type "Procss"\. Did you mean "Process"\?/,
    );
  });

  it('refuses a file for another Kit', () => {
    const file = { ...base(), tool: { id: 'tool_other' } };
    expect(issues(file)[0]).toMatchObject({ path: 'tool.id' });
  });

  it('refuses a container loop, a bad container and bad bend points', () => {
    const file = base() as ReturnType<typeof base> & {
      elements: Record<string, unknown>[];
    };
    file.elements = [
      { id: 'a', class: 'Lane', x: 0, y: 0, parent: 'b' },
      { id: 'b', class: 'Lane', x: 0, y: 0, parent: 'a' },
      { id: 'c', class: 'Task', x: 0, y: 0, parent: 'zzz' },
    ];
    file.connectors.push({
      relation: 'SequenceFlow',
      from: 'c',
      to: 'c',
      bends: [{ x: 1 }],
    });
    const found = issues(file);
    expect(found.map((i) => i.path)).toEqual(
      expect.arrayContaining([
        'elements',
        'elements[2].parent',
        'connectors[0].bends',
      ]),
    );
  });

  it('refuses attribute values that are not plain data', () => {
    const file = base() as ReturnType<typeof base> & {
      elements: { attributes?: Record<string, unknown> }[];
    };
    file.elements[0]!.attributes = { Name: () => 1, Effort: Number.NaN };
    expect(
      issues(file).map((i) => [
        i.path,
        i.message.startsWith('The value must be plain data'),
      ]),
    ).toEqual([
      ['elements[0].attributes.Name', true],
      ['elements[0].attributes.Effort', true],
    ]);
  });

  it('refuses files that are not model files', () => {
    expect(() => importMkModel(kit, '{ not json')).toThrow(FormatError);
    expect(() => importMkModel(kit, { kind: 'mkmodel' })).toThrow(
      /no format version/,
    );
    expect(() => importMkModel(kit, { formatVersion: 9 })).toThrow(
      /newer version of MetaKit/,
    );
    expect(
      issues({
        formatVersion: 1,
        kind: 'other',
        name: '',
        modelType: 'Process',
        elements: 5,
      }).map((i) => i.path),
    ).toEqual(expect.arrayContaining(['kind', 'name', 'elements']));
  });

  it('keeps ids that are valid, and refuses the same id twice', () => {
    const file = base() as ReturnType<typeof base> & {
      elements: Record<string, unknown>[];
    };
    file.elements = [
      { id: 'el_keep', class: 'Task', x: 0, y: 0 },
      { id: 'el_keep', class: 'Task', x: 1, y: 1 },
    ];
    expect(issues(file)[0]).toMatchObject({
      path: 'elements[1].id',
      message: 'The id "el_keep" is used twice.',
    });
    file.elements.pop();
    expect(importMkModel(kit, file).elements).toHaveProperty('el_keep');
  });
});
