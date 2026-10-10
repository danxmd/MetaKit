import { describe, expect, it } from 'vitest';
import { NonFastForwardError, type GitFile, type GitRemote } from './remote';

/**
 * What every `GitRemote` must do, whatever it talks to. Run it against each adapter and against
 * the in-memory remote. Test helper: imported by test files, not exported from the package.
 */
export interface RemoteFixture {
  remote: GitRemote;
  /** How many commits the repository has, when the fixture can count them. */
  commitCount?: () => number;
}

/** The files the fixture must hold at the head of its default branch, inside the Kit folder. */
export const CONTRACT_SEED: readonly GitFile[] = [
  { path: 'tool.json', content: '{"format":4}\n' },
  { path: 'classes/task.json', content: '{"key":"Task"}\n' },
  { path: 'old.json', content: '{"old":true}\n' },
  { path: 'assets/logo.bin', content: 'AAEC/w==', encoding: 'base64' },
];

const byPath = (files: GitFile[]) =>
  [...files].sort((a, b) => (a.path < b.path ? -1 : 1));

export function remoteContract(
  name: string,
  makeRemote: (
    seed: readonly GitFile[],
  ) => Promise<RemoteFixture> | RemoteFixture,
): void {
  describe(`GitRemote contract: ${name}`, () => {
    it('lists the default branch first', async () => {
      const { remote } = await makeRemote(CONTRACT_SEED);
      const branches = await remote.listBranches();
      expect(branches.length).toBeGreaterThan(0);
      expect(branches[0]).toBe('main');
    });

    it('reads the files of the folder and names the commit', async () => {
      const { remote } = await makeRemote(CONTRACT_SEED);
      const head = await remote.head('main');
      const snapshot = await remote.read('main');
      expect(snapshot.commit).toBe(head);
      expect(snapshot.files).toEqual(byPath([...CONTRACT_SEED]));
      expect((await remote.read(head)).files).toEqual(snapshot.files);
    });

    it('makes one commit for an update, an addition in a subfolder and a deletion', async () => {
      const { remote, commitCount } = await makeRemote(CONTRACT_SEED);
      const before = commitCount?.();
      const parent = await remote.head('main');
      const { commit } = await remote.commit({
        branch: 'main',
        parent,
        message: 'Change three files',
        changes: [
          { path: 'tool.json', content: '{"format":5}\n' },
          { path: 'shapes/box.json', content: '{"box":1}\n' },
          { path: 'old.json', content: null },
        ],
      });
      expect(commit).not.toBe(parent);
      expect(await remote.head('main')).toBe(commit);
      if (before !== undefined) expect(commitCount!()).toBe(before + 1);
      const after = await remote.read('main');
      expect(after.commit).toBe(commit);
      expect(after.files.map((f) => f.path)).toEqual([
        'assets/logo.bin',
        'classes/task.json',
        'shapes/box.json',
        'tool.json',
      ]);
      expect(after.files.find((f) => f.path === 'tool.json')!.content).toBe(
        '{"format":5}\n',
      );
    });

    it('keeps text as text and binary as base64', async () => {
      const { remote } = await makeRemote(CONTRACT_SEED);
      const parent = await remote.head('main');
      await remote.commit({
        branch: 'main',
        parent,
        message: 'Add files',
        changes: [
          { path: 'a/ünï.json', content: '{"t":"héllo ✓"}\n' },
          { path: 'a/b.bin', content: '/+8AAQ==', encoding: 'base64' },
        ],
      });
      const files = (await remote.read('main')).files;
      expect(files.find((f) => f.path === 'a/ünï.json')).toEqual({
        path: 'a/ünï.json',
        content: '{"t":"héllo ✓"}\n',
      });
      expect(files.find((f) => f.path === 'a/b.bin')).toEqual({
        path: 'a/b.bin',
        content: '/+8AAQ==',
        encoding: 'base64',
      });
    });

    it('refuses a commit on a stale parent and changes nothing', async () => {
      const { remote, commitCount } = await makeRemote(CONTRACT_SEED);
      const base = await remote.head('main');
      const theirs = await remote.commit({
        branch: 'main',
        parent: base,
        message: 'First writer',
        changes: [{ path: 'theirs.json', content: '{}\n' }],
      });
      const count = commitCount?.();
      const error = await remote
        .commit({
          branch: 'main',
          parent: base,
          message: 'Second writer',
          changes: [
            { path: 'ours.json', content: '{}\n' },
            { path: 'tool.json', content: '{"ours":1}\n' },
          ],
        })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NonFastForwardError);
      expect(await remote.head('main')).toBe(theirs.commit);
      if (count !== undefined) expect(commitCount!()).toBe(count);
      const files = (await remote.read('main')).files;
      expect(files.map((f) => f.path)).not.toContain('ours.json');
      expect(files.find((f) => f.path === 'tool.json')!.content).toBe(
        '{"format":4}\n',
      );
    });

    it('reads an older commit as it was', async () => {
      const { remote } = await makeRemote(CONTRACT_SEED);
      const first = await remote.head('main');
      await remote.commit({
        branch: 'main',
        parent: first,
        message: 'Change',
        changes: [{ path: 'tool.json', content: '{"format":9}\n' }],
      });
      const old = await remote.read(first);
      expect(old.commit).toBe(first);
      expect(old.files.find((f) => f.path === 'tool.json')!.content).toBe(
        '{"format":4}\n',
      );
    });

    it('describes the access when tested', async () => {
      const { remote } = await makeRemote(CONTRACT_SEED);
      expect((await remote.test()).length).toBeGreaterThan(0);
    });
  });
}
