import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromBase64, toBase64 } from './base64';

describe('base64', () => {
  it('matches the known encodings', () => {
    expect(toBase64('')).toBe('');
    expect(toBase64('f')).toBe('Zg==');
    expect(toBase64('fo')).toBe('Zm8=');
    expect(toBase64('foo')).toBe('Zm9v');
    expect(toBase64('Größe €')).toBe('R3LDtsOfZSDigqw=');
  });

  it('reads back any text', () => {
    fc.assert(
      // Grapheme units are well-formed text; lone surrogates have no UTF-8 form.
      fc.property(fc.string({ unit: 'grapheme' }), (s) => {
        expect(fromBase64(toBase64(s))).toBe(s);
      }),
    );
  });
});
