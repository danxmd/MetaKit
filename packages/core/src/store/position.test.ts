import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RandomSource } from '../ids';
import { initialPositions, isPositionKey, positionBetween } from './position';

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

describe('position keys', () => {
  it('makes a first key, and keys before and after it', () => {
    const first = positionBetween(null, null);
    expect(isPositionKey(first)).toBe(true);
    expect(positionBetween(first, null) > first).toBe(true);
    expect(positionBetween(null, first) < first).toBe(true);
  });

  it('refuses an impossible range', () => {
    expect(() => positionBetween('b', 'a')).toThrow(/must sort before/);
    expect(() => positionBetween('a', 'a')).toThrow();
  });

  it('never ends in 0 and only uses its digits', () => {
    expect(isPositionKey('a0')).toBe(false);
    expect(isPositionKey('')).toBe(false);
    expect(isPositionKey('a-b')).toBe(false);
    expect(isPositionKey('aB3')).toBe(true);
  });

  it('inserts between two keys at any depth', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 80 }),
        (seed, moves) => {
          const random = seeded(seed);
          let lo: string | null = null;
          let hi: string | null = null;
          for (const goLow of moves) {
            const key = positionBetween(lo, hi, random);
            expect(isPositionKey(key)).toBe(true);
            if (lo !== null) expect(key > lo).toBe(true);
            if (hi !== null) expect(key < hi).toBe(true);
            // Keep squeezing into the same gap from alternating sides.
            if (goLow) hi = key;
            else lo = key;
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('keeps a sequence of insertions sorted', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(fc.nat(), { minLength: 1, maxLength: 60 }),
        (seed, picks) => {
          const random = seeded(seed);
          const list: string[] = [];
          for (const pick of picks) {
            const at = pick % (list.length + 1);
            list.splice(
              at,
              0,
              positionBetween(list[at - 1] ?? null, list[at] ?? null, random),
            );
          }
          expect([...list].sort()).toEqual(list);
          expect(new Set(list).size).toBe(list.length);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('gives two people inserting into the same gap different keys', () => {
    let clashes = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const a = positionBetween('V', 'W', seeded(seed * 2));
      const b = positionBetween('V', 'W', seeded(seed * 2 + 1));
      if (a === b) clashes += 1;
      expect(a > 'V' && a < 'W').toBe(true);
    }
    expect(clashes).toBe(0);
  });

  it('makes a list of initial keys in order', () => {
    const keys = initialPositions(50);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(50);
  });

  it('stays short when always inserting at the end', () => {
    let key: string | null = null;
    for (let i = 0; i < 1000; i++) key = positionBetween(key, null);
    expect(key!.length).toBeLessThan(400);
  });
});
