import { HttpError, messageOf, type FetchLike } from './http';

/** The branch moved since the commit was built, so the server refused to move it backwards. */
export class NonFastForwardError extends Error {
  constructor(readonly serverMessage: string) {
    super(`GitHub rejected the update as not a fast-forward: ${serverMessage}`);
    this.name = 'NonFastForwardError';
  }
}

export interface TreeEntry {
  path: string;
  sha: string;
  size?: number;
}

export interface FileChange {
  path: string;
  /** Text content. Omit and set `delete` to remove the file. */
  content?: string;
  delete?: boolean;
}

export interface CommitResult {
  commitSha: string;
  treeSha: string;
  parentSha: string;
}

export interface GitHubOptions {
  token: string;
  fetch?: FetchLike;
  baseUrl?: string;
}

/**
 * GitHub REST API from the browser: read a tree, make one commit from many files through the
 * Git data API (blobs, tree, commit, ref), and notice when the branch moved underneath us.
 * Authentication is a fine-grained personal access token in the Authorization header.
 */
export class GitHubClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(private readonly options: GitHubOptions) {
    this.fetchImpl = options.fetch ?? ((...a) => fetch(...a));
    this.baseUrl = options.baseUrl ?? 'https://api.github.com';
  }

  private async api<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) throw new HttpError(response.status, text, method, url);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async getHead(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<{ commitSha: string; treeSha: string }> {
    const ref = await this.api<{ object: { sha: string } }>(
      'GET',
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, '/')}`,
    );
    const commit = await this.api<{ tree: { sha: string } }>(
      'GET',
      `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,
    );
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  }

  /** Every file in the branch, one request. `truncated` is true for very large repositories. */
  async readTree(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<{ commitSha: string; entries: TreeEntry[]; truncated: boolean }> {
    const head = await this.getHead(owner, repo, branch);
    const tree = await this.api<{
      tree: { path: string; type: string; sha: string; size?: number }[];
      truncated: boolean;
    }>('GET', `/repos/${owner}/${repo}/git/trees/${head.treeSha}?recursive=1`);
    return {
      commitSha: head.commitSha,
      truncated: tree.truncated,
      entries: tree.tree
        .filter((e) => e.type === 'blob')
        .map((e) => ({
          path: e.path,
          sha: e.sha,
          ...(e.size === undefined ? {} : { size: e.size }),
        })),
    };
  }

  async createBranch(
    owner: string,
    repo: string,
    name: string,
    fromCommitSha: string,
  ): Promise<void> {
    await this.api('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${name}`,
      sha: fromCommitSha,
    });
  }

  async deleteBranch(owner: string, repo: string, name: string): Promise<void> {
    await this.api('DELETE', `/repos/${owner}/${repo}/git/refs/heads/${name}`);
  }

  /**
   * Builds a commit from `changes` on top of `baseCommitSha` (default: the branch head now) and
   * tries to move the branch to it without force. Throws NonFastForwardError if the branch has
   * moved on in the meantime.
   */
  async commitFiles(args: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    changes: FileChange[];
    baseCommitSha?: string;
  }): Promise<CommitResult> {
    const { owner, repo, branch, message, changes } = args;
    const base = args.baseCommitSha
      ? {
          commitSha: args.baseCommitSha,
          treeSha: (
            await this.api<{ tree: { sha: string } }>(
              'GET',
              `/repos/${owner}/${repo}/git/commits/${args.baseCommitSha}`,
            )
          ).tree.sha,
        }
      : await this.getHead(owner, repo, branch);

    const entries: {
      path: string;
      mode: string;
      type: 'blob';
      sha: string | null;
    }[] = [];
    for (const change of changes) {
      if (change.delete) {
        entries.push({
          path: change.path,
          mode: '100644',
          type: 'blob',
          sha: null,
        });
        continue;
      }
      const blob = await this.api<{ sha: string }>(
        'POST',
        `/repos/${owner}/${repo}/git/blobs`,
        {
          content: change.content ?? '',
          encoding: 'utf-8',
        },
      );
      entries.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }
    const tree = await this.api<{ sha: string }>(
      'POST',
      `/repos/${owner}/${repo}/git/trees`,
      {
        base_tree: base.treeSha,
        tree: entries,
      },
    );
    const commit = await this.api<{ sha: string }>(
      'POST',
      `/repos/${owner}/${repo}/git/commits`,
      {
        message,
        tree: tree.sha,
        parents: [base.commitSha],
      },
    );
    try {
      await this.api(
        'PATCH',
        `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        {
          sha: commit.sha,
          force: false,
        },
      );
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.status === 422 &&
        /fast.?forward/i.test(messageOf(error.body))
      ) {
        throw new NonFastForwardError(messageOf(error.body));
      }
      throw error;
    }
    return {
      commitSha: commit.sha,
      treeSha: tree.sha,
      parentSha: base.commitSha,
    };
  }
}
