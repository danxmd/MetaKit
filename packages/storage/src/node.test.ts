import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fromBytes, toBytes } from './adapter';
import { adapterContract } from './contract';
import { AlreadyExistsError, InvalidPathError } from './errors';
import { NodeFsAdapter } from './node';

const folders: string[] = [];
afterEach(async () => {
  for (const f of folders.splice(0))
    await rm(f, { recursive: true, force: true });
});

async function shared() {
  const root = await mkdtemp(join(tmpdir(), 'metakit-storage-'));
  folders.push(root);
  return {
    root,
    one: new NodeFsAdapter(root, 'aaaa0001', { pollIntervalMs: 20 }),
    two: new NodeFsAdapter(root, 'bbbb0002', { pollIntervalMs: 20 }),
  };
}

describe('NodeFsAdapter', () => {
  for (const c of adapterContract()) {
    it(c.name, async () => {
      const s = await shared();
      await c.run({ one: s.one, two: s.two, close: async () => undefined });
    });
  }

  it('lets exactly one of many simultaneous writers create a file', async () => {
    const { one, two } = await shared();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? one : two).writeNew(
          'race/file.json',
          toBytes(`writer ${i}\n`),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results)
      if (r.status === 'rejected')
        expect(r.reason).toBeInstanceOf(AlreadyExistsError);
    expect(fromBytes(await one.read('race/file.json'))).toMatch(
      /^writer \d+\n$/,
    );
  });

  it('leaves no temporary files behind', async () => {
    const { root, one } = await shared();
    await one.writeNew('t/a.json', toBytes('a\n'));
    await expect(one.writeNew('t/a.json', toBytes('b\n'))).rejects.toThrow(
      AlreadyExistsError,
    );
    await one.overwrite(
      `t/_state/${one.instanceId}/snapshot.json`,
      toBytes('1\n'),
    );
    await one.overwrite(
      `t/_state/${one.instanceId}/snapshot.json`,
      toBytes('2\n'),
    );
    const all = await readdir(root, { recursive: true });
    expect(all.filter((n) => n.endsWith('.part'))).toEqual([]);
  });

  it('does not list temporary files that another program left', async () => {
    const { root, one } = await shared();
    await one.writeNew('t/a.json', toBytes('a\n'));
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(root, 't', 'a.json.1234.part'), 'partial');
    expect((await one.list('t')).map((e) => e.name)).toEqual(['a.json']);
  });

  it('checks the instance id', () => {
    expect(() => new NodeFsAdapter('/tmp', 'x')).toThrow(InvalidPathError);
    expect(() => new NodeFsAdapter('/tmp', '../evil')).toThrow(
      InvalidPathError,
    );
    expect(new NodeFsAdapter('/tmp').instanceId).toMatch(/^[0-9a-f]{8}$/);
  });

  it('refuses to read a folder as a file', async () => {
    const { one } = await shared();
    await one.writeNew('t/a.json', toBytes('a\n'));
    await expect(one.read('t')).rejects.toThrow(/no file/);
    expect(await one.exists('t')).toBe(false);
  });
});
