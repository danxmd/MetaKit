import { describe, expect, it } from 'vitest';
import { createKitPermissionBacking, getTabInstanceId } from './browser-state';

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

describe('createKitPermissionBacking', () => {
  const memory = () => {
    const map = new Map<string, unknown>();
    return {
      map,
      get: <T>(k: string) => Promise.resolve(map.get(k) as T | undefined),
      set: (k: string, v: unknown) => (map.set(k, v), Promise.resolve()),
    };
  };
  const record = (kitId: string, files = true) => ({
    toolId: kitId,
    granted: { network: false, files },
    asked: { network: false, files: true },
    decidedAt: '2026-10-07T09:00:00.000Z',
  });

  it('saves, loads and removes the decision about a Kit', async () => {
    const backing = createKitPermissionBacking(memory());
    expect(await backing.load()).toEqual([]);
    await backing.save(record('tool_a'));
    await backing.save(record('tool_b', false));
    await backing.save({
      ...record('tool_a'),
      granted: { network: true, files: true },
    });
    expect(
      (await backing.load()).map((r) => [r.toolId, r.granted.network]),
    ).toEqual([
      ['tool_a', true],
      ['tool_b', false],
    ]);
    await backing.remove('tool_a');
    expect((await backing.load()).map((r) => r.toolId)).toEqual(['tool_b']);
  });

  it('ignores damaged entries instead of granting anything from them', async () => {
    const kv = memory();
    kv.map.set('toolPermissions', {
      tool_a: { toolId: 'tool_a', granted: 'yes' },
      tool_b: record('tool_other'),
      tool_c: record('tool_c'),
    });
    expect(
      (await createKitPermissionBacking(kv).load()).map((r) => r.toolId),
    ).toEqual(['tool_c']);
  });
});
