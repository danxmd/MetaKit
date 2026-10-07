import { describe, expect, it, vi } from 'vitest';
import { createFakeGitHub, type FakeGitHub } from './fake-github';
import { createFakeGitLab, type FakeGitLab } from './fake-gitlab';
import { GitHubRemote } from './github';
import { GitLabRemote } from './gitlab';
import { CONTRACT_SEED, remoteContract } from './remote-contract';
import { GitAccessError, NonFastForwardError, type GitRemote } from './remote';

const GH_TOKEN = 'ghp_TESTONLYnotarealtokenABCDEFGH1234567890';
const GL_TOKEN = 'glpat-TESTONLY-notarealtoken-1234';

const repoFiles = (folder: string): Record<string, string> => ({
  // Files outside the folder must stay untouched; with the whole repository as the folder there are none.
  ...(folder
    ? { 'README.md': 'outside the folder\n', 'other/x.json': '{"other":1}\n' }
    : {}),
  ...Object.fromEntries(
    CONTRACT_SEED.filter((f) => f.encoding !== 'base64').map((f) => [
      folder ? `${folder}/${f.path}` : f.path,
      f.content,
    ]),
  ),
});

function github(folder: string) {
  const fake = createFakeGitHub({ files: repoFiles(folder) });
  return {
    fake,
    remote: new GitHubRemote({
      repo: 'owner/name',
      folder,
      token: GH_TOKEN,
      fetch: fake.fetch,
    }),
  };
}
function gitlab(folder: string) {
  const fake = createFakeGitLab({ files: repoFiles(folder), pageSize: 2 });
  return {
    fake,
    remote: new GitLabRemote({
      repo: 'group/project',
      folder,
      token: GL_TOKEN,
      fetch: fake.fetch,
    }),
  };
}
/** The stand-ins take text, so the binary seed file goes in with a commit of its own. */
async function withBinary(remote: GitRemote): Promise<void> {
  const parent = await remote.head('main');
  await remote.commit({
    branch: 'main',
    parent,
    message: 'Seed binary',
    changes: [
      { path: 'assets/logo.bin', content: 'AAEC/w==', encoding: 'base64' },
    ],
  });
}

for (const folder of ['', 'tools/lib']) {
  remoteContract(`GitHubRemote, folder "${folder}"`, async () => {
    const { fake, remote } = github(folder);
    const base = fake.commitCount();
    await withBinary(remote);
    return { remote, commitCount: () => fake.commitCount() - base };
  });
  remoteContract(`GitLabRemote, folder "${folder}"`, async () => {
    const { fake, remote } = gitlab(folder);
    const base = fake.commitCount();
    await withBinary(remote);
    return { remote, commitCount: () => fake.commitCount() - base };
  });
}

describe.each([
  ['GitHubRemote', 'github'],
  ['GitLabRemote', 'gitlab'],
] as const)('%s behaviour', (_name, kind) => {
  const make = (folder = 'tools/lib', extra: { pageSize?: number } = {}) =>
    kind === 'github'
      ? (() => {
          const fake = createFakeGitHub({
            files: repoFiles(folder),
            branchPageSize: extra.pageSize,
          });
          return {
            fake: fake as FakeGitHub | FakeGitLab,
            remote: new GitHubRemote({
              repo: 'owner/name',
              folder,
              token: GH_TOKEN,
              fetch: fake.fetch,
            }),
          };
        })()
      : (() => {
          const fake = createFakeGitLab({
            files: repoFiles(folder),
            pageSize: extra.pageSize,
          });
          return {
            fake: fake as FakeGitHub | FakeGitLab,
            remote: new GitLabRemote({
              repo: 'group/project',
              folder,
              token: GL_TOKEN,
              fetch: fake.fetch,
            }),
          };
        })();

  it('only reads and writes inside the folder', async () => {
    const { fake, remote } = make();
    const parent = await remote.head('main');
    await remote.commit({
      branch: 'main',
      parent,
      message: 'm',
      changes: [
        { path: 'old.json', content: null },
        { path: 'new.json', content: '{}\n' },
      ],
    });
    const files = fake.filesAt('main');
    expect(files['README.md']).toBe('outside the folder\n');
    expect(files['other/x.json']).toBe('{"other":1}\n');
    expect(files['tools/lib/new.json']).toBe('{}\n');
    expect(files['tools/lib/old.json']).toBeUndefined();
    expect((await remote.read('main')).files.map((f) => f.path)).toEqual([
      'classes/task.json',
      'new.json',
      'tool.json',
    ]);
  });

  it('lists branches over several pages with the default first, and tags', async () => {
    const { fake, remote } = make('tools/lib', { pageSize: 2 });
    for (const n of ['b', 'a', 'c', 'd']) fake.branch(n);
    const head = await remote.head('main');
    fake.tag('v1.0', head);
    fake.tag('v1.1', head);
    fake.tag('v2.0', head);
    const branches = await remote.listBranches();
    expect(branches[0]).toBe('main');
    expect([...branches].sort()).toEqual(['a', 'b', 'c', 'd', 'main']);
    const tags = await remote.listTags();
    expect(tags.map((t) => t.name).sort()).toEqual(['v1.0', 'v1.1', 'v2.0']);
    expect(tags.every((t) => t.commit === head)).toBe(true);
  });

  it('reads a tag and keeps a feature branch apart from main', async () => {
    const { fake, remote } = make();
    const first = await remote.head('main');
    fake.tag('v1', first);
    fake.branch('feature/x');
    const featureHead = await remote.head('feature/x');
    await remote.commit({
      branch: 'feature/x',
      parent: featureHead,
      message: 'on feature',
      changes: [{ path: 'tool.json', content: '{"feature":1}\n' }],
    });
    expect(await remote.head('main')).toBe(first);
    const tagged = await remote.read('v1');
    expect(tagged.commit).toBe(first);
    expect(tagged.files.find((f) => f.path === 'tool.json')!.content).toBe(
      '{"format":4}\n',
    );
  });

  it('refuses a stale parent even when another writer touched a different file', async () => {
    const { fake, remote } = make();
    const base = await remote.head('main');
    const theirs = fake.externalCommit('main', {
      'tools/lib/other-file.json': '{}\n',
    });
    await expect(
      remote.commit({
        branch: 'main',
        parent: base,
        message: 'ours',
        changes: [{ path: 'tool.json', content: '{"ours":1}\n' }],
      }),
    ).rejects.toBeInstanceOf(NonFastForwardError);
    expect(await remote.head('main')).toBe(theirs);
    expect(fake.filesAt('main')['tools/lib/tool.json']).toBe('{"format":4}\n');
  });

  it('refuses nothing-to-commit', async () => {
    const { remote } = make();
    await expect(
      remote.commit({
        branch: 'main',
        parent: await remote.head('main'),
        message: 'm',
        changes: [],
      }),
    ).rejects.toThrow(/nothing to commit/i);
  });

  it('says plainly when a branch does not exist', async () => {
    const { remote } = make();
    await expect(remote.head('nope')).rejects.toThrow(
      /branch "nope" was not found/,
    );
  });

  it('reports a read-only token', async () => {
    const fake =
      kind === 'github'
        ? createFakeGitHub({ canWrite: false })
        : createFakeGitLab({ accessLevel: 20 });
    const remote =
      kind === 'github'
        ? new GitHubRemote({
            repo: 'owner/name',
            folder: '',
            token: GH_TOKEN,
            fetch: fake.fetch,
          })
        : new GitLabRemote({
            repo: 'group/project',
            folder: '',
            token: GL_TOKEN,
            fetch: fake.fetch,
          });
    expect(await remote.test()).toMatch(/read only/);
    const error = await remote
      .commit({
        branch: 'main',
        parent: await remote.head('main'),
        message: 'm',
        changes: [{ path: 'a.json', content: '{}' }],
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitAccessError);
    expect((error as Error).message).toBe(
      'The token cannot write to this repository.',
    );
  });

  it('describes the repository and the permission', async () => {
    const { remote } = make();
    expect(await remote.test()).toBe(
      kind === 'github' ? 'owner/name, can write' : 'group/project, can write',
    );
  });
});

describe('error mapping', () => {
  const remotes = (token: string): { name: string; remote: GitRemote }[] => [
    {
      name: 'GitHub',
      remote: new GitHubRemote({
        repo: 'owner/name',
        folder: '',
        token,
        fetch: createFakeGitHub().fetch,
      }),
    },
    {
      name: 'GitLab',
      remote: new GitLabRemote({
        repo: 'group/project',
        folder: '',
        token,
        fetch: createFakeGitLab().fetch,
      }),
    },
  ];

  it.each(['GitHub', 'GitLab'])(
    '%s: a wrong token is "refused"',
    async (name) => {
      const { remote } = remotes('not-the-token-123').find(
        (r) => r.name === name,
      )!;
      const error = await remote.test().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(GitAccessError);
      expect((error as GitAccessError).status).toBe(401);
      expect((error as Error).message).toMatch(/^The token was refused/);
    },
  );

  it.each([
    [
      'GitHub',
      new GitHubRemote({
        repo: 'someone/else',
        folder: '',
        token: GH_TOKEN,
        fetch: createFakeGitHub().fetch,
      }),
    ],
    [
      'GitLab',
      new GitLabRemote({
        repo: 'someone/else',
        folder: '',
        token: GL_TOKEN,
        fetch: createFakeGitLab().fetch,
      }),
    ],
  ])(
    '%s: a missing repository is "not found or cannot see it"',
    async (_n, remote) => {
      const error = await remote.test().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(GitAccessError);
      expect((error as GitAccessError).status).toBe(404);
      expect((error as Error).message).toBe(
        'The repository was not found or the token cannot see it.',
      );
    },
  );

  it('turns 403 on a read into a read message, and a rate limit into a wait message', async () => {
    const gh = createFakeGitHub();
    const remote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: gh.fetch,
    });
    gh.failWith(403, { message: 'Forbidden' });
    expect(await remote.test().catch((e: Error) => e.message)).toBe(
      'The token cannot read this repository.',
    );
    gh.failWith(
      403,
      { message: 'API rate limit exceeded' },
      { 'x-ratelimit-remaining': '0' },
    );
    expect(await remote.test().catch((e: Error) => e.message)).toMatch(
      /limiting requests/,
    );
  });

  it('describes other failures without the body of the page', async () => {
    const gl = createFakeGitLab();
    const remote = new GitLabRemote({
      repo: 'group/project',
      folder: '',
      token: GL_TOKEN,
      fetch: gl.fetch,
    });
    gl.failWith(500, { message: 'boom' });
    expect(await remote.test().catch((e: Error) => e.message)).toBe(
      'GitLab answered with status 500: boom',
    );
  });

  it('says so when the service cannot be reached', async () => {
    const remote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: (() =>
        Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch,
    });
    expect(await remote.test().catch((e: Error) => e.message)).toMatch(
      /Could not reach GitHub/,
    );
  });

  it('rejects repository names that cannot work', () => {
    expect(
      () => new GitHubRemote({ repo: 'justone', folder: '', token: GH_TOKEN }),
    ).toThrow(/owner\/name/);
    expect(
      () => new GitLabRemote({ repo: 'justone', folder: '', token: GL_TOKEN }),
    ).toThrow(/full path/);
  });
});

describe('hosts', () => {
  it('uses api.github.com for github.com and /api/v3 for an enterprise host', async () => {
    const gh = createFakeGitHub();
    await new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: gh.fetch,
    }).test();
    expect(gh.requests[0]!.url).toBe('https://api.github.com/repos/owner/name');
    const ent = createFakeGitHub();
    await new GitHubRemote({
      host: 'git.example.com',
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: ent.fetch,
    })
      .test()
      .catch(() => undefined);
    expect(ent.requests[0]!.url).toBe(
      'https://git.example.com/api/v3/repos/owner/name',
    );
  });

  it('uses the given GitLab host and encodes the project path once', async () => {
    const gl = createFakeGitLab({ project: 'group/sub/project' });
    const remote = new GitLabRemote({
      host: 'https://gitlab.example.org',
      repo: 'group/sub/project',
      folder: '',
      token: GL_TOKEN,
      fetch: gl.fetch,
    });
    expect(await remote.test()).toBe('group/sub/project, can write');
    expect(gl.requests[0]!.url).toBe(
      'https://gitlab.example.org/api/v4/projects/group%2Fsub%2Fproject',
    );
  });
});

describe('GitLab pagination', () => {
  it('follows X-Next-Page when reading a folder with many files', async () => {
    const files: Record<string, string> = { 'README.md': 'x' };
    for (let i = 0; i < 7; i++) files[`lib/part-${i}.json`] = `{"i":${i}}\n`;
    const fake = createFakeGitLab({ files, pageSize: 3 });
    const remote = new GitLabRemote({
      repo: 'group/project',
      folder: 'lib',
      token: GL_TOKEN,
      fetch: fake.fetch,
    });
    const snapshot = await remote.read('main');
    expect(snapshot.files).toHaveLength(7);
    expect(
      fake.requests.filter((r) => r.url.includes('/repository/tree?')).length,
    ).toBe(3);
    // Only the tool library's folder is listed.
    expect(fake.requests.some((r) => r.url.includes('path=lib'))).toBe(true);
  });

  it('reads an empty folder that does not exist yet as no files', async () => {
    const fake = createFakeGitLab();
    const remote = new GitLabRemote({
      repo: 'group/project',
      folder: 'new-lib',
      token: GL_TOKEN,
      fetch: fake.fetch,
    });
    expect((await remote.read('main')).files).toEqual([]);
    const parent = await remote.head('main');
    await remote.commit({
      branch: 'main',
      parent,
      message: 'first',
      changes: [{ path: 'tool.json', content: '{}\n' }],
    });
    expect(fake.filesAt('main')['new-lib/tool.json']).toBe('{}\n');
  });
});

describe('GitHub details', () => {
  it('uses a non-forced ref update and sends the parent commit', async () => {
    const fake = createFakeGitHub();
    const remote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: fake.fetch,
    });
    const parent = await remote.head('main');
    await remote.commit({
      branch: 'main',
      parent,
      message: 'm',
      changes: [{ path: 'a.json', content: '{}' }],
    });
    const patch = fake.requests.find((r) => r.method === 'PATCH')!;
    expect(JSON.parse(patch.body)).toMatchObject({ force: false });
    const commit = fake.requests.find(
      (r) => r.method === 'POST' && r.url.endsWith('/git/commits'),
    )!;
    expect(JSON.parse(commit.body).parents).toEqual([parent]);
  });

  it('turns a 422 "fast forward" from the ref update into NonFastForwardError (a race after the head check)', async () => {
    const fake = createFakeGitHub();
    const remote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: fake.fetch,
    });
    const parent = await remote.head('main');
    // Another writer wins between our blobs and our ref update.
    const inner = fake.fetch;
    let raced = false;
    const racing = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (!raced && init?.method === 'PATCH') {
        raced = true;
        fake.externalCommit('main', { 'theirs.json': '{}' });
      }
      return inner(input, init);
    }) as typeof fetch;
    const raceRemote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: racing,
    });
    await expect(
      raceRemote.commit({
        branch: 'main',
        parent,
        message: 'm',
        changes: [{ path: 'a.json', content: '{}' }],
      }),
    ).rejects.toBeInstanceOf(NonFastForwardError);
    expect(fake.filesAt('main')['a.json']).toBeUndefined();
    void remote;
  });

  it('refuses a truncated tree with a plain message', async () => {
    const fake = createFakeGitHub({ truncateTrees: true });
    const remote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: fake.fetch,
    });
    await expect(remote.read('main')).rejects.toThrow(/too large/);
  });
});

describe('GitLab details', () => {
  it('sends last_commit_id for updates and deletes, create for new files, and one commit request', async () => {
    const fake = createFakeGitLab();
    const remote = new GitLabRemote({
      repo: 'group/project',
      folder: '',
      token: GL_TOKEN,
      fetch: fake.fetch,
    });
    const parent = await remote.head('main');
    await remote.commit({
      branch: 'main',
      parent,
      message: 'm',
      changes: [
        { path: 'README.md', content: 'changed\n' },
        { path: 'new.json', content: '{}\n' },
        { path: 'gone-already.json', content: null },
      ],
    });
    const posts = fake.requests.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    const actions = JSON.parse(posts[0]!.body).actions as {
      action: string;
      file_path: string;
      last_commit_id?: string;
    }[];
    expect(actions).toEqual([
      {
        action: 'update',
        file_path: 'README.md',
        content: 'changed\n',
        last_commit_id: parent,
      },
      { action: 'create', file_path: 'new.json', content: '{}\n' },
    ]);
  });

  it('turns a stale file reported by the server during the commit into NonFastForwardError, applying nothing', async () => {
    const fake = createFakeGitLab();
    const parent = fake.head('main')!;
    const inner = fake.fetch;
    let raced = false;
    const racing = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (!raced && init?.method === 'POST') {
        raced = true;
        fake.externalCommit('main', { 'README.md': 'theirs\n' });
      }
      return inner(input, init);
    }) as typeof fetch;
    const remote = new GitLabRemote({
      repo: 'group/project',
      folder: '',
      token: GL_TOKEN,
      fetch: racing,
    });
    await expect(
      remote.commit({
        branch: 'main',
        parent,
        message: 'm',
        changes: [
          { path: 'new.json', content: '{}\n' },
          { path: 'README.md', content: 'ours\n' },
        ],
      }),
    ).rejects.toBeInstanceOf(NonFastForwardError);
    expect(fake.filesAt('main')['new.json']).toBeUndefined();
    expect(fake.filesAt('main')['README.md']).toBe('theirs\n');
  });
});

describe('logging', () => {
  it('writes nothing to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const fake = createFakeGitHub();
    const remote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: fake.fetch,
    });
    await remote.commit({
      branch: 'main',
      parent: await remote.head('main'),
      message: 'm',
      changes: [{ path: 'a', content: 'b' }],
    });
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});
