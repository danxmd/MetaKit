import { HttpError, messageOf, type FetchLike } from './http';

/** A file changed after we last read it, so GitLab refused the stale update. */
export class StaleFileError extends Error {
  constructor(readonly serverMessage: string) {
    super(
      `GitLab rejected an update to a file that changed since it was read: ${serverMessage}`,
    );
    this.name = 'StaleFileError';
  }
}

export interface GitLabFile {
  path: string;
  id: string;
}

export interface GitLabChange {
  path: string;
  action: 'create' | 'update' | 'delete';
  content?: string;
  /** For update and delete: the last commit that touched the file, as read earlier. */
  lastCommitId?: string;
}

export interface GitLabOptions {
  /** A personal access token or an OAuth access token; both go in the same header. */
  token: string;
  fetch?: FetchLike;
  baseUrl?: string;
}

/**
 * GitLab REST API from the browser: read a tree (paginated), make one commit from many file
 * actions, and guard updates with `last_commit_id`.
 */
export class GitLabClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(private readonly options: GitLabOptions) {
    this.fetchImpl = options.fetch ?? ((...a) => fetch(...a));
    this.baseUrl = options.baseUrl ?? 'https://gitlab.com';
  }

  private project(path: string): string {
    return encodeURIComponent(path);
  }

  private async api(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ json: unknown; headers: Headers }> {
    const url = `${this.baseUrl}/api/v4${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        ...(this.options.token
          ? { Authorization: `Bearer ${this.options.token}` }
          : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) throw new HttpError(response.status, text, method, url);
    return {
      json: text ? JSON.parse(text) : undefined,
      headers: response.headers,
    };
  }

  /** Every file in the branch, following the pagination headers. */
  async readTree(
    projectPath: string,
    ref: string,
    options: { maxPages?: number } = {},
  ): Promise<{
    files: GitLabFile[];
    pages: number;
    complete: boolean;
    entries: number;
  }> {
    const files: GitLabFile[] = [];
    let page = '1';
    let pages = 0;
    let entries = 0;
    while (page && pages < (options.maxPages ?? Infinity)) {
      const { json, headers } = await this.api(
        'GET',
        `/projects/${this.project(projectPath)}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${encodeURIComponent(ref)}`,
      );
      pages += 1;
      entries += (json as unknown[]).length;
      for (const entry of json as {
        id: string;
        type: string;
        path: string;
      }[]) {
        if (entry.type === 'blob')
          files.push({ path: entry.path, id: entry.id });
      }
      // X-Next-Page is empty on the last page. It must be exposed to the browser via CORS.
      page = headers.get('x-next-page') ?? '';
    }
    return { files, pages, complete: page === '', entries };
  }

  async getFileLastCommitId(
    projectPath: string,
    filePath: string,
    ref: string,
  ): Promise<string> {
    const { json } = await this.api(
      'GET',
      `/projects/${this.project(projectPath)}/repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
    );
    return (json as { last_commit_id: string }).last_commit_id;
  }

  async createBranch(
    projectPath: string,
    name: string,
    fromRef: string,
  ): Promise<void> {
    await this.api(
      'POST',
      `/projects/${this.project(projectPath)}/repository/branches?branch=${encodeURIComponent(name)}&ref=${encodeURIComponent(fromRef)}`,
    );
  }

  async deleteBranch(projectPath: string, name: string): Promise<void> {
    await this.api(
      'DELETE',
      `/projects/${this.project(projectPath)}/repository/branches/${encodeURIComponent(name)}`,
    );
  }

  /** One commit with all the changes, or none. */
  async commitFiles(args: {
    project: string;
    branch: string;
    message: string;
    changes: GitLabChange[];
  }): Promise<{ commitId: string }> {
    try {
      const { json } = await this.api(
        'POST',
        `/projects/${this.project(args.project)}/repository/commits`,
        {
          branch: args.branch,
          commit_message: args.message,
          actions: args.changes.map((c) => ({
            action: c.action,
            file_path: c.path,
            ...(c.action === 'delete' ? {} : { content: c.content ?? '' }),
            ...(c.lastCommitId ? { last_commit_id: c.lastCommitId } : {}),
          })),
        },
      );
      return { commitId: (json as { id: string }).id };
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.status === 400 &&
        /changed since|last_commit_id|has changed/i.test(messageOf(error.body))
      ) {
        throw new StaleFileError(messageOf(error.body));
      }
      throw error;
    }
  }
}
