import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { HybridClock } from './clock';
import {
  TOMBSTONE_FIELD,
  applyOps,
  emptyState,
  liveElements,
  mergeStates,
  type Op,
} from './merge';

const op = (t: string, by: string, el: string, f: string, v?: unknown): Op => ({
  t,
  by,
  el,
  f,
  v,
});

describe('merge', () => {
  it('keeps the edit with the highest clock per field', () => {
    const state = applyOps(emptyState(), [
      op('2026-01-01T00:00:00.000Z/0001', 'a', 'el_1', 'x', 10),
      op('2026-01-01T00:00:00.000Z/0002', 'b', 'el_1', 'x', 20),
      op('2026-01-01T00:00:00.000Z/0000', 'c', 'el_1', 'y', 5),
    ]);
    expect(liveElements(state)).toEqual({ el_1: { x: 20, y: 5 } });
  });

  it('lets both survive when different fields are edited', () => {
    const a = op('2026-01-01T00:00:01.000Z/0000', 'a', 'el_1', 'x', 1);
    const b = op('2026-01-01T00:00:01.000Z/0000', 'b', 'el_1', 'y', 2);
    expect(liveElements(applyOps(emptyState(), [a, b]))).toEqual({
      el_1: { x: 1, y: 2 },
    });
  });

  it('breaks exact timestamp ties by instance id', () => {
    const t = '2026-01-01T00:00:01.000Z/0000';
    const a = op(t, 'a', 'el_1', 'name', 'from a');
    const b = op(t, 'b', 'el_1', 'name', 'from b');
    const forward = applyOps(emptyState(), [a, b]);
    const backward = applyOps(emptyState(), [b, a]);
    expect(forward).toEqual(backward);
    expect(liveElements(forward).el_1).toEqual({ name: 'from b' });
  });

  it('lets a tombstone win over a concurrent later edit', () => {
    const state = applyOps(emptyState(), [
      op('2026-01-01T00:00:01.000Z/0000', 'a', 'el_1', TOMBSTONE_FIELD),
      op('2026-01-01T00:00:09.000Z/0000', 'b', 'el_1', 'x', 99),
    ]);
    expect(liveElements(state)).toEqual({});
  });

  it('is idempotent and does not mutate its input', () => {
    const ops = [op('2026-01-01T00:00:01.000Z/0000', 'a', 'el_1', 'x', 1)];
    const base = emptyState();
    const once = applyOps(base, ops);
    expect(applyOps(once, ops)).toEqual(once);
    expect(base).toEqual(emptyState());
  });
});

// --- property tests -------------------------------------------------------------------

const instances = ['a', 'b', 'c', 'd'];
const elements = ['el_1', 'el_2', 'el_3'];
const fields = ['x', 'y', 'name'];

type Edit =
  | { kind: 'set'; el: string; f: string; v: number; step: number }
  | { kind: 'del'; el: string; step: number };

const editArb: fc.Arbitrary<Edit> = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('set' as const),
      el: fc.constantFrom(...elements),
      f: fc.constantFrom(...fields),
      v: fc.integer({ min: 0, max: 1000 }),
      // Small wall-clock steps (including 0) force counter and tie-break paths.
      step: fc.integer({ min: 0, max: 3 }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('del' as const),
      el: fc.constantFrom(...elements),
      step: fc.integer({ min: 0, max: 3 }),
    }),
  },
);

const scenarioArb = fc.record({
  logs: fc.array(fc.array(editArb, { maxLength: 12 }), {
    minLength: 2,
    maxLength: 4,
  }),
  // Each instance may start with a different wall-clock skew.
  skews: fc.array(fc.integer({ min: -5, max: 5 }), {
    minLength: 4,
    maxLength: 4,
  }),
  seeds: fc.array(fc.integer(), { minLength: 5, maxLength: 5 }),
});

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function buildLogs(
  logs: Edit[][],
  skews: number[],
): { ops: Op[]; perInstance: Op[][] } {
  const perInstance = logs.map((edits, index) => {
    const by = instances[index] as string;
    let now = 1_700_000_000_000 + (skews[index] ?? 0) * 1000;
    const clock = new HybridClock(() => now);
    return edits.map((edit): Op => {
      now += edit.step;
      const t = clock.tick();
      return edit.kind === 'set'
        ? { t, by, el: edit.el, f: edit.f, v: edit.v }
        : { t, by, el: edit.el, f: TOMBSTONE_FIELD };
    });
  });
  return { ops: perInstance.flat(), perInstance };
}

describe('merge convergence (property tests)', () => {
  it('ends in identical states for any delivery order, with duplicates', () => {
    fc.assert(
      fc.property(scenarioArb, ({ logs, skews, seeds }) => {
        const { ops } = buildLogs(logs, skews);
        const states = seeds.map((seed) => {
          const rand = mulberry32(seed);
          const delivered = shuffled(ops, rand);
          // Redeliver a random subset: sync clients and rescans can repeat files.
          const duplicates = ops.filter(() => rand() < 0.3);
          return applyOps(emptyState(), [
            ...delivered,
            ...shuffled(duplicates, rand),
          ]);
        });
        for (const state of states) expect(state).toEqual(states[0]);
      }),
      { numRuns: 1000 },
    );
  });

  it('converges when instances exchange snapshots plus remaining change files', () => {
    fc.assert(
      fc.property(scenarioArb, ({ logs, skews, seeds }) => {
        const { ops, perInstance } = buildLogs(logs, skews);
        const reference = applyOps(emptyState(), ops);
        for (const seed of seeds) {
          const rand = mulberry32(seed);
          // Each instance folds a random prefix of its own log into a snapshot, then a reader
          // gets every snapshot merged in random order plus the leftover files in random order.
          const snapshots = perInstance.map((log) => {
            const folded = log.slice(0, Math.floor(rand() * (log.length + 1)));
            return {
              state: applyOps(emptyState(), folded),
              rest: log.slice(folded.length),
            };
          });
          let reader = emptyState();
          const steps = shuffled(
            [
              ...snapshots.map((s) => ({ snapshot: s.state, ops: [] as Op[] })),
              ...snapshots.flatMap((s) =>
                s.rest.map((o) => ({ snapshot: null, ops: [o] })),
              ),
            ],
            rand,
          );
          for (const step of steps) {
            reader = step.snapshot
              ? mergeStates(reader, step.snapshot)
              : applyOps(reader, step.ops);
          }
          expect(reader).toEqual(reference);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('merges states commutatively', () => {
    fc.assert(
      fc.property(scenarioArb, ({ logs, skews }) => {
        const { perInstance } = buildLogs(logs, skews);
        const [first, second] = perInstance.map((log) =>
          applyOps(emptyState(), log),
        );
        expect(mergeStates(first!, second!)).toEqual(
          mergeStates(second!, first!),
        );
      }),
      { numRuns: 300 },
    );
  });
});
