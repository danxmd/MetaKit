import {
  encodePath,
  fileFromBase64,
  mapLimit,
  normaliseFolder,
} from './content';
import { Http, messageOf, originOf, type GitRemoteOptions } from './http';
import {
  NonFastForwardError,
  type GitCommitRequest,
  type GitFile,
  type GitRemote,
  type GitSnapshot,
  type GitTag,
} from './remote';

/**
 * GitHub through its REST API (ADR 0007): a fine-grained personal access token in the
 * Authorization header, one commit for many files through blobs, a tree, a commit and a ref
 * update that is never forced.
 */
export class GitHubRemote implements GitRemote {
  private readonly http: Http;
  private readonly api: string;
  private readonly owner: string;
  private readonly name: string;
  private readonly prefix: string;
  private readonly token: string;

  constructor(options: GitRemoteOptions) {
    const [owner, name, ...rest] = options.repo
      .replace(/^\/+|\/+$/g, '')
      .split('/');
    if (!owner || !name || rest.length > 0)
      throw new Error('A GitHub repository is written as owner/name.');
    this.owner = owner;
    this.name = name;
    this.token = options.token;
    this.prefix = normaliseFolder(options.folder);
    this.http = new Http('GitHub', options.token, options.fetch);
    const host = options.host ?? 'github.com';
    this.api =
      host === 'github.com' || host === 'api.github.com'
        ? 'https://api.github.com'
        : `${originOf(host)}/api/v3`;
  }

  private get repoPath(): string {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.name)}`;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private get<T>(path: string, notFound?: string) {
    return this.http.json<T>(
      'GET',
      `${this.api}${path}`,
      this.headers(),
      undefined,
      notFound,
    );
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return (
      await this.http.json<T>(
        'POST',
        `${this.api}${path}`,
        this.headers(),
        body,
      )
    ).data;
  }

  /** All pages of a list, following the `Link: <…>; rel="next"` header. */
  private async paged<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let url: string | null =
      `${this.api}${path}${path.includes('?') ? '&' : '?'}per_page=100`;
    for (let pages = 0; url && pages < 100; pages++) {
      const { data, result } = await this.http.json<T[]>(
        'GET',
        url,
        this.headers(),
      );
      out.push(...data);
      const link: string = result.header('link') ?? '';
      const next: RegExpMatchArray | null = link.match(
        /<([^>]+)>\s*;\s*rel="next"/,
      );
      url = next ? next[1]! : null;
    }
    return out;
  }

  private full(path: string): string {
    return this.prefix ? `${this.prefix}/${path}` : path;
  }

  async listBranches(): Promise<string[]> {
    const { data: repo } = await this.get<{ default_branch: string }>(
      this.repoPath,
    );
    const names = (
      await this.paged<{ name: string }>(`${this.repoPath}/branches`)
    ).map((b) => b.name);
    return [
      repo.default_branch,
      ...names.filter((n) => n !== repo.default_branch),
    ];
  }

  async listTags(): Promise<GitTag[]> {
    const tags = await this.paged<{ name: string; commit: { sha: string } }>(
      `${this.repoPath}/tags`,
    );
    return tags.map((t) => ({ name: t.name, commit: t.commit.sha }));
  }

  async head(branch: string): Promise<string> {
    const { data } = await this.get<{ object: { sha: string } }>(
      `${this.repoPath}/git/ref/heads/${encodePath(branch)}`,
      `The branch "${branch}" was not found in the repository.`,
    );
    return data.object.sha;
  }

  async read(ref: string): Promise<GitSnapshot> {
    const commitResult = await this.http.send(
      'GET',
      `${this.api}${this.repoPath}/commits/${encodePath(ref)}`,
      this.headers(),
    );
    // GitHub answers 422 for a name it cannot resolve to a commit.
    if (commitResult.status === 422)
      this.http.fail(
        'GET',
        { ...commitResult, status: 404 },
        `Nothing called "${ref}" was found in the repository.`,
      );
    if (!commitResult.ok) this.http.fail('GET', commitResult);
    const commit = JSON.parse(commitResult.text) as {
      sha: string;
      commit: { tree: { sha: string } };
    };
    const { data: tree } = await this.get<{
      truncated: boolean;
      tree: { path: string; type: string; sha: string }[];
    }>(`${this.repoPath}/git/trees/${commit.commit.tree.sha}?recursive=1`);
    if (tree.truncated)
      throw new Error(
        'The repository is too large for GitHub to list in one answer. Use a smaller repository for the tool library.',
      );
    const start = this.prefix ? `${this.prefix}/` : '';
    const entries = tree.tree.filter(
      (e) => e.type === 'blob' && e.path.startsWith(start),
    );
    const files = await mapLimit(
      entries,
      6,
      async (entry): Promise<GitFile> => {
        const { data } = await this.get<{ content: string; encoding: string }>(
          `${this.repoPath}/git/blobs/${entry.sha}`,
        );
        return fileFromBase64(entry.path.slice(start.length), data.content);
      },
    );
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return { commit: commit.sha, files };
  }

  async commit(request: GitCommitRequest): Promise<{ commit: string }> {
    if (request.changes.length === 0)
      throw new Error('There is nothing to commit.');
    // Checked first so a stale commit leaves no stray blobs behind in the common case; the
    // non-forced ref update below is what actually guards against a race.
    if ((await this.head(request.branch)) !== request.parent)
      throw new NonFastForwardError();

    const { data: parentCommit } = await this.get<{ tree: { sha: string } }>(
      `${this.repoPath}/git/commits/${request.parent}`,
    );
    const entries = await mapLimit(request.changes, 6, async (change) => {
      const path = this.full(change.path);
      if (change.content === null)
        return { path, mode: '100644', type: 'blob', sha: null };
      const blob = await this.post<{ sha: string }>(
        `${this.repoPath}/git/blobs`,
        {
          content: change.content,
          encoding: change.encoding === 'base64' ? 'base64' : 'utf-8',
        },
      );
      return { path, mode: '100644', type: 'blob', sha: blob.sha };
    });
    const tree = await this.post<{ sha: string }>(
      `${this.repoPath}/git/trees`,
      {
        base_tree: parentCommit.tree.sha,
        tree: entries,
      },
    );
    const commit = await this.post<{ sha: string }>(
      `${this.repoPath}/git/commits`,
      { message: request.message, tree: tree.sha, parents: [request.parent] },
    );
    const update = await this.http.send(
      'PATCH',
      `${this.api}${this.repoPath}/git/refs/heads/${encodePath(request.branch)}`,
      this.headers(),
      { sha: commit.sha, force: false },
    );
    if (!update.ok) {
      if (
        update.status === 422 &&
        /fast.?forward/i.test(messageOf(update.text))
      )
        throw new NonFastForwardError();
      this.http.fail('PATCH', update);
    }
    return { commit: commit.sha };
  }

  async test(): Promise<string> {
    const { data } = await this.get<{
      full_name: string;
      permissions?: { push?: boolean };
    }>(this.repoPath);
    const access =
      data.permissions?.push === true
        ? 'can write'
        : data.permissions?.push === false
          ? 'read only, the token cannot commit'
          : 'write access not confirmed';
    return `${data.full_name}, ${access}`;
  }
}
