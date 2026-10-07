import { GitHubClient, NonFastForwardError } from './github';
import { GitLabClient, StaleFileError } from './gitlab';
import { HttpError, messageOf } from './http';

export type Log = (line: string) => void;

export interface FlowResult {
  provider: 'github' | 'gitlab';
  branch: string;
  steps: { name: string; ok: boolean; detail: string }[];
  /** What the server said when a stale update was refused, verbatim. */
  rejectionMessage: string | null;
  /** True when the refused update left the branch untouched. */
  rejectionLeftBranchAlone: boolean;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function describe(error: unknown): string {
  return error instanceof HttpError
    ? `${error.status}: ${messageOf(error.body)}`
    : error instanceof Error
      ? error.message
      : String(error);
}

/**
 * The whole GitHub check on a throwaway branch: multi-file commit, an update/delete/add commit,
 * and a refused non-fast-forward update. The branch is deleted at the end unless asked not to.
 */
export async function githubCheck(args: {
  api: GitHubClient;
  owner: string;
  repo: string;
  baseBranch: string;
  runId: string;
  log: Log;
  keepBranch?: boolean;
}): Promise<FlowResult> {
  const { api, owner, repo, baseBranch, runId, log } = args;
  const branch = `metakit-spike/${runId}`;
  const dir = `metakit-spike/${runId}`;
  const result: FlowResult = {
    provider: 'github',
    branch,
    steps: [],
    rejectionMessage: null,
    rejectionLeftBranchAlone: false,
  };
  const step = async <T>(
    name: string,
    run: () => Promise<T>,
    detail: (v: T) => string,
  ): Promise<T> => {
    try {
      const value = await run();
      result.steps.push({ name, ok: true, detail: detail(value) });
      log(`ok    ${name}: ${detail(value)}`);
      return value;
    } catch (error) {
      result.steps.push({ name, ok: false, detail: describe(error) });
      log(`FAIL  ${name}: ${describe(error)}`);
      throw error;
    }
  };

  try {
    const base = await step(
      'read the base branch',
      () => api.readTree(owner, repo, baseBranch),
      (t) =>
        `${t.entries.length} files, head ${t.commitSha.slice(0, 7)}${t.truncated ? ' (truncated)' : ''}`,
    );
    await step(
      'create the throwaway branch',
      () => api.createBranch(owner, repo, branch, base.commitSha),
      () => branch,
    );
    await step(
      'commit three files in one commit',
      () =>
        api.commitFiles({
          owner,
          repo,
          branch,
          message: 'MetaKit spike: add three files',
          changes: [
            {
              path: `${dir}/a.json`,
              content: json({ id: 'cls_a', name: 'A' }),
            },
            {
              path: `${dir}/b.json`,
              content: json({ id: 'cls_b', name: 'B' }),
            },
            {
              path: `${dir}/nested/c.json`,
              content: json({ id: 'cls_c', name: 'C' }),
            },
          ],
        }),
      (c) => `commit ${c.commitSha.slice(0, 7)} on ${c.parentSha.slice(0, 7)}`,
    );
    await step(
      'commit an update, a delete and an add',
      () =>
        api.commitFiles({
          owner,
          repo,
          branch,
          message: 'MetaKit spike: update, delete, add',
          changes: [
            {
              path: `${dir}/a.json`,
              content: json({ id: 'cls_a', name: 'A renamed' }),
            },
            { path: `${dir}/b.json`, delete: true },
            {
              path: `${dir}/d.json`,
              content: json({ id: 'cls_d', name: 'D' }),
            },
          ],
        }),
      (c) => `commit ${c.commitSha.slice(0, 7)}`,
    );
    await step(
      'read it back',
      async () =>
        (await api.readTree(owner, repo, branch)).entries
          .map((e) => e.path)
          .filter((p) => p.startsWith(dir)),
      (paths) => paths.join(', '),
    );

    // Two writers start from the same commit: the first succeeds, the second must be refused.
    const common = (await api.getHead(owner, repo, branch)).commitSha;
    await step(
      'another writer commits on the current head',
      () =>
        api.commitFiles({
          owner,
          repo,
          branch,
          message: 'MetaKit spike: other writer',
          changes: [{ path: `${dir}/theirs.json`, content: '{}\n' }],
          baseCommitSha: common,
        }),
      (c) => `commit ${c.commitSha.slice(0, 7)}`,
    );
    try {
      await api.commitFiles({
        owner,
        repo,
        branch,
        message: 'MetaKit spike: stale writer',
        changes: [{ path: `${dir}/ours.json`, content: '{}\n' }],
        baseCommitSha: common,
      });
      result.steps.push({
        name: 'stale update is refused',
        ok: false,
        detail: 'the server accepted it',
      });
      log('FAIL  stale update is refused: the server accepted it');
    } catch (error) {
      if (error instanceof NonFastForwardError) {
        result.rejectionMessage = error.serverMessage;
        result.steps.push({
          name: 'stale update is refused',
          ok: true,
          detail: `422: ${error.serverMessage}`,
        });
        log(`ok    stale update is refused: 422: ${error.serverMessage}`);
      } else {
        result.steps.push({
          name: 'stale update is refused',
          ok: false,
          detail: describe(error),
        });
        log(`FAIL  stale update is refused: ${describe(error)}`);
      }
    }
    const afterPaths = (await api.readTree(owner, repo, branch)).entries.map(
      (e) => e.path,
    );
    result.rejectionLeftBranchAlone = !afterPaths.includes(`${dir}/ours.json`);
    log(
      `${result.rejectionLeftBranchAlone ? 'ok   ' : 'FAIL '} the refused file is not in the branch`,
    );
  } finally {
    if (!args.keepBranch) {
      try {
        await api.deleteBranch(owner, repo, branch);
        log(`cleaned up: deleted branch ${branch}`);
      } catch (error) {
        log(
          `could not delete branch ${branch} (${describe(error)}); delete it by hand`,
        );
      }
    }
  }
  return result;
}

/** The same check for GitLab, with `last_commit_id` as the guard against stale updates. */
export async function gitlabCheck(args: {
  api: GitLabClient;
  project: string;
  baseBranch: string;
  runId: string;
  log: Log;
  keepBranch?: boolean;
}): Promise<FlowResult> {
  const { api, project, baseBranch, runId, log } = args;
  const branch = `metakit-spike/${runId}`;
  const dir = `metakit-spike/${runId}`;
  const result: FlowResult = {
    provider: 'gitlab',
    branch,
    steps: [],
    rejectionMessage: null,
    rejectionLeftBranchAlone: false,
  };
  const step = async <T>(
    name: string,
    run: () => Promise<T>,
    detail: (v: T) => string,
  ): Promise<T> => {
    try {
      const value = await run();
      result.steps.push({ name, ok: true, detail: detail(value) });
      log(`ok    ${name}: ${detail(value)}`);
      return value;
    } catch (error) {
      result.steps.push({ name, ok: false, detail: describe(error) });
      log(`FAIL  ${name}: ${describe(error)}`);
      throw error;
    }
  };

  try {
    await step(
      'read the base branch',
      () => api.readTree(project, baseBranch, { maxPages: 3 }),
      (t) =>
        `${t.files.length} files on ${t.pages} page(s)${t.complete ? '' : ', more pages not read'}`,
    );
    await step(
      'create the throwaway branch',
      () => api.createBranch(project, branch, baseBranch),
      () => branch,
    );
    const first = await step(
      'commit three files in one commit',
      () =>
        api.commitFiles({
          project,
          branch,
          message: 'MetaKit spike: add three files',
          changes: [
            {
              path: `${dir}/a.json`,
              action: 'create',
              content: json({ id: 'cls_a', name: 'A' }),
            },
            {
              path: `${dir}/b.json`,
              action: 'create',
              content: json({ id: 'cls_b', name: 'B' }),
            },
            {
              path: `${dir}/nested/c.json`,
              action: 'create',
              content: json({ id: 'cls_c', name: 'C' }),
            },
          ],
        }),
      (c) => `commit ${c.commitId.slice(0, 7)}`,
    );
    const lastA = await step(
      'read the last commit id of a.json',
      () => api.getFileLastCommitId(project, `${dir}/a.json`, branch),
      (id) => id.slice(0, 7),
    );
    await step(
      'commit an update, a delete and an add, guarded by last_commit_id',
      () =>
        api.commitFiles({
          project,
          branch,
          message: 'MetaKit spike: update, delete, add',
          changes: [
            {
              path: `${dir}/a.json`,
              action: 'update',
              content: json({ id: 'cls_a', name: 'A renamed' }),
              lastCommitId: lastA,
            },
            {
              path: `${dir}/b.json`,
              action: 'delete',
              lastCommitId: first.commitId,
            },
            {
              path: `${dir}/d.json`,
              action: 'create',
              content: json({ id: 'cls_d', name: 'D' }),
            },
          ],
        }),
      (c) => `commit ${c.commitId.slice(0, 7)}`,
    );
    await step(
      'read it back',
      async () =>
        (await api.readTree(project, branch, { maxPages: 3 })).files
          .map((f) => f.path)
          .filter((p) => p.startsWith(dir)),
      (paths) => paths.join(', '),
    );

    // a.json changed in the commit above, so `lastA` is now stale.
    try {
      await api.commitFiles({
        project,
        branch,
        message: 'MetaKit spike: stale writer',
        changes: [
          { path: `${dir}/ours.json`, action: 'create', content: '{}\n' },
          {
            path: `${dir}/a.json`,
            action: 'update',
            content: json({ id: 'cls_a', name: 'stale' }),
            lastCommitId: lastA,
          },
        ],
      });
      result.steps.push({
        name: 'stale update is refused',
        ok: false,
        detail: 'the server accepted it',
      });
      log('FAIL  stale update is refused: the server accepted it');
    } catch (error) {
      if (error instanceof StaleFileError) {
        result.rejectionMessage = error.serverMessage;
        result.steps.push({
          name: 'stale update is refused',
          ok: true,
          detail: `400: ${error.serverMessage}`,
        });
        log(`ok    stale update is refused: 400: ${error.serverMessage}`);
      } else {
        result.steps.push({
          name: 'stale update is refused',
          ok: false,
          detail: describe(error),
        });
        log(`FAIL  stale update is refused: ${describe(error)}`);
      }
    }
    const afterPaths = (
      await api.readTree(project, branch, { maxPages: 3 })
    ).files.map((f) => f.path);
    result.rejectionLeftBranchAlone = !afterPaths.includes(`${dir}/ours.json`);
    log(
      `${result.rejectionLeftBranchAlone ? 'ok   ' : 'FAIL '} nothing from the refused commit is in the branch`,
    );
  } finally {
    if (!args.keepBranch) {
      try {
        await api.deleteBranch(project, branch);
        log(`cleaned up: deleted branch ${branch}`);
      } catch (error) {
        log(
          `could not delete branch ${branch} (${describe(error)}); delete it by hand`,
        );
      }
    }
  }
  return result;
}
