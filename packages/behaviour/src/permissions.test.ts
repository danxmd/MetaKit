import { describe, expect, it } from 'vitest';
import type { KitId } from '@metakit-app/core';
import {
  createPermissionStore,
  describePermissions,
  memoryPermissionBacking,
  type PermissionGrant,
} from './permissions';

const KIT = 'tool_a' as KitId;
const OTHER = 'tool_b' as KitId;

function setup(answers: boolean[]) {
  const asked: { wanted: PermissionGrant; fresh: PermissionGrant }[] = [];
  const backing = memoryPermissionBacking();
  const make = () =>
    createPermissionStore(backing, (_kit, wanted, fresh) => {
      asked.push({ wanted, fresh });
      return Promise.resolve(answers.shift() ?? false);
    });
  return { asked, backing, make };
}

describe('the permission store', () => {
  it('grants nothing at first and asks nothing for a Kit that wants nothing', async () => {
    const { asked, make } = setup([]);
    const store = await make();
    expect(store.granted(KIT)).toEqual({ network: false, files: false });
    expect(await store.request(KIT, {})).toBe(true);
    expect(await store.request(KIT, { network: false })).toBe(true);
    expect(asked).toEqual([]);
  });

  it('asks once, remembers a yes and does not ask again, also in a new session', async () => {
    const { asked, make } = setup([true]);
    const store = await make();
    expect(await store.request(KIT, { network: true })).toBe(true);
    expect(store.granted(KIT)).toEqual({ network: true, files: false });
    expect(await store.request(KIT, { network: true })).toBe(true);
    expect(asked).toHaveLength(1);
    const later = await make();
    expect(later.granted(KIT).network).toBe(true);
    expect(await later.request(KIT, { network: true })).toBe(true);
    expect(asked).toHaveLength(1);
  });

  it('remembers a no and does not ask the same question again', async () => {
    const { asked, make } = setup([false]);
    const store = await make();
    expect(await store.request(KIT, { files: true })).toBe(false);
    expect(await store.request(KIT, { files: true })).toBe(false);
    expect(asked).toHaveLength(1);
    expect(store.granted(KIT).files).toBe(false);
  });

  it('asks again when the Kit wants a permission it did not ask for before, naming only the new one', async () => {
    const { asked, make } = setup([true, true]);
    const store = await make();
    await store.request(KIT, { network: true });
    expect(await store.request(KIT, { network: true, files: true })).toBe(true);
    expect(asked).toHaveLength(2);
    expect(asked[1]).toEqual({
      wanted: { network: true, files: true },
      fresh: { network: false, files: true },
    });
    expect(store.granted(KIT)).toEqual({ network: true, files: true });
  });

  it('keeps what was granted when the person refuses the new permission', async () => {
    const { make } = setup([true, false]);
    const store = await make();
    await store.request(KIT, { network: true });
    expect(await store.request(KIT, { network: true, files: true })).toBe(
      false,
    );
    expect(store.granted(KIT)).toEqual({ network: true, files: false });
  });

  it('keeps Kits apart and shows one dialog for requests made at the same time', async () => {
    const { asked, make } = setup([true, true]);
    const store = await make();
    const [a, b, c] = await Promise.all([
      store.request(KIT, { network: true }),
      store.request(KIT, { network: true }),
      store.request(OTHER, { network: true }),
    ]);
    expect([a, b, c]).toEqual([true, true, true]);
    expect(asked).toHaveLength(2);
    expect(store.granted(OTHER).network).toBe(true);
  });

  it('forgets a Kit so that the next request asks again', async () => {
    const { asked, make } = setup([true, false]);
    const store = await make();
    await store.request(KIT, { files: true });
    await store.forget(KIT);
    expect(store.granted(KIT).files).toBe(false);
    expect(await store.request(KIT, { files: true })).toBe(false);
    expect(asked).toHaveLength(2);
  });

  it('describes what a Kit wants in plain English', () => {
    expect(describePermissions({})).toEqual([]);
    expect(describePermissions({ network: true })[0]).toMatch(/web services/);
    expect(describePermissions({ files: true })[0]).toMatch(/workspace folder/);
    expect(describePermissions({ files: true, network: true })).toHaveLength(2);
  });
});
