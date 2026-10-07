import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { FormatError } from './errors';
import { unzipFiles, zipFiles } from './zip';

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe('zipFiles and unzipFiles', () => {
  it('round trips text and binary files', () => {
    const bytes = zipFiles({
      'b/two.txt': 'two',
      'a.json': '{"a":1}\n',
      'bin.dat': new Uint8Array([0, 1, 2, 255]),
    });
    const files = unzipFiles(bytes);
    expect(Object.keys(files)).toEqual(['a.json', 'b/two.txt', 'bin.dat']);
    expect(text(files['a.json']!)).toBe('{"a":1}\n');
    expect([...files['bin.dat']!]).toEqual([0, 1, 2, 255]);
  });

  it('gives the same bytes whatever order the files are given in', () => {
    const a = zipFiles({ 'x.txt': 'x', 'y.txt': 'y' });
    const b = zipFiles({ 'y.txt': 'y', 'x.txt': 'x' });
    expect([...a]).toEqual([...b]);
  });

  it('refuses a file that is not a zip', () => {
    const notZip = strToU8('hello, this is not a zip');
    expect(() => unzipFiles(notZip)).toThrow(FormatError);
    expect(() => unzipFiles(notZip)).toThrow(/not a valid zip file/);
  });

  it('refuses a damaged zip', () => {
    const bytes = zipFiles({
      'a.txt': 'some text that is long enough '.repeat(20),
    });
    expect(() => unzipFiles(bytes.slice(0, bytes.length - 30))).toThrow(
      FormatError,
    );
  });

  it.each(['../evil.txt', '/abs.txt', 'a/../../b.txt', 'C:/x.txt', 'a\\b.txt'])(
    'refuses the unsafe name %s',
    (name) => {
      const bytes = zipSync({ [name]: strToU8('x') });
      expect(() => unzipFiles(bytes)).toThrow(/unsafe name/);
    },
  );

  it('refuses more than 2,000 files', () => {
    const many: Record<string, Uint8Array> = {};
    for (let i = 0; i < 2001; i++) many[`f${i}.txt`] = new Uint8Array(0);
    expect(() => unzipFiles(zipSync(many))).toThrow(/more than 2,000 files/);
  });

  it('refuses a zip that would unpack to more than 100 MB', () => {
    // 101 MB of zeros packs to about 100 KB.
    const bomb = zipSync({ 'zeros.bin': new Uint8Array(101 * 1024 * 1024) });
    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(() => unzipFiles(bomb)).toThrow(/more than 100 MB/);
  }, 60_000);

  it('applies the limits it is given', () => {
    const bytes = zipFiles({ 'a.bin': new Uint8Array(3 * 1024 * 1024) });
    expect(() =>
      unzipFiles(bytes, { entries: 10, totalBytes: 2 * 1024 * 1024 }),
    ).toThrow(/more than 2 MB/);
    expect(
      Object.keys(
        unzipFiles(bytes, { entries: 10, totalBytes: 4 * 1024 * 1024 }),
      ),
    ).toEqual(['a.bin']);
  });
});
