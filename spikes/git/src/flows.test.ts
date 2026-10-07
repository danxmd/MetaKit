import { afterEach, describe, expect, it } from 'vitest';
import { startMockGitHub } from '../mock/github';
import { startMockGitLab } from '../mock/gitlab';
import { githubCheck, gitlabCheck } from './flows';
import { GitHubClient } from './github';
import { GitLabClient } from './gitlab';

const GH_TOKEN = 'ghp_TESTONLYnotarealtokenABCDEFGH1234567890';
const GL_TOKEN = 'glpat-TESTONLY-notarealtoken-1234';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

describe('full check against the GitHub mock', () => {
  it('passes every step, refuses the stale update and cleans up', async () => {
    const mock = await startMockGitHub();
    closers.push(mock.close);
    const lines: string[] = [];
    const mainBefore = mock.head('main');
    const result = await githubCheck({
      api: new GitHubClient({ token: GH_TOKEN, baseUrl: mock.url }),
      owner: 'o',
      repo: 'r',
      baseBranch: 'main',
      runId: 't1',
      log: (l) => lines.push(l),
    });
    expect(result.steps.every((s) => s.ok)).toBe(true);
    expect(result.rejectionMessage).toBe('Update is not a fast forward');
    expect(result.rejectionLeftBranchAlone).toBe(true);
    expect(mock.head('metakit-spike/t1')).toBeUndefined();
    // The check works on its own branch and leaves the base branch alone.
    expect(mock.head('main')).toBe(mainBefore);
    expect(lines.join('\n')).not.toContain(GH_TOKEN);
  });

  it('keeps the branch when asked to', async () => {
    const mock = await startMockGitHub();
    closers.push(mock.close);
    await githubCheck({
      api: new GitHubClient({ token: GH_TOKEN, baseUrl: mock.url }),
      owner: 'o',
      repo: 'r',
      baseBranch: 'main',
      runId: 't2',
      log: () => undefined,
      keepBranch: true,
    });
    expect(mock.head('metakit-spike/t2')).toBeDefined();
  });

  it('reports a failing step instead of hiding it', async () => {
    const mock = await startMockGitHub();
    closers.push(mock.close);
    await expect(
      githubCheck({
        api: new GitHubClient({ token: 'bad', baseUrl: mock.url }),
        owner: 'o',
        repo: 'r',
        baseBranch: 'main',
        runId: 't3',
        log: () => undefined,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('full check against the GitLab mock', () => {
  it('passes every step, refuses the stale update atomically and cleans up', async () => {
    const mock = await startMockGitLab();
    closers.push(mock.close);
    const lines: string[] = [];
    const result = await gitlabCheck({
      api: new GitLabClient({ token: GL_TOKEN, baseUrl: mock.url }),
      project: 'group/project',
      baseBranch: 'main',
      runId: 't1',
      log: (l) => lines.push(l),
    });
    expect(result.steps.every((s) => s.ok)).toBe(true);
    expect(result.rejectionMessage).toMatch(/changed since/);
    expect(result.rejectionLeftBranchAlone).toBe(true);
    expect(lines.at(-1)).toContain('deleted branch');
    expect(lines.join('\n')).not.toContain(GL_TOKEN);
  });
});
