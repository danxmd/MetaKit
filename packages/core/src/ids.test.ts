import { describe, expect, it } from 'vitest';
import { ID_PREFIXES, idKind, isId, newId, type IdKind } from './ids';

describe('ids', () => {
  it('starts with the prefix of the kind', () => {
    for (const kind of Object.keys(ID_PREFIXES) as IdKind[]) {
      const id = newId(kind);
      expect(id.startsWith(`${ID_PREFIXES[kind]}_`)).toBe(true);
      expect(id).toMatch(/^[a-z]+_[0-9a-hjkmnp-tv-z]{10}$/);
      expect(idKind(id)).toBe(kind);
      expect(isId(kind, id)).toBe(true);
    }
  });

  it('does not repeat in 100,000 element ids', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100_000; i++) seen.add(newId('element'));
    expect(seen.size).toBe(100_000);
  });

  it('recognises and rejects ids', () => {
    expect(idKind('el_abc')).toBe('element');
    expect(idKind('zzz_abc')).toBeNull();
    expect(idKind('nounderscore')).toBeNull();
    expect(isId('class', 'cls_')).toBe(false);
    expect(isId('class', 'el_abc')).toBe(false);
    expect(isId('class', 42)).toBe(false);
  });

  it('makes new Kit ids with kit_ and still accepts the older tool_ ids', () => {
    expect(newId('kit')).toMatch(/^kit_/);
    expect(isId('kit', 'kit_abc')).toBe(true);
    expect(isId('kit', 'tool_bpmnlite')).toBe(true);
    expect(idKind('tool_bpmnlite')).toBe('kit');
    expect(idKind('kit_abc')).toBe('kit');
    expect(isId('kit', 'tool_')).toBe(false);
    expect(isId('kit', 'cls_abc')).toBe(false);
    expect(isId('class', 'tool_abc')).toBe(false);
  });

  it('uses the random source it is given', () => {
    const zeros = { getRandomValues: (a: Uint8Array) => a.fill(0) };
    expect(newId('element', zeros)).toBe('el_0000000000');
  });
});
