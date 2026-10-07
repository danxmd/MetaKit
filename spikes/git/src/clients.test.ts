import { afterEach, describe, expect, it } from 'vitest';
import { startMockGitHub, type MockGitHub } from '../mock/github';
import { startMockGitLab, type MockGitLab } from '../mock/gitlab';
import { GitHubClient, NonFastForwardError } from './github';
import { GitLabClient, StaleFileError } from './gitlab';
import { HttpError } from './http';
import {
  buildAuthorizeUrl,
  challengeFor,
  createVerifier,
  exchangeCode,
} from './pkce';
import { Redactor } from './redact';

// A made-up token with the right shape. Real tokens are typed into the page at run time.
const GH_TOKEN = 'ghp_TESTONLYnotarealtokenABCDEFGH1234567890';
const GL_TOKEN = 'glpat-TESTONLY-notarealtoken-1234';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function github(): Promise<{ api: GitHubClient; mock: MockGitHub }> {
  const mock = await startMockGitHub();
  closers.push(mock.close);
  return {
    mock,
    api: new GitHubClient({ token: GH_TOKEN, baseUrl: mock.url }),
  };
}
async function gitlab(
  options?: Parameters<typeof startMockGitLab>[0],
): Promise<{ api: GitLabClient; mock: MockGitLab }> {
  const mock = await startMockGitLab(options);
  closers.push(mock.close);
  return {
    mock,
    api: new GitLabClient({ token: GL_TOKEN, baseUrl: mock.url }),
  };
}

describe('GitHub client', () => {
  it('reads a tree', async () => {
    const { api } = await github();
    const tree = await api.readTree('o', 'r', 'main');
    expect(tree.entries.map((e) => e.path)).toEqual(['README.md']);
    expect(tree.truncated).toBe(false);
  });

  it('commits many files at once and can update and delete in a later commit', async () => {
    const { api, mock } = await github();
    const first = await api.commitFiles({
      owner: 'o',
      repo: 'r',
      branch: 'main',
      message: 'add three',
      changes: [
        { path: 'tool/a.json', content: '{"a":1}\n' },
        { path: 'tool/b.json', content: '{"b":1}\n' },
        { path: 'c.json', content: '{}\n' },
      ],
    });
    expect(mock.head('main')).toBe(first.commitSha);
    expect(
      (await api.readTree('o', 'r', 'main')).entries.map((e) => e.path),
    ).toEqual(['README.md', 'c.json', 'tool/a.json', 'tool/b.json']);

    const second = await api.commitFiles({
      owner: 'o',
      repo: 'r',
      branch: 'main',
      message: 'update, delete, add',
      changes: [
        { path: 'tool/a.json', content: '{"a":2}\n' },
        { path: 'tool/b.json', delete: true },
        { path: 'd.json', content: '{}\n' },
      ],
    });
    expect(second.parentSha).toBe(first.commitSha);
    const paths = (await api.readTree('o', 'r', 'main')).entries.map(
      (e) => e.path,
    );
    expect(paths).toEqual(['README.md', 'c.json', 'd.json', 'tool/a.json']);
  });

  it('detects a rejected non-fast-forward update and leaves the branch alone', async () => {
    const { api, mock } = await github();
    const base = (await api.getHead('o', 'r', 'main')).commitSha;
    // Someone else commits on the same base first.
    const theirs = await api.commitFiles({
      owner: 'o',
      repo: 'r',
      branch: 'main',
      message: 'theirs',
      changes: [{ path: 'x.json', content: '1' }],
      baseCommitSha: base,
    });
    await expect(
      api.commitFiles({
        owner: 'o',
        repo: 'r',
        branch: 'main',
        message: 'ours',
        changes: [{ path: 'y.json', content: '2' }],
        baseCommitSha: base,
      }),
    ).rejects.toBeInstanceOf(NonFastForwardError);
    expect(mock.head('main')).toBe(theirs.commitSha);
  });

  it('works on a new throwaway branch', async () => {
    const { api, mock } = await github();
    const head = (await api.getHead('o', 'r', 'main')).commitSha;
    await api.createBranch('o', 'r', 'metakit-spike/abc', head);
    const result = await api.commitFiles({
      owner: 'o',
      repo: 'r',
      branch: 'metakit-spike/abc',
      message: 'x',
      changes: [{ path: 'a', content: 'b' }],
    });
    expect(mock.head('metakit-spike/abc')).toBe(result.commitSha);
    expect(mock.head('main')).toBe(head);
  });

  it('sends the token only in the Authorization header', async () => {
    const { api, mock } = await github();
    await api.commitFiles({
      owner: 'o',
      repo: 'r',
      branch: 'main',
      message: 'm',
      changes: [{ path: 'a', content: 'b' }],
    });
    expect(mock.requests.length).toBeGreaterThan(5);
    for (const r of mock.requests) {
      expect(r.auth).toBe(`Bearer ${GH_TOKEN}`);
      expect(r.url).not.toContain(GH_TOKEN);
      expect(r.body).not.toContain(GH_TOKEN);
    }
  });

  it('reports a bad token as 401', async () => {
    const mock = await startMockGitHub();
    closers.push(mock.close);
    const api = new GitHubClient({ token: 'nope', baseUrl: mock.url });
    await expect(api.readTree('o', 'r', 'main')).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('GitLab client', () => {
  it('reads a tree across pages using the pagination headers', async () => {
    const { api } = await gitlab({ seedFiles: 7, pageSize: 3 });
    const tree = await api.readTree('group/project', 'main');
    expect(tree.pages).toBe(3);
    expect(tree.files).toHaveLength(7);
    expect(tree.files[0]!.path).toBe('docs/file-000.md');
  });

  it('commits many files in one commit, then updates with last_commit_id', async () => {
    const { api } = await gitlab();
    const created = await api.commitFiles({
      project: 'group/project',
      branch: 'main',
      message: 'add',
      changes: [
        { path: 'tool/a.json', action: 'create', content: '{"a":1}\n' },
        { path: 'tool/b.json', action: 'create', content: '{"b":1}\n' },
      ],
    });
    const last = await api.getFileLastCommitId(
      'group/project',
      'tool/a.json',
      'main',
    );
    expect(last).toBe(created.commitId);
    await api.commitFiles({
      project: 'group/project',
      branch: 'main',
      message: 'update and delete',
      changes: [
        {
          path: 'tool/a.json',
          action: 'update',
          content: '{"a":2}\n',
          lastCommitId: last,
        },
        {
          path: 'tool/b.json',
          action: 'delete',
          lastCommitId: created.commitId,
        },
      ],
    });
    const paths = (await api.readTree('group/project', 'main')).files.map(
      (f) => f.path,
    );
    expect(paths).toContain('tool/a.json');
    expect(paths).not.toContain('tool/b.json');
  });

  it('rejects an update of a file that changed since it was read, and applies nothing', async () => {
    const { api } = await gitlab();
    const stale = await api.getFileLastCommitId(
      'group/project',
      'docs/file-000.md',
      'main',
    );
    await api.commitFiles({
      project: 'group/project',
      branch: 'main',
      message: 'theirs',
      changes: [
        {
          path: 'docs/file-000.md',
          action: 'update',
          content: 'theirs',
          lastCommitId: stale,
        },
      ],
    });
    const before = (await api.readTree('group/project', 'main')).files.length;
    await expect(
      api.commitFiles({
        project: 'group/project',
        branch: 'main',
        message: 'ours',
        changes: [
          { path: 'new.json', action: 'create', content: '{}' },
          {
            path: 'docs/file-000.md',
            action: 'update',
            content: 'ours',
            lastCommitId: stale,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(StaleFileError);
    // All or nothing: the create in the same commit did not happen either.
    expect((await api.readTree('group/project', 'main')).files).toHaveLength(
      before,
    );
  });

  it('sends the token only in the Authorization header and URL-encodes the project path', async () => {
    const { api, mock } = await gitlab();
    await api.readTree('group/sub/project', 'main');
    for (const r of mock.requests) {
      expect(r.auth).toBe(`Bearer ${GL_TOKEN}`);
      expect(r.url).not.toContain(GL_TOKEN);
      expect(r.url).toContain('group%2Fsub%2Fproject');
    }
  });

  it('reports a missing token as 401', async () => {
    const mock = await startMockGitLab();
    closers.push(mock.close);
    await expect(
      new GitLabClient({ token: '', baseUrl: mock.url }).readTree(
        'a/b',
        'main',
      ),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe('OAuth with PKCE', () => {
  it('matches the RFC 7636 example', async () => {
    expect(
      await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('creates verifiers of valid length and alphabet, never the same twice', () => {
    const a = createVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createVerifier()).not.toBe(a);
  });

  it('builds an authorize URL with S256 and no secret', () => {
    const url = new URL(
      buildAuthorizeUrl({
        baseUrl: 'https://gitlab.com',
        clientId: 'cid',
        redirectUri: 'https://x.test/cb',
        state: 's1',
        challenge: 'ch',
      }),
    );
    expect(url.pathname).toBe('/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'cid',
      redirect_uri: 'https://x.test/cb',
      response_type: 'code',
      state: 's1',
      scope: 'api',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    });
  });

  it('exchanges a code for a token with the right verifier, and not with a wrong one', async () => {
    const mock = await startMockGitLab();
    closers.push(mock.close);
    const verifier = createVerifier();
    const challenge = await challengeFor(verifier);
    const { code } = (await (
      await fetch(
        `${mock.url}/__authorize?client_id=cid&code_challenge=${challenge}`,
      )
    ).json()) as { code: string };
    await expect(
      exchangeCode({
        baseUrl: mock.url,
        clientId: 'cid',
        redirectUri: 'https://x.test/cb',
        code,
        verifier: createVerifier(),
      }),
    ).rejects.toThrow(/400/);
    const { code: second } = (await (
      await fetch(
        `${mock.url}/__authorize?client_id=cid&code_challenge=${challenge}`,
      )
    ).json()) as { code: string };
    const token = await exchangeCode({
      baseUrl: mock.url,
      clientId: 'cid',
      redirectUri: 'https://x.test/cb',
      code: second,
      verifier,
    });
    expect(token.token_type).toBe('Bearer');
    const sent = mock.requests.at(-1)!;
    expect(sent.body).toContain('code_verifier=');
    expect(sent.body).not.toContain('client_secret');
  });
});

describe('Redactor', () => {
  it('hides typed tokens and token-shaped strings', () => {
    const r = new Redactor();
    r.add('my-custom-secret-value');
    const text = `a my-custom-secret-value b ${GH_TOKEN} c ${GL_TOKEN} d github_pat_TESTONLYnotarealtoken_abcdefghijklmnopqrstuvwxyz`;
    const clean = r.clean(text);
    for (const secret of [
      'my-custom-secret-value',
      GH_TOKEN,
      GL_TOKEN,
      'github_pat_TESTONLY',
    ])
      expect(clean).not.toContain(secret);
    expect(clean).toContain('[token hidden]');
  });

  it('keeps ordinary text', () => {
    expect(new Redactor().clean('Update is not a fast forward')).toBe(
      'Update is not a fast forward',
    );
  });
});
