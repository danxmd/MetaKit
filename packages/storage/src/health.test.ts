import { describe, expect, it } from 'vitest';
import { toBytes, type StorageAdapter } from './adapter';
import { checkFolderHealth } from './health';
import { MemoryAdapter } from './memory';

function folder() {
  const a = new MemoryAdapter('aaaa0001');
  return a;
}

/** Wraps an adapter so that reading a path advances a fake clock by a given time. */
function slowOn(
  adapter: MemoryAdapter,
  slowPaths: Set<string>,
  clock: { t: number },
  ms: number,
): StorageAdapter {
  return Object.assign(Object.create(adapter) as StorageAdapter, {
    read: async (path: string) => {
      if (slowPaths.has(path)) clock.t += ms;
      return adapter.read(path);
    },
  });
}

const options = (clock: { t: number }) => ({
  clock: () => clock.t,
  now: () => 10_000_000,
});

describe('checkFolderHealth', () => {
  it('finds nothing wrong in a healthy folder', async () => {
    const a = folder();
    a.plant('workspace.json', '{}\n');
    a.plant('models/m/_state/aaaa0001/snapshot.json', '{}\n');
    a.plant('models/m/_state/aaaa0001/000001.jsonl', '{}\n');
    expect(await checkFolderHealth(a, options({ t: 0 }))).toEqual([]);
  });

  it('warns that the folder may be online only when reads are slow, and says what to do', async () => {
    const a = folder();
    a.plant('models/m/_state/aaaa0001/snapshot.json', '{}\n');
    const clock = { t: 0 };
    const findings = await checkFolderHealth(
      slowOn(
        a,
        new Set(['models/m/_state/aaaa0001/snapshot.json']),
        clock,
        3500,
      ),
      options(clock),
    );
    expect(findings.map((f) => f.kind)).toEqual(['slow-read']);
    expect(findings[0]!.message).toMatch(/online only/);
    expect(findings[0]!.message).toMatch(/Always keep on this device/);
  });

  it('names a conflicted copy', async () => {
    const a = folder();
    a.plant('models/m/_state/aaaa0001/000001 (1).jsonl', '{}\n');
    a.plant('models/m/model (conflicted copy 2026-10-07).json', '{}\n');
    const findings = await checkFolderHealth(a, options({ t: 0 }));
    const copies = findings
      .filter((f) => f.kind === 'conflicted-copy')
      .map((f) => f.path);
    expect(copies).toContain(
      'models/m/model (conflicted copy 2026-10-07).json',
    );
    expect(copies).toContain('models/m/_state/aaaa0001/000001 (1).jsonl');
  });

  it('reports empty and unreadable files', async () => {
    const a = folder();
    a.plant('models/m/_state/aaaa0001/000001.jsonl', '');
    a.plant('models/m/_state/aaaa0001/000002.jsonl', '{}\n');
    const broken = Object.assign(Object.create(a) as StorageAdapter, {
      read: async (path: string) => {
        if (path.endsWith('000002.jsonl'))
          throw new Error('The file is not available offline');
        return a.read(path);
      },
    });
    const findings = await checkFolderHealth(broken, options({ t: 0 }));
    expect(findings.map((f) => f.kind).sort()).toEqual([
      'empty-file',
      'unreadable',
    ]);
    expect(findings.find((f) => f.kind === 'unreadable')!.message).toMatch(
      /not available offline/,
    );
  });

  it('calls a file incomplete only when it stayed without its final newline for a while', async () => {
    const a = folder();
    a.plant('models/m/_state/aaaa0001/000001.jsonl', '{"half":');
    // Planted files have a small modified time, far in the past of `now`.
    const findings = await checkFolderHealth(a, options({ t: 0 }));
    expect(findings.map((f) => f.kind)).toEqual(['incomplete-file']);
    const fresh = await checkFolderHealth(a, {
      ...options({ t: 0 }),
      now: () => 5,
    });
    expect(fresh).toEqual([]);
    expect(toBytes('\n')).toHaveLength(1);
  });
});
