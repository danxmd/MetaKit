import { fileFromBase64, mapLimit, normaliseFolder } from './content';
import { Http, messageOf, originOf, type GitRemoteOptions } from './http';
import {
  NonFastForwardError,
  type GitCommitRequest,
  type GitFile,
  type GitRemote,
  type GitSnapshot,
  type GitTag,
} from './remote';

interface GitLabAction {
  action: 'create' | 'update' | 'delete';
  file_path: string;
  content?: string;
  encoding?: 'base64';
  last_commit_id?: string;
}

/**
 * GitLab through its REST API (ADR 0007): a personal or OAuth access token, one commit through
 * the commit API with an action per file. GitLab guards updates per file, not per branch, so the
 * branch head is compared first and every update or delete carries `last_commit_id`
 * (spike finding 2).
 */
export class GitLabRemote implements GitRemote {
  private readonly http: Http;
  private readonly api: string;
  private readonly project: string;
  private readonly prefix: string;
  private readonly token: string;

  constructor(options: GitRemoteOptions) {
    const repo = options.repo.replace(/^\/+|\/+$/g, '');
    if (!repo.includes('/'))
      throw new Error(
        'A GitLab project is written with its full path, such as group/project.',
      );
    this.project = encodeURIComponent(repo);
    this.token = options.token;
    this.prefix = normaliseFolder(options.folder);
    this.http = new Http('GitLab', options.token, options.fetch);
    this.api = `${originOf(options.host ?? 'gitlab.com')}/api/v4`;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
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

  /** All pages of a list, following `X-Next-Page` (empty on the last page). */
  private async paged<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let page = '1';
    for (let pages = 0; page && pages < 1000; pages++) {
      const { data, result } = await this.http.json<T[]>(
        'GET',
        `${this.api}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
        this.headers(),
      );
      out.push(...data);
      page = result.header('x-next-page') ?? '';
    }
    return out;
  }

  private full(path: string): string {
    return this.prefix ? `${this.prefix}/${path}` : path;
  }

  private repoPath(rest: string): string {
    return `/projects/${this.project}/repository/${rest}`;
  }

  async listBranches(): Promise<string[]> {
    const branches = await this.paged<{ name: string; default?: boolean }>(
      this.repoPath('branches'),
    );
    return [
      ...branches.filter((b) => b.default),
      ...branches.filter((b) => !b.default),
    ].map((b) => b.name);
  }

  async listTags(): Promise<GitTag[]> {
    const tags = await this.paged<{ name: string; commit: { id: string } }>(
      this.repoPath('tags'),
    );
    return tags.map((t) => ({ name: t.name, commit: t.commit.id }));
  }

  async head(branch: string): Promise<string> {
    const { data } = await this.get<{ commit: { id: string } }>(
      this.repoPath(`branches/${encodeURIComponent(branch)}`),
      `The branch "${branch}" was not found in the repository.`,
    );
    return data.commit.id;
  }

  async read(ref: string): Promise<GitSnapshot> {
    const { data: commit } = await this.get<{ id: string }>(
      this.repoPath(`commits/${encodeURIComponent(ref)}`),
      `Nothing called "${ref}" was found in the repository.`,
    );
    const treePath = this.repoPath(
      `tree?recursive=true&ref=${commit.id}${this.prefix ? `&path=${encodeURIComponent(this.prefix)}` : ''}`,
    );
    let entries: { type: string; path: string }[];
    try {
      entries = await this.paged(treePath);
    } catch (error) {
      // Newer GitLab versions answer 404 for a folder that does not exist yet.
      if (
        error instanceof Error &&
        (error as { status?: number }).status === 404
      )
        entries = [];
      else throw error;
    }
    const start = this.prefix ? `${this.prefix}/` : '';
    const blobs = entries.filter(
      (e) => e.type === 'blob' && e.path.startsWith(start),
    );
    const files = await mapLimit(blobs, 6, async (entry): Promise<GitFile> => {
      const { data } = await this.get<{ content: string }>(
        this.repoPath(
          `files/${encodeURIComponent(entry.path)}?ref=${commit.id}`,
        ),
      );
      return fileFromBase64(entry.path.slice(start.length), data.content);
    });
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return { commit: commit.id, files };
  }

  /** The commit that last touched the file at `ref`, or null when the file does not exist there. */
  private async lastCommitOf(
    path: string,
    ref: string,
  ): Promise<string | null> {
    const result = await this.http.send(
      'HEAD',
      `${this.api}${this.repoPath(`files/${encodeURIComponent(path)}?ref=${ref}`)}`,
      this.headers(),
    );
    if (result.status === 404) return null;
    if (!result.ok) this.http.fail('HEAD', result);
    return result.header('x-gitlab-last-commit-id') ?? '';
  }

  async commit(request: GitCommitRequest): Promise<{ commit: string }> {
    if (request.changes.length === 0)
      throw new Error('There is nothing to commit.');
    if ((await this.head(request.branch)) !== request.parent)
      throw new NonFastForwardError();

    const planned = await mapLimit(
      request.changes,
      6,
      async (change): Promise<GitLabAction | null> => {
        const path = this.full(change.path);
        const last = await this.lastCommitOf(path, request.parent);
        if (change.content === null)
          // Deleting a file that is already gone changes nothing.
          return last === null
            ? null
            : {
                action: 'delete',
                file_path: path,
                ...(last ? { last_commit_id: last } : {}),
              };
        return {
          action: last === null ? 'create' : 'update',
          file_path: path,
          content: change.content,
          ...(change.encoding === 'base64'
            ? { encoding: 'base64' as const }
            : {}),
          ...(last ? { last_commit_id: last } : {}),
        };
      },
    );
    const actions = planned.filter((a): a is GitLabAction => a !== null);
    if (actions.length === 0) throw new Error('There is nothing to commit.');

    const result = await this.http.send(
      'POST',
      `${this.api}${this.repoPath('commits')}`,
      this.headers(),
      {
        branch: request.branch,
        commit_message: request.message,
        actions,
      },
    );
    if (!result.ok) {
      // A file changed between the head check and the commit, or the file set is no longer what
      // the actions assumed. GitLab applies nothing in that case.
      if (
        result.status === 400 &&
        /changed since|last_commit_id|has changed|already exists|doesn't exist|does not exist/i.test(
          messageOf(result.text),
        )
      )
        throw new NonFastForwardError();
      this.http.fail('POST', result);
    }
    return { commit: (JSON.parse(result.text) as { id: string }).id };
  }

  async test(): Promise<string> {
    const { data } = await this.get<{
      path_with_namespace: string;
      permissions?: {
        project_access?: { access_level?: number } | null;
        group_access?: { access_level?: number } | null;
      };
    }>(`/projects/${this.project}`);
    const level = Math.max(
      data.permissions?.project_access?.access_level ?? 0,
      data.permissions?.group_access?.access_level ?? 0,
    );
    const access =
      level >= 30
        ? 'can write'
        : data.permissions
          ? 'read only, the token cannot commit'
          : 'write access not confirmed';
    return `${data.path_with_namespace}, ${access}`;
  }
}
