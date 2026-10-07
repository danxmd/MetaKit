import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ElementId, RandomSource } from '../ids';
import { createToolStore, type ToolCommand } from '../meta/commands';
import type { ClassDef } from '../meta/types';
import {
  createModelStore,
  type ModelCommand,
  type ModelStore,
} from '../model/commands';
import { inDrawingOrder } from '../model/types';
import { SAMPLE, emptySampleModel, sampleTool } from '../testing/sample-tool';
import { CommandError } from './tx';

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

/** A recipe for a command, turned into a real one against whatever the model holds at that moment. */
interface Intent {
  op: number;
  a: number;
  b: number;
  c: number;
  batch: number;
}

const intentArb = fc.record({
  op: fc.integer({ min: 0, max: 11 }),
  a: fc.nat({ max: 1000 }),
  b: fc.integer({ min: -500, max: 500 }),
  c: fc.integer({ min: -500, max: 500 }),
  batch: fc.integer({ min: 0, max: 3 }),
});

const CLASSES = [
  SAMPLE.task,
  SAMPLE.gateway,
  SAMPLE.start,
  SAMPLE.end,
  SAMPLE.lane,
] as const;

function commandFor(store: ModelStore, intent: Intent): ModelCommand | null {
  const model = store.state;
  const elements = inDrawingOrder(model.elements);
  const connectors = inDrawingOrder(model.connectors);
  const el = elements[intent.a % Math.max(1, elements.length)];
  const el2 =
    elements[(intent.a + intent.b + 1000) % Math.max(1, elements.length)];
  const cn = connectors[intent.a % Math.max(1, connectors.length)];
  switch (intent.op) {
    case 0:
    case 1:
      return {
        type: 'createElement',
        class: CLASSES[intent.a % CLASSES.length]!,
        x: intent.b,
        y: intent.c,
        ...(el && intent.batch === 0 ? { parent: el.id } : {}),
      };
    case 2:
      return el && el2
        ? {
            type: 'createConnector',
            relation: SAMPLE.flow,
            from: el.id,
            to: el2.id,
            bends: [{ x: intent.b, y: intent.c }],
          }
        : null;
    case 3:
      return el
        ? {
            type: 'move',
            id: el.id,
            x: intent.b,
            y: intent.c,
            ...(intent.batch === 1
              ? { parent: null }
              : intent.batch === 2 && el2 && el2.id !== el.id
                ? { parent: el2.id }
                : {}),
          }
        : null;
    case 4:
      return el
        ? {
            type: 'resize',
            id: el.id,
            w: 10 + (intent.b + 500),
            h: 10 + (intent.c + 500),
          }
        : null;
    case 5:
      return el
        ? {
            type: 'setAttribute',
            target: el.id,
            attr: SAMPLE.attName,
            value: `n${intent.b}`,
          }
        : null;
    case 6:
      return cn
        ? {
            type: 'setAttribute',
            target: cn.id,
            attr: SAMPLE.attCondition,
            value: intent.b % 2 === 0 ? null : `c${intent.c}`,
          }
        : null;
    case 7:
      return {
        type: 'setAttribute',
        target: 'model',
        attr: SAMPLE.attTitle,
        value: [`t${intent.b}`, intent.c, null, { k: intent.a }][
          intent.batch
        ] as never,
      };
    case 8:
      return el && el2
        ? {
            type: 'reorder',
            id: el.id,
            to: ['front', 'back', { before: el2.id }, { after: el2.id }][
              intent.batch
            ] as never,
          }
        : null;
    case 9:
      return cn && el ? { type: 'reconnect', id: cn.id, to: el.id } : null;
    case 10:
      return intent.batch === 0 && el
        ? { type: 'delete', id: el.id }
        : cn
          ? { type: 'delete', id: cn.id }
          : null;
    default:
      return {
        type: 'updateManifest',
        name: `Model ${intent.b}`,
        folder: intent.c % 2 === 0 ? null : `F${intent.c}`,
      };
  }
}

function runIntents(
  store: ModelStore,
  intents: Intent[],
): { states: unknown[]; steps: number } {
  const states: unknown[] = [store.state];
  let steps = 0;
  let i = 0;
  while (i < intents.length) {
    const intent = intents[i]!;
    // Every fourth intent becomes a batch of the next three, to cover undoing batches.
    const group = intent.batch === 3 ? intents.slice(i, i + 3) : [intent];
    i += group.length;
    const commands = group
      .map((g) => commandFor(store, g))
      .filter((c): c is ModelCommand => c !== null);
    if (commands.length === 0) continue;
    try {
      store.execute(
        commands.length === 1 && group.length === 1
          ? commands[0]!
          : { type: 'batch', commands },
      );
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      continue;
    }
    if (store.state !== states.at(-1)) {
      states.push(store.state);
      steps += 1;
    }
  }
  return { states, steps };
}

describe('undo and redo are exact (property tests)', () => {
  it('restores every earlier model state, one step at a time, and replays forwards', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(intentArb, { minLength: 1, maxLength: 40 }),
        (seed, intents) => {
          const store = createModelStore(emptySampleModel(), {
            tool: sampleTool(),
            random: seeded(seed),
          });
          const { states, steps } = runIntents(store, intents);
          expect(store.history()).toHaveLength(steps);
          for (let i = states.length - 2; i >= 0; i--) {
            expect(store.undo()).toBe(true);
            expect(store.state).toEqual(states[i]);
          }
          expect(store.undo()).toBe(false);
          expect(store.state).toEqual(states[0]);
          for (let i = 1; i < states.length; i++) {
            expect(store.redo()).toBe(true);
            expect(store.state).toEqual(states[i]);
          }
          expect(store.redo()).toBe(false);
        },
      ),
      { numRuns: 600 },
    );
  });

  it('leaves the state unchanged when a command fails', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(intentArb, { minLength: 1, maxLength: 25 }),
        (seed, intents) => {
          const store = createModelStore(emptySampleModel(), {
            tool: sampleTool(),
            random: seeded(seed),
          });
          runIntents(store, intents);
          const before = store.state;
          const history = store.history().length;
          expect(() =>
            store.execute({
              type: 'batch',
              commands: [
                { type: 'createElement', class: SAMPLE.task, x: 1, y: 1 },
                { type: 'move', id: 'el_ghost', x: 0, y: 0 },
              ],
            }),
          ).toThrow(CommandError);
          expect(store.state).toBe(before);
          expect(store.history()).toHaveLength(history);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('keeps every element, connector and container reference valid after any sequence', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(intentArb, { minLength: 1, maxLength: 40 }),
        (seed, intents) => {
          const store = createModelStore(emptySampleModel(), {
            tool: sampleTool(),
            random: seeded(seed),
          });
          runIntents(store, intents);
          const m = store.state;
          for (const cn of Object.values(m.connectors)) {
            expect(m.elements[cn.from]).toBeDefined();
            expect(m.elements[cn.to]).toBeDefined();
          }
          for (const el of Object.values(m.elements))
            if (el.parent) expect(m.elements[el.parent]).toBeDefined();
          // No element contains itself, however it was moved.
          for (const el of Object.values(m.elements)) {
            const seen = new Set<string>([el.id]);
            let p: ElementId | undefined = el.parent;
            while (p) {
              expect(seen.has(p)).toBe(false);
              seen.add(p);
              p = m.elements[p]?.parent;
            }
          }
        },
      ),
      { numRuns: 400 },
    );
  });

  it('is exact for tool libraries too', () => {
    const toolIntent = fc.record({
      op: fc.integer({ min: 0, max: 6 }),
      n: fc.nat({ max: 5 }),
    });
    fc.assert(
      fc.property(
        fc.array(toolIntent, { minLength: 1, maxLength: 30 }),
        (intents) => {
          const store = createToolStore(sampleTool());
          const states: unknown[] = [store.state];
          for (const { op, n } of intents) {
            const classIds = Object.keys(store.state.classes);
            const def = (id: string): ClassDef => ({
              id: id as never,
              key: `K${id}`,
              kind: 'node',
              labels: { en: id },
              attributes: [
                { id: `att_${n}` as never, key: `A${n}`, type: 'text' },
              ],
            });
            const command: ToolCommand =
              op === 0
                ? { type: 'putClass', def: def(`cls_n${n}`) }
                : op === 1
                  ? {
                      type: 'removeClass',
                      id: (classIds[n % classIds.length] ?? 'cls_x') as never,
                    }
                  : op === 2
                    ? { type: 'updateManifest', name: `Tool ${n}` }
                    : op === 3
                      ? { type: 'updateSettings', grid: { size: 5 + n } }
                      : op === 4
                        ? {
                            type: 'updateSettings',
                            layers: [
                              {
                                key: `l${n}`,
                                labels: { en: 'L' },
                                visible: n % 2 === 0,
                              },
                            ],
                          }
                        : op === 5
                          ? { type: 'removeModelType', id: SAMPLE.process }
                          : {
                              type: 'putClass',
                              def: {
                                ...def(`cls_n${n}`),
                                labels: { en: `again${n}` },
                              },
                            };
            try {
              store.execute(command);
            } catch (error) {
              if (!(error instanceof CommandError)) throw error;
              continue;
            }
            if (store.state !== states.at(-1)) states.push(store.state);
          }
          for (let i = states.length - 2; i >= 0; i--) {
            store.undo();
            expect(store.state).toEqual(states[i]);
          }
          for (let i = 1; i < states.length; i++) {
            store.redo();
            expect(store.state).toEqual(states[i]);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('handles a large import as one undoable step', () => {
    const store = createModelStore(emptySampleModel(), { tool: sampleTool() });
    const commands: ModelCommand[] = [];
    for (let i = 0; i < 1000; i++)
      commands.push({
        type: 'createElement',
        class: SAMPLE.task,
        x: i,
        y: i,
        id: `el_big${i}` as ElementId,
      });
    for (let i = 0; i < 999; i++)
      commands.push({
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: `el_big${i}` as ElementId,
        to: `el_big${i + 1}` as ElementId,
      });
    const started = Date.now();
    store.execute({ type: 'batch', commands });
    const created = Date.now() - started;
    expect(Object.keys(store.state.elements)).toHaveLength(1000);
    expect(store.history()).toEqual(['batch']);
    store.undo();
    expect(store.state).toEqual(emptySampleModel());
    // About 10,000 patches in one step: it must not take seconds.
    expect(created).toBeLessThan(3000);
  });
});
