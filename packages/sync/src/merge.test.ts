import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Json, Model } from '@metakit-app/core';
import { SAMPLE, emptySampleModel } from '@metakit-app/core/testing';
import { HybridClock } from './clock';
import { updateDocument } from './doc';
import { flatten, type Op, type StampedOp } from './ops';
import { materialize, stateFromDocument } from './state';
import { GENESIS, genesisState, Peer } from './testing';

const stamp = (n: number) =>
  `2026-01-01T00:00:00.${String(n).padStart(3, '0')}Z/000000`;
const op = (
  by: string,
  n: number,
  rest: Partial<Op> & { p: string[] },
): StampedOp => ({ t: stamp(n), by, ...rest }) as StampedOp;

describe('a document and its state', () => {
  it('materialize(stateFromDocument(doc)) is the document', () => {
    const doc = emptySampleModel() as unknown as Record<string, Json>;
    const state = stateFromDocument('model', doc, GENESIS);
    expect(materialize(state)).toEqual(doc);
  });

  it('keeps entities, nested records and empty containers', () => {
    const doc = {
      manifest: { name: 'M', id: 'mdl_a' },
      attrs: {},
      elements: {
        el_a: { id: 'el_a', x: 1, attrs: {}, bends: [] },
        el_b: { id: 'el_b', x: 2, attrs: { att_n: 'B', att_t: ['a', 'b'] } },
      },
      connectors: {},
    } as unknown as Record<string, Json>;
    expect(materialize(stateFromDocument('model', doc, GENESIS))).toEqual(doc);
  });

  it('flattens objects into containers and values, and arrays into one register', () => {
    const regs = flatten(['a'], { x: 1, y: { z: [1, 2] }, e: {} } as Json);
    expect(regs.map(([p, v]) => [p.join('/'), v])).toEqual([
      ['a', {}],
      ['a/x', 1],
      ['a/y', {}],
      ['a/y/z', [1, 2]],
      ['a/e', {}],
    ]);
  });
});

describe('merge rules', () => {
  const base = () => genesisState();

  it('the highest stamp wins per register, in any order', () => {
    const a = op('a', 5, { p: ['manifest', 'name'], v: 'A' });
    const b = op('b', 9, { p: ['manifest', 'name'], v: 'B' });
    const one = base();
    one.applyAll([a, b]);
    const two = base();
    two.applyAll([b, a, b, a]);
    expect(materialize(one)['manifest']).toMatchObject({ name: 'B' });
    expect(one.canonical()).toBe(two.canonical());
    expect(one.hash).toBe(two.hash);
  });

  it('an exact tie goes to the larger instance id', () => {
    const a = op('a', 5, { p: ['manifest', 'name'], v: 'A' });
    const b = op('b', 5, { p: ['manifest', 'name'], v: 'B' });
    const s = base();
    s.applyAll([b, a]);
    expect((materialize(s)['manifest'] as Record<string, Json>)['name']).toBe(
      'B',
    );
  });

  it('different fields both survive', () => {
    const s = base();
    s.applyAll([
      op('a', 1, { p: ['elements', 'el_1'], b: 1 }),
      op('a', 2, { p: ['elements', 'el_1', 'x'], v: 1 }),
      op('b', 3, { p: ['elements', 'el_1', 'y'], v: 2 }),
      op('a', 4, { p: ['elements', 'el_1', 'x'], v: 10 }),
    ]);
    expect(materialize(s)['elements']).toEqual({ el_1: { x: 10, y: 2 } });
  });

  it('a delete wins over an edit made by someone who had not seen it, an undo brings it back', () => {
    const s = base();
    s.applyAll([
      op('a', 1, { p: ['elements', 'el_1'], b: 1 }),
      op('a', 2, { p: ['elements', 'el_1', 'x'], v: 1 }),
      op('a', 5, { p: ['elements', 'el_1'], d: 1 }),
      op('b', 7, { p: ['elements', 'el_1', 'x'], v: 99 }), // later stamp, concurrent
    ]);
    expect(materialize(s)['elements']).toEqual({});
    s.applyAll([
      op('a', 9, { p: ['elements', 'el_1'], b: 1 }),
      op('a', 10, { p: ['elements', 'el_1', 'x'], v: 1 }),
    ]);
    expect(materialize(s)['elements']).toEqual({ el_1: { x: 1 } });
  });

  it('an unset removes the field', () => {
    const s = base();
    s.applyAll([
      op('a', 1, { p: ['elements', 'el_1'], b: 1 }),
      op('a', 2, { p: ['elements', 'el_1', 'parent'], v: 'el_0' }),
      op('a', 3, { p: ['elements', 'el_1', 'parent'], u: 1 }),
    ]);
    expect(materialize(s)['elements']).toEqual({ el_1: {} });
  });

  it('hides a connector whose end is gone, and shows it again when the end comes back', () => {
    const s = base();
    const make = (id: string, n: number) => [
      op('a', n, { p: ['elements', id], b: 1 }),
      op('a', n + 1, { p: ['elements', id, 'id'], v: id }),
    ];
    s.applyAll([
      ...make('el_1', 1),
      ...make('el_2', 3),
      op('a', 5, { p: ['connectors', 'cn_1'], b: 1 }),
      op('a', 6, { p: ['connectors', 'cn_1', 'from'], v: 'el_1' }),
      op('a', 7, { p: ['connectors', 'cn_1', 'to'], v: 'el_2' }),
    ]);
    let doc = materialize(s);
    expect(Object.keys(doc['connectors'] as object)).toEqual(['cn_1']);
    s.applyAll([op('b', 8, { p: ['elements', 'el_2'], d: 1 })]);
    doc = materialize(s);
    expect(Object.keys(doc['connectors'] as object)).toEqual([]);
    s.applyAll([
      op('b', 9, { p: ['elements', 'el_2'], b: 1 }),
      ...make('el_2', 10).slice(1),
    ]);
    expect(Object.keys(materialize(s)['connectors'] as object)).toEqual([
      'cn_1',
    ]);
  });

  it('updateDocument reports patches that turn the old document into the new one', () => {
    const s = base();
    const doc0 = materialize(s);
    const touches = s.applyAll([
      op('a', 1, { p: ['elements', 'el_1'], b: 1 }),
      op('a', 2, { p: ['elements', 'el_1', 'x'], v: 1 }),
      op('a', 3, { p: ['manifest', 'name'], v: 'N' }),
    ]);
    const { doc, patches } = updateDocument(s, doc0, touches);
    expect(doc).toEqual(materialize(s));
    expect(patches.map((p) => p.path.join('/')).sort()).toEqual([
      'elements/el_1',
      'manifest/name',
    ]);
    expect(doc0).toEqual(materialize(genesisState()));
  });

  it('keeps the hash equal for equal states and different for different ones', () => {
    const a = base();
    const b = base();
    const ops = [
      op('a', 1, { p: ['manifest', 'name'], v: 'A' }),
      op('b', 2, { p: ['attrs', 'att_x'], v: 1 }),
    ];
    a.applyAll(ops);
    b.applyAll([...ops].reverse());
    expect(a.hash).toBe(b.hash);
    b.applyAll([op('b', 3, { p: ['attrs', 'att_x'], v: 2 })]);
    expect(a.hash).not.toBe(b.hash);
  });

  it('compaction drops the fields of long-deleted entities and keeps them dead', () => {
    const s = base();
    s.applyAll([
      op('a', 1, { p: ['elements', 'el_1'], b: 1 }),
      op('a', 2, { p: ['elements', 'el_1', 'x'], v: 1 }),
      op('a', 3, { p: ['elements', 'el_1'], d: 1 }),
    ]);
    const before = s.size;
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    expect(s.compact(now, 30 * 24 * 3600 * 1000)).toBe(1);
    expect(s.size).toBeLessThan(before);
    s.applyAll([op('b', 400, { p: ['elements', 'el_1', 'x'], v: 5 })]);
    expect(materialize(s)['elements']).toEqual({});
  });
});

// A random simulation: several people edit, undo and redo, and changes reach each other in any
// order, with repeats. Everyone must end with the same state, equal to what their own store holds.
type Action =
  | { k: 'create'; who: number; x: number; cls: number; name: number }
  | { k: 'move'; who: number; pick: number; x: number; y: number }
  | { k: 'attr'; who: number; pick: number; value: number }
  | { k: 'delete'; who: number; pick: number }
  | { k: 'connect'; who: number; a: number; b: number }
  | { k: 'undo'; who: number }
  | { k: 'redo'; who: number }
  | { k: 'deliver'; to: number; from: number; pick: number };

const PEERS = 4;
const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc.record({
    k: fc.constant('create' as const),
    who: fc.nat(PEERS - 1),
    x: fc.integer({ min: 0, max: 900 }),
    cls: fc.nat(2),
    name: fc.nat(5),
  }),
  fc.record({
    k: fc.constant('move' as const),
    who: fc.nat(PEERS - 1),
    pick: fc.nat(50),
    x: fc.integer({ min: 0, max: 900 }),
    y: fc.integer({ min: 0, max: 900 }),
  }),
  fc.record({
    k: fc.constant('attr' as const),
    who: fc.nat(PEERS - 1),
    pick: fc.nat(50),
    value: fc.nat(5),
  }),
  fc.record({
    k: fc.constant('delete' as const),
    who: fc.nat(PEERS - 1),
    pick: fc.nat(50),
  }),
  fc.record({
    k: fc.constant('connect' as const),
    who: fc.nat(PEERS - 1),
    a: fc.nat(50),
    b: fc.nat(50),
  }),
  fc.record({ k: fc.constant('undo' as const), who: fc.nat(PEERS - 1) }),
  fc.record({ k: fc.constant('redo' as const), who: fc.nat(PEERS - 1) }),
  fc.record({
    k: fc.constant('deliver' as const),
    to: fc.nat(PEERS - 1),
    from: fc.nat(PEERS - 1),
    pick: fc.nat(50),
  }),
);

function simulate(actions: Action[], skews: number[]) {
  const peers = Array.from({ length: PEERS }, (_, i) => {
    let n = 0;
    return new Peer(
      `p${i}`,
      () => Date.parse('2026-01-01T00:00:00Z') + skews[i]! + n++ * 3,
    );
  });
  const classes = [SAMPLE.task, SAMPLE.gateway, SAMPLE.start];
  const ids = (p: Peer) => Object.keys((p.store.state as Model).elements);
  for (const a of actions) {
    if (a.k === 'deliver') {
      const from = peers[a.from]!;
      const to = peers[a.to]!;
      if (from === to || from.outbox.length === 0) continue;
      const index = a.pick % from.outbox.length;
      to.receive(from.outbox[index]!);
      continue;
    }
    const p = peers[a.who]!;
    const known = ids(p);
    switch (a.k) {
      case 'create':
        p.run({
          type: 'createElement',
          class: classes[a.cls]!,
          x: a.x,
          y: 0,
          attrs: { [SAMPLE.attName]: `N${a.name}` },
        });
        break;
      case 'move':
        if (known.length)
          p.run({
            type: 'move',
            id: known[a.pick % known.length] as never,
            x: a.x,
            y: a.y,
          });
        break;
      case 'attr':
        if (known.length)
          p.run({
            type: 'setAttribute',
            target: known[a.pick % known.length] as never,
            attr: SAMPLE.attName,
            value: `V${a.value}`,
          });
        break;
      case 'delete':
        if (known.length)
          p.run({ type: 'delete', id: known[a.pick % known.length] as never });
        break;
      case 'connect':
        if (known.length > 1)
          p.run({
            type: 'createConnector',
            relation: SAMPLE.flow,
            from: known[a.a % known.length] as never,
            to: known[a.b % known.length] as never,
          });
        break;
      case 'undo':
        p.store.undo();
        break;
      case 'redo':
        p.store.redo();
        break;
    }
  }
  return peers;
}

describe('random simulation', () => {
  it('everyone ends in the same state, equal to their own store, whatever the delivery order', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 5, maxLength: 80 }),
        fc.array(fc.integer({ min: -5000, max: 5000 }), {
          minLength: PEERS,
          maxLength: PEERS,
        }),
        fc.nat(1000),
        (actions, skews, seed) => {
          const peers = simulate(actions, skews);
          // Then everything reaches everyone, in an order and with repeats that depend on the seed.
          const all = peers.flatMap((p) =>
            p.outbox.map((batch) => ({ from: p, batch })),
          );
          for (const to of peers) {
            const mine = all.filter((x) => x.from !== to);
            const order = [...mine, ...mine.slice(0, 3)].sort(
              (a, b) =>
                ((mine.indexOf(a) * 7919 + seed) % 97) -
                ((mine.indexOf(b) * 7919 + seed) % 97),
            );
            for (const { batch } of order) to.receive(batch);
          }
          const reference = peers[0]!.state.canonical();
          for (const p of peers) {
            expect(p.state.canonical()).toBe(reference);
            expect(p.state.hash).toBe(peers[0]!.state.hash);
            // The store holds exactly what the merged state says.
            expect(JSON.parse(JSON.stringify(p.store.state))).toEqual(
              materialize(p.state),
            );
          }
          // A fresh reader of all the files gets the same state, in a different order.
          const reader = genesisState();
          const flat = all.flatMap((x) => x.batch);
          reader.applyAll([...flat].reverse());
          reader.applyAll(flat);
          expect(reader.canonical()).toBe(reference);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('a single person keeps the store and the state equal after every step, undo and redo included', () => {
    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 5, maxLength: 60 }),
        (actions) => {
          const solo = actions.map((a) =>
            'who' in a ? { ...a, who: 0 } : { ...a, to: 0, from: 0 },
          ) as Action[];
          const peers = simulate(solo, [0, 0, 0, 0]);
          const p = peers[0]!;
          expect(JSON.parse(JSON.stringify(p.store.state))).toEqual(
            materialize(p.state),
          );
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('local changes', () => {
  it('turns one command into lines with increasing stamps', () => {
    const peer = new Peer('p0', () => Date.parse('2026-01-01T00:00:00Z'));
    peer.run({
      type: 'createElement',
      class: SAMPLE.task,
      x: 3,
      y: 4,
      attrs: { [SAMPLE.attName]: 'T' },
    });
    const lines = peer.outbox[0]!;
    expect(lines[0]).toMatchObject({
      p: [expect.stringMatching(/^elements$/), expect.stringMatching(/^el_/)],
      b: 1,
    });
    const stamps = lines.map((l) => l.t);
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(stamps.length);
    expect(new HybridClock().latest()).toBeNull();
  });
});
