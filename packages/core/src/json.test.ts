import { describe, expect, it } from 'vitest';
import { deepEqual, freezeCopy, isJson, whyNotJson } from './json';

describe('json helpers', () => {
  it('accepts plain data', () => {
    expect(isJson({ a: [1, 'x', null, true, { b: 2.5 }] })).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Infinity],
    ['a function', () => 1],
    ['a Date', new Date()],
    ['a Map', new Map()],
    ['a class instance', new (class A {})()],
    ['a symbol', Symbol('x')],
    ['a bigint', 1n],
    ['nested undefined', { a: { b: undefined } }],
    ['undefined in a list', [1, undefined]],
  ])('rejects %s', (_name, value) => {
    expect(whyNotJson(value)).not.toBeNull();
  });

  it('rejects data nested too deeply', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 100; i++) deep = [deep];
    expect(isJson(deep)).toBe(false);
  });

  it('freezes a copy and leaves the original alone', () => {
    const original = { a: { b: [1, 2] } };
    const copy = freezeCopy(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(Object.isFrozen(copy)).toBe(true);
    expect(Object.isFrozen(copy.a.b)).toBe(true);
    expect(Object.isFrozen(original)).toBe(false);
    expect(() => {
      (copy.a.b as number[]).push(3);
    }).toThrow(TypeError);
  });

  it('compares deeply', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });
});
