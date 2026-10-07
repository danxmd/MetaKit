import { describe, expect, it } from 'vitest';
import {
  applyPatches,
  CommandError,
  getAt,
  revertPatches,
  setAt,
  Tx,
} from './tx';

const state = Object.freeze({
  a: Object.freeze({ b: 1, c: Object.freeze({ d: 2 }) }),
  e: Object.freeze({ f: 3 }),
});

describe('paths', () => {
  it('reads and writes without touching what is not on the path', () => {
    const next = setAt(state, ['a', 'c', 'd'], 9);
    expect(getAt(next, ['a', 'c', 'd'])).toBe(9);
    expect(getAt(state, ['a', 'c', 'd'])).toBe(2);
    expect(next.e).toBe(state.e);
    expect(next.a.b).toBe(1);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.a)).toBe(true);
  });

  it('returns the same root when nothing changes', () => {
    expect(setAt(state, ['a', 'b'], 1)).toBe(state);
  });

  it('adds and removes entries', () => {
    const added = setAt(state, ['e', 'g'], 4);
    expect(getAt(added, ['e', 'g'])).toBe(4);
    const removed = setAt(added, ['e', 'g'], undefined);
    expect(removed).toEqual(state);
    expect(Object.hasOwn(removed.e, 'g')).toBe(false);
  });

  it('refuses to write through a missing parent', () => {
    expect(() => setAt(state, ['zzz', 'x'], 1)).toThrow(CommandError);
  });

  it('does not read inherited properties', () => {
    expect(getAt(state, ['toString'])).toBeUndefined();
    expect(getAt(state, ['a', 'constructor'])).toBeUndefined();
  });
});

describe('transactions', () => {
  it('records every write and inverts exactly', () => {
    const tx = new Tx(state);
    tx.set(['a', 'b'], 5);
    tx.set(['a', 'new'], { x: [1, 2] });
    tx.remove(['e', 'f']);
    tx.remove(['e', 'missing']);
    expect(tx.patches).toHaveLength(3);
    expect(tx.state).not.toEqual(state);
    expect(revertPatches(tx.state, tx.patches)).toEqual(state);
    expect(applyPatches(state, tx.patches)).toEqual(tx.state);
  });

  it('records nothing when a write changes nothing', () => {
    const tx = new Tx(state);
    tx.set(['a', 'b'], 1);
    tx.set(['a', 'c'], { d: 2 });
    tx.remove(['nothing']);
    expect(tx.patches).toEqual([]);
    expect(tx.state).toBe(state);
  });

  it('copies and freezes what it is given', () => {
    const tx = new Tx(state);
    const value = { list: [1] };
    tx.set(['a', 'v'], value);
    value.list.push(2);
    expect(getAt(tx.state, ['a', 'v'])).toEqual({ list: [1] });
    expect(() => {
      (getAt(tx.state, ['a', 'v']) as { list: number[] }).list.push(3);
    }).toThrow(TypeError);
  });

  it('rejects values that are not plain data', () => {
    const tx = new Tx(state);
    expect(() => tx.set(['a', 'b'], undefined)).toThrow(/plain JSON data/);
    expect(() => tx.set(['a', 'b'], () => 1)).toThrow(/plain JSON data/);
    expect(() => tx.set(['a', 'b'], Number.NaN)).toThrow(/plain JSON data/);
    expect(tx.patches).toHaveLength(0);
  });
});

describe('many writes in one run', () => {
  const big = () => {
    const items: Record<string, { v: number }> = {};
    for (let i = 0; i < 2000; i++) items[`k${i}`] = Object.freeze({ v: i });
    return Object.freeze({
      items: Object.freeze(items),
      other: Object.freeze({ n: 1 }),
    });
  };

  it('leaves the starting state untouched and freezes the result', () => {
    const start = big();
    const tx = new Tx(start);
    for (let i = 0; i < 50; i++) tx.set(['items', `k${i}`, 'v'], -i - 1);
    expect(getAt(tx.view, ['items', 'k3', 'v'])).toBe(-4);
    expect(start.items.k3!.v).toBe(3);
    expect(Object.isFrozen(start.items)).toBe(true);
    const result = tx.state;
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.items)).toBe(true);
    expect(result.other).toBe(start.other);
    expect(getAt(result, ['items', 'k49', 'v'])).toBe(-50);
  });

  it('keeps patches exact when a later write goes into a container written earlier', () => {
    const start = big();
    const tx = new Tx(start);
    tx.set(['items', 'k1', 'v'], 100);
    const mid = tx.state;
    tx.set(['items', 'k2', 'v'], 200);
    // The state handed out earlier does not change under later writes.
    expect(getAt(mid, ['items', 'k2', 'v'])).toBe(2);
    expect(applyPatches(start, tx.patches)).toEqual(tx.state);
    expect(revertPatches(tx.state, tx.patches)).toEqual(start);
  });

  it('records a frozen copy when the value replaced is a container made in this run', () => {
    const tx = new Tx<{ items: Record<string, { v: number }> }>(big());
    tx.set(['items', 'k1', 'v'], 5);
    tx.set(['items'], { k1: { v: 9 } });
    tx.set(['items', 'k1', 'v'], 10);
    const [, replace] = tx.patches;
    expect(Object.isFrozen(replace!.before)).toBe(true);
    expect((replace!.before as Record<string, { v: number }>).k1!.v).toBe(5);
  });
});
