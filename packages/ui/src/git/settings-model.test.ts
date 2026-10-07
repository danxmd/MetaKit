import { describe, expect, it } from 'vitest';
import {
  GitAccessError,
  GitHubRemote,
  TokenStore,
  createMemoryKeyValue,
  type GitRemote,
} from '@metakit-app/storage';
import {
  TOKEN_NOTICE,
  checkAccess,
  describeToken,
  draftProblem,
  newDraft,
  normaliseFolder,
  normaliseRepo,
  repoProblem,
  switchService,
  toTarget,
  type MakeRemote,
} from './settings-model';

const TOKEN = 'ghp_TESTONLYnotarealtokenABCDEFGH1234567890';

function fakeRemote(overrides: Partial<GitRemote> = {}): GitRemote {
  return {
    listBranches: async () => ['main', 'dev'],
    listTags: async () => [],
    head: async () => 'abc',
    read: async () => ({
      commit: 'abc',
      files: [
        { path: 'tool.json', content: '{}' },
        { path: 'a.json', content: '{}' },
      ],
    }),
    commit: async () => ({ commit: 'def' }),
    test: async () => 'owner/name, can write',
    ...overrides,
  };
}

async function setup(remote: GitRemote) {
  const store = new TokenStore(createMemoryKeyValue());
  const info = await store.add({ service: 'github', label: 'x', token: TOKEN });
  const calls: unknown[][] = [];
  const makeRemote: MakeRemote = (...args) => {
    calls.push(args);
    return remote;
  };
  return { store, info, makeRemote, calls };
}

describe('form helpers', () => {
  it('starts with the default host and swaps it with the service, but keeps a typed one', () => {
    const draft = newDraft();
    expect(draft).toEqual({
      service: 'github',
      host: 'github.com',
      label: '',
      token: '',
    });
    expect(switchService(draft, 'gitlab').host).toBe('gitlab.com');
    const custom = { ...draft, host: 'git.example.com' };
    expect(switchService(custom, 'gitlab').host).toBe('git.example.com');
  });

  it('checks the form in plain English', () => {
    expect(draftProblem(newDraft())).toBe('Paste the token first.');
    expect(draftProblem({ ...newDraft(), token: 'x', host: ' ' })).toBe(
      'Enter the address of the service.',
    );
    expect(draftProblem({ ...newDraft(), token: 'x', host: 'a b' })).toMatch(
      /spaces/,
    );
    expect(draftProblem({ ...newDraft(), token: 'x' })).toBeNull();
  });

  it('turns pasted addresses into repository names', () => {
    expect(normaliseRepo(' owner/name ')).toBe('owner/name');
    expect(normaliseRepo('https://github.com/owner/name')).toBe('owner/name');
    expect(normaliseRepo('https://github.com/owner/name.git')).toBe(
      'owner/name',
    );
    expect(normaliseRepo('https://github.com/owner/name/tree/main/tools')).toBe(
      'owner/name',
    );
    expect(
      normaliseRepo('https://gitlab.com/group/sub/project/-/tree/main'),
    ).toBe('group/sub/project');
    expect(normaliseRepo('git@github.com:owner/name.git')).toBe('owner/name');
  });

  it('validates repository names per service', () => {
    expect(repoProblem('github', '')).toBe('Enter the repository.');
    expect(repoProblem('github', 'only')).toMatch(/owner\/name/);
    expect(repoProblem('github', 'a/b/c')).toMatch(/owner\/name/);
    expect(repoProblem('github', 'a/b')).toBeNull();
    expect(repoProblem('gitlab', 'a')).toMatch(/full path/);
    expect(repoProblem('gitlab', 'a/b/c')).toBeNull();
    expect(repoProblem('gitlab', 'a//c')).toMatch(/not valid/);
  });

  it('normalises the folder', () => {
    expect(normaliseFolder(' /tools/lib/ ')).toBe('tools/lib');
    expect(normaliseFolder('')).toBe('');
  });

  it('describes a token without its secret and states where tokens stay', async () => {
    const { info } = await setup(fakeRemote());
    expect(describeToken(info)).toBe('GitHub · github.com');
    expect(TOKEN_NOTICE).toMatch(/stay in this browser only/);
  });
});

describe('checkAccess', () => {
  it('reports the repository, the branches and the files in the folder', async () => {
    const { store, info, makeRemote, calls } = await setup(fakeRemote());
    const report = await checkAccess(
      { store, makeRemote },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'owner/name',
        folder: 'tools/lib',
      },
    );
    expect(report).toEqual({
      ok: true,
      text: 'owner/name, can write. Branch main has 2 files in tools/lib.',
      branches: ['main', 'dev'],
      branch: 'main',
      fileCount: 2,
    });
    expect(calls).toEqual([
      ['github', 'github.com', 'owner/name', 'tools/lib', TOKEN],
    ]);
  });

  it('keeps the branch asked for when it exists, and says "repository root" for an empty folder', async () => {
    const { store, info, makeRemote } = await setup(
      fakeRemote({
        read: async () => ({
          commit: 'a',
          files: [{ path: 'x', content: '' }],
        }),
      }),
    );
    const report = await checkAccess(
      { store, makeRemote },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'o/n',
        folder: '',
        branch: 'dev',
      },
    );
    expect(report.branch).toBe('dev');
    expect(report.text).toBe(
      'owner/name, can write. Branch dev has 1 file in the repository root.',
    );
  });

  it('handles a repository with no branches', async () => {
    const { store, info, makeRemote } = await setup(
      fakeRemote({ listBranches: async () => [] }),
    );
    const report = await checkAccess(
      { store, makeRemote },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'o/n',
        folder: '',
      },
    );
    expect(report.ok).toBe(true);
    expect(report.text).toMatch(/no branches yet/);
  });

  it('shows the plain error from the remote and never the token', async () => {
    const { store, info, makeRemote } = await setup(
      fakeRemote({
        test: async () => {
          throw new GitAccessError(`The token was refused (${TOKEN}).`, 401);
        },
      }),
    );
    const report = await checkAccess(
      { store, makeRemote },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'o/n',
        folder: '',
      },
    );
    expect(report.ok).toBe(false);
    expect(report.text).toBe('The token was refused ([token hidden]).');
    expect(JSON.stringify(report)).not.toContain(TOKEN);
  });

  it('cleans a token out of an error from a remote that is not an Error', async () => {
    const { store, info, makeRemote } = await setup(
      fakeRemote({
        test: async () => {
          throw `plain string ${TOKEN}`;
        },
      }),
    );
    const report = await checkAccess(
      { store, makeRemote },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'o/n',
        folder: '',
      },
    );
    expect(report.text).toBe(
      'Something went wrong while contacting the service.',
    );
  });

  it('rejects a bad repository before any request, and a removed token', async () => {
    const { store, info, makeRemote, calls } = await setup(fakeRemote());
    const bad = await checkAccess(
      { store, makeRemote },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'one',
        folder: '',
      },
    );
    expect(bad.text).toMatch(/owner\/name/);
    await store.remove(info.id);
    const gone = await checkAccess(
      { store, makeRemote },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'o/n',
        folder: '',
      },
    );
    expect(gone.text).toBe('That token is no longer saved. Add it again.');
    expect(calls).toEqual([]);
  });

  it('works end to end with the real adapter and a failing network', async () => {
    const { store, info } = await setup(fakeRemote());
    const report = await checkAccess(
      {
        store,
        makeRemote: (_s, host, repo, folder, token) =>
          new GitHubRemote({
            host,
            repo,
            folder,
            token,
            fetch: (() =>
              Promise.reject(new TypeError(`Failed ${TOKEN}`))) as typeof fetch,
          }),
      },
      {
        tokenId: info.id,
        service: 'github',
        host: 'github.com',
        repo: 'o/n',
        folder: '',
      },
    );
    expect(report.ok).toBe(false);
    expect(report.text).toMatch(/Could not reach GitHub/);
    expect(report.text).not.toContain(TOKEN);
  });
});

describe('toTarget', () => {
  it('builds a target without any secret, or null when incomplete', async () => {
    const { info } = await setup(fakeRemote());
    expect(toTarget(info, 'owner/name', 'tools', 'main')).toEqual({
      tokenId: info.id,
      service: 'github',
      host: 'github.com',
      repo: 'owner/name',
      folder: 'tools',
      branch: 'main',
    });
    expect(toTarget(info, 'owner/name', '', '')).toBeNull();
    expect(toTarget(info, 'x', '', 'main')).toBeNull();
    expect(toTarget(undefined, 'owner/name', '', 'main')).toBeNull();
  });
});
