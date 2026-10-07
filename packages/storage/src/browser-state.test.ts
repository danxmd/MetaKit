import { describe, expect, it } from 'vitest';
import { getTabInstanceId } from './browser-state';

const fake = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};

describe('getTabInstanceId', () => {
  it('makes an 8 digit hex id once and keeps it for the tab', () => {
    const storage = fake();
    const id = getTabInstanceId(storage);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect(getTabInstanceId(storage)).toBe(id);
  });

  it('gives another tab, with its own storage, another id', () => {
    const ids = new Set(
      Array.from({ length: 20 }, () => getTabInstanceId(fake())),
    );
    expect(ids.size).toBeGreaterThan(15);
  });

  it('replaces a stored value that is not an id', () => {
    const storage = fake();
    storage.setItem('metakit.instanceId', 'not an id');
    expect(getTabInstanceId(storage)).toMatch(/^[0-9a-f]{8}$/);
  });
});
