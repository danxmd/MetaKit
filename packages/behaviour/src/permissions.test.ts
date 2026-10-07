import { describe, expect, it } from 'vitest';
import type { ToolId } from '@metakit-app/core';
import {
  createPermissionStore,
  describePermissions,
  memoryPermissionBacking,
  type PermissionGrant,
} from './permissions';

const TOOL = 'tool_a' as ToolId;
const OTHER = 'tool_b' as ToolId;

function setup(answers: boolean[]) {
  const asked: { wanted: PermissionGrant; fresh: PermissionGrant }[] = [];
  const backing = memoryPermissionBacking();
  const make = () =>
    createPermissionStore(backing, (_tool, wanted, fresh) => {
      asked.push({ wanted, fresh });
      return Promise.resolve(answers.shift() ?? false);
    });
  return { asked, backing, make };
}

describe('the permission store', () => {
  it('grants nothing at first and asks nothing for a tool that wants nothing', async () => {
    const { asked, make } = setup([]);
    const store = await make();
    expect(store.granted(TOOL)).toEqual({ network: false, files: false });
    expect(await store.request(TOOL, {})).toBe(true);
    expect(await store.request(TOOL, { network: false })).toBe(true);
    expect(asked).toEqual([]);
  });

  it('asks once, remembers a yes and does not ask again, also in a new session', async () => {
    const { asked, make } = setup([true]);
    const store = await make();
    expect(await store.request(TOOL, { network: true })).toBe(true);
    expect(store.granted(TOOL)).toEqual({ network: true, files: false });
    expect(await store.request(TOOL, { network: true })).toBe(true);
    expect(asked).toHaveLength(1);
    const later = await make();
    expect(later.granted(TOOL).network).toBe(true);
    expect(await later.request(TOOL, { network: true })).toBe(true);
    expect(asked).toHaveLength(1);
  });

  it('remembers a no and does not ask the same question again', async () => {
    const { asked, make } = setup([false]);
    const store = await make();
    expect(await store.request(TOOL, { files: true })).toBe(false);
    expect(await store.request(TOOL, { files: true })).toBe(false);
    expect(asked).toHaveLength(1);
    expect(store.granted(TOOL).files).toBe(false);
  });

  it('asks again when the tool wants a permission it did not ask for before, naming only the new one', async () => {
    const { asked, make } = setup([true, true]);
    const store = await make();
    await store.request(TOOL, { network: true });
    expect(await store.request(TOOL, { network: true, files: true })).toBe(
      true,
    );
    expect(asked).toHaveLength(2);
    expect(asked[1]).toEqual({
      wanted: { network: true, files: true },
      fresh: { network: false, files: true },
    });
    expect(store.granted(TOOL)).toEqual({ network: true, files: true });
  });

  it('keeps what was granted when the person refuses the new permission', async () => {
    const { make } = setup([true, false]);
    const store = await make();
    await store.request(TOOL, { network: true });
    expect(await store.request(TOOL, { network: true, files: true })).toBe(
      false,
    );
    expect(store.granted(TOOL)).toEqual({ network: true, files: false });
  });

  it('keeps tools apart and shows one dialog for requests made at the same time', async () => {
    const { asked, make } = setup([true, true]);
    const store = await make();
    const [a, b, c] = await Promise.all([
      store.request(TOOL, { network: true }),
      store.request(TOOL, { network: true }),
      store.request(OTHER, { network: true }),
    ]);
    expect([a, b, c]).toEqual([true, true, true]);
    expect(asked).toHaveLength(2);
    expect(store.granted(OTHER).network).toBe(true);
  });

  it('forgets a tool so that the next request asks again', async () => {
    const { asked, make } = setup([true, false]);
    const store = await make();
    await store.request(TOOL, { files: true });
    await store.forget(TOOL);
    expect(store.granted(TOOL).files).toBe(false);
    expect(await store.request(TOOL, { files: true })).toBe(false);
    expect(asked).toHaveLength(2);
  });

  it('describes what a tool wants in plain English', () => {
    expect(describePermissions({})).toEqual([]);
    expect(describePermissions({ network: true })[0]).toMatch(/web services/);
    expect(describePermissions({ files: true })[0]).toMatch(/workspace folder/);
    expect(describePermissions({ files: true, network: true })).toHaveLength(2);
  });
});
