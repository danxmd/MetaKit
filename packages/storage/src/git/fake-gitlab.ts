import { base64ToBytes, bytesToBase64 } from './content';
import type { FakeRequest } from './fake-github';

/**
 * A stand-in for the GitLab endpoints that GitLabRemote uses, as a `fetch` function, following the documented
 * shapes. The wording of the stale-file error is from memory and NOT verified against gitlab.com
 * (docs/git-oauth-setup.md, "Real-service check"). Test helper: not exported from the package.
 */
export interface FakeGitLabOptions {
  /** Full project path that exists. */
  project?: string;
  tokens?: string[];
  /** Access level of the accepted tokens: 30 is Developer (can write), 20 Reporter. */
  accessLevel?: number;
  files?: Record<string, string>;
  /** Largest page the server returns, whatever per_page asks for. */
  pageSize?: number;
}

export interface FakeGitLab {
  fetch: typeof fetch;
  requests: FakeRequest[];
  head(branch: string): string | undefined;
  commitCount(): number;
  filesAt(ref: string): Record<string, string>;
  branch(name: string, from?: string): void;
  tag(name: string, commit: string): void;
  externalCommit(branch: string, files: Record<string, string | null>): string;
  failWith(
    status: number | null,
    body?: unknown,
    headers?: Record<string, string>,
  ): void;
}

interface FileEntry {
  base64: string;
  lastCommit: string;
}
interface Commit {
  parent: string | null;
  files: Map<string, FileEntry>;
}

const b64 = (text: string) => bytesToBase64(new TextEncoder().encode(text));

export function createFakeGitLab(options: FakeGitLabOptions = {}): FakeGitLab {
  const projectName = options.project ?? 'group/project';
  const tokens = options.tokens ?? ['glpat-TESTONLY-notarealtoken-1234'];
  const accessLevel = options.accessLevel ?? 30;
  const requests: FakeRequest[] = [];
  const commits = new Map<string, Commit>();
  const branches = new Map<string, string>();
  const tags = new Map<string, string>();
  let counter = 0;
  let forced: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
  } | null = null;
  const newId = () => (counter++).toString(16).padStart(40, '0');

  const rootId = newId();
  const seed = new Map<string, FileEntry>();
  for (const [path, text] of Object.entries(
    options.files ?? { 'README.md': 'hello\n' },
  ))
    seed.set(path, { base64: b64(text), lastCommit: rootId });
  commits.set(rootId, { parent: null, files: seed });
  branches.set('main', rootId);

  const resolve = (ref: string) =>
    branches.get(ref) ?? tags.get(ref) ?? (commits.has(ref) ? ref : undefined);

  const json = (
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });

  const filesOf = (commit: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [path, entry] of commits.get(commit)!.files) {
      try {
        out[path] = new TextDecoder('utf-8', { fatal: true }).decode(
          base64ToBytes(entry.base64),
        );
      } catch {
        out[path] = entry.base64;
      }
    }
    return out;
  };

  const paged = (url: URL, all: unknown[]) => {
    const per = Math.min(
      Number(url.searchParams.get('per_page') ?? 20),
      options.pageSize ?? 100,
    );
    const page = Number(url.searchParams.get('page') ?? 1);
    const pages = Math.max(1, Math.ceil(all.length / per));
    return json(200, all.slice((page - 1) * per, page * per), {
      'X-Page': String(page),
      'X-Next-Page': page < pages ? String(page + 1) : '',
    });
  };

  const handle = (
    method: string,
    url: URL,
    headers: Record<string, string>,
    bodyText: string,
  ): Response => {
    const token = (headers['authorization'] ?? '').replace(/^Bearer /, '');
    if (!tokens.includes(token))
      return json(401, { message: '401 Unauthorized' });
    const route = url.pathname.match(
      /^\/api\/v4\/projects\/([^/]+)(\/repository\/(.*))?$/,
    );
    if (!route) return json(404, { message: '404 Not Found' });
    if (decodeURIComponent(route[1]!) !== projectName)
      return json(404, { message: '404 Project Not Found' });
    if (!route[2])
      return json(200, {
        path_with_namespace: projectName,
        permissions: {
          project_access: { access_level: accessLevel },
          group_access: null,
        },
      });
    const rest = route[3]!;
    if (method === 'POST' && accessLevel < 30)
      return json(403, { message: '403 Forbidden' });
    let m: RegExpMatchArray | null;

    if (method === 'GET' && rest === 'branches')
      return paged(
        url,
        [...branches].map(([name, id]) => ({
          name,
          default: name === 'main',
          commit: { id },
        })),
      );
    if (method === 'GET' && (m = rest.match(/^branches\/(.+)$/))) {
      const id = branches.get(decodeURIComponent(m[1]!));
      return id
        ? json(200, { name: decodeURIComponent(m[1]!), commit: { id } })
        : json(404, { message: '404 Branch Not Found' });
    }
    if (method === 'GET' && rest === 'tags')
      return paged(
        url,
        [...tags].map(([name, id]) => ({ name, commit: { id } })),
      );
    if (method === 'GET' && (m = rest.match(/^commits\/(.+)$/))) {
      const id = resolve(decodeURIComponent(m[1]!));
      return id
        ? json(200, { id })
        : json(404, { message: '404 Commit Not Found' });
    }
    if (method === 'GET' && rest === 'tree') {
      const id = resolve(url.searchParams.get('ref') ?? 'main');
      if (!id) return json(404, { message: '404 Tree Not Found' });
      const folder = url.searchParams.get('path') ?? '';
      const all = [...commits.get(id)!.files.keys()]
        .filter((p) => !folder || p.startsWith(`${folder}/`))
        .sort()
        .map((path) => ({
          id: path,
          name: path.split('/').pop(),
          type: 'blob',
          path,
        }));
      return paged(url, all);
    }
    if (
      (method === 'GET' || method === 'HEAD') &&
      (m = rest.match(/^files\/(.+)$/))
    ) {
      const path = decodeURIComponent(m[1]!);
      const id = resolve(url.searchParams.get('ref') ?? 'main');
      const file = id ? commits.get(id)!.files.get(path) : undefined;
      if (!file) return json(404, { message: '404 File Not Found' });
      return json(
        200,
        {
          file_path: path,
          last_commit_id: file.lastCommit,
          encoding: 'base64',
          content: file.base64,
        },
        { 'X-Gitlab-Last-Commit-Id': file.lastCommit },
      );
    }
    if (method === 'POST' && rest === 'commits') {
      const body = JSON.parse(bodyText) as {
        branch: string;
        actions: {
          action: string;
          file_path: string;
          content?: string;
          encoding?: string;
          last_commit_id?: string;
        }[];
      };
      const parentId = branches.get(body.branch);
      if (!parentId)
        return json(400, { message: 'A branch called that does not exist' });
      const next = new Map(commits.get(parentId)!.files);
      const id = newId();
      for (const a of body.actions) {
        const existing = next.get(a.file_path);
        if (a.action === 'create') {
          if (existing)
            return json(400, {
              message: 'A file with this name already exists',
            });
        } else if (a.action === 'update' || a.action === 'delete') {
          if (!existing)
            return json(400, {
              message: "A file with this name doesn't exist",
            });
          if (a.last_commit_id && a.last_commit_id !== existing.lastCommit)
            return json(400, {
              message: `You are attempting to ${a.action} a file that has changed since you started editing it`,
            });
        } else
          return json(400, {
            message: 'actions[][action] does not have a valid value',
          });
        if (a.action === 'delete') next.delete(a.file_path);
        else
          next.set(a.file_path, {
            base64:
              a.encoding === 'base64'
                ? (a.content ?? '')
                : b64(a.content ?? ''),
            lastCommit: id,
          });
      }
      commits.set(id, { parent: parentId, files: next });
      branches.set(body.branch, id);
      return json(201, { id, parent_ids: [parentId] });
    }
    return json(404, { message: '404 Not Found' });
  };

  const fakeFetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    );
    const method = init?.method ?? 'GET';
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(
        ([k, v]) => [k.toLowerCase(), v],
      ),
    );
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({ method, url: url.toString(), headers, body });
    if (forced) return json(forced.status, forced.body, forced.headers);
    return handle(method, url, headers, body);
  }) as typeof fetch;

  return {
    fetch: fakeFetch,
    requests,
    head: (branch) => branches.get(branch),
    commitCount: () => commits.size,
    filesAt: (ref) => filesOf(resolve(ref)!),
    branch: (name, from = 'main') => void branches.set(name, resolve(from)!),
    tag: (name, commit) => void tags.set(name, commit),
    externalCommit: (branch, files) => {
      const parent = branches.get(branch)!;
      const next = new Map(commits.get(parent)!.files);
      const id = newId();
      for (const [path, content] of Object.entries(files)) {
        if (content === null) next.delete(path);
        else next.set(path, { base64: b64(content), lastCommit: id });
      }
      commits.set(id, { parent, files: next });
      branches.set(branch, id);
      return id;
    },
    failWith: (status, body = { message: 'error' }, headers = {}) => {
      forced = status === null ? null : { status, body, headers };
    },
  };
}
