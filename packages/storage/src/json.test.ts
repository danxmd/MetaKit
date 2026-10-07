import { describe, expect, it } from 'vitest';
import { toBytes } from './adapter';
import { FormatError, PartialFileError } from './errors';
import { jsonBytes, readJsonFile, stringifyCanonical } from './json';
import { MemoryAdapter } from './memory';

describe('canonical JSON', () => {
  it('sorts keys at every level, indents by two and ends with one newline', () => {
    const text = stringifyCanonical({
      b: 1,
      a: { d: [3, { z: 1, y: 2 }], c: null },
    });
    expect(text).toBe(
      '{\n  "a": {\n    "c": null,\n    "d": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n',
    );
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('gives the same bytes for equal data built in different orders', () => {
    const one = { x: 1, y: { a: 1, b: 2 }, z: [1, 2] };
    const two = { z: [1, 2], y: { b: 2, a: 1 }, x: 1 };
    expect(stringifyCanonical(one)).toBe(stringifyCanonical(two));
    expect(jsonBytes(one)).toEqual(jsonBytes(two));
  });

  it('keeps the order of lists', () => {
    expect(stringifyCanonical([3, 1, 2])).toBe('[\n  3,\n  1,\n  2\n]\n');
  });

  it('is stable when read and written again', () => {
    const text = stringifyCanonical({
      k: { a: [1, 'two', true, null, { n: 1.5 }] },
      ä: 'ü',
    });
    expect(stringifyCanonical(JSON.parse(text))).toBe(text);
  });
});

describe('reading files that may still be arriving', () => {
  it('reads a complete file', async () => {
    const a = new MemoryAdapter();
    a.plant('f.json', '{"a":1}\n');
    expect(await readJsonFile(a, 'f.json')).toEqual({ a: 1 });
  });

  it('retries a file without a final newline until it completes', async () => {
    const a = new MemoryAdapter();
    a.plant('f.json', '{"a":');
    setTimeout(() => a.plant('f.json', '{"a":1}\n'), 60);
    expect(
      await readJsonFile(a, 'f.json', { retries: 10, delayMs: 20 }),
    ).toEqual({ a: 1 });
  });

  it('retries an empty file, which is how a new file first appears', async () => {
    const a = new MemoryAdapter();
    a.plant('f.json', '');
    setTimeout(() => a.plant('f.json', '[1]\n'), 40);
    expect(
      await readJsonFile(a, 'f.json', { retries: 10, delayMs: 20 }),
    ).toEqual([1]);
  });

  it('fails with a clear message when the file never completes', async () => {
    const a = new MemoryAdapter();
    a.plant('f.json', '{"a":');
    await expect(
      readJsonFile(a, 'f.json', { retries: 2, delayMs: 5 }),
    ).rejects.toThrow(PartialFileError);
    await expect(readJsonFile(a, 'f.json', { retries: 0 })).rejects.toThrow(
      /looks incomplete/,
    );
  });

  it('reports a complete file that is not JSON', async () => {
    const a = new MemoryAdapter();
    a.plant('f.json', toBytes('not json\n'));
    await expect(readJsonFile(a, 'f.json')).rejects.toThrow(FormatError);
  });
});
