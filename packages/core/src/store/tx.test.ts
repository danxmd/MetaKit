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
