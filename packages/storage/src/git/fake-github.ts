import { base64ToBytes, bytesToBase64 } from './content';

/**
 * A stand-in for the parts of GitHub's REST API that GitHubRemote uses, as a `fetch` function, following the
 * documented request and response shapes. It is NOT proof of how github.com answers; the real run
 * (docs/git-oauth-setup.md, "Real-service check") is the evidence. Test helper: not exported
 * from the package.
 */
export interface FakeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface FakeGitHubOptions {
  /** `owner/name` that exists. */
  repo?: string;
  /** Tokens the server accepts. */
  tokens?: string[];
  /** Whether the accepted tokens may write. */
  canWrite?: boolean;
  /** Files at the root of the first commit, as path -> text. */
  files?: Record<string, string>;
  branchPageSize?: number;
  /** Makes trees come back truncated. */
  truncateTrees?: boolean;
}

export interface FakeGitHub {
  fetch: typeof fetch;
  requests: FakeRequest[];
  head(branch: string): string | undefined;
  commitCount(): number;
  /** Text files of a branch, tag or commit as path -> content (binary as base64 under the same path). */
  filesAt(ref: string): Record<string, string>;
  branch(name: string, from?: string): void;
  tag(name: string, commit: string): void;
  /** Another writer commits straight to a branch. Returns the commit. */
  externalCommit(branch: string, files: Record<string, string | null>): string;
  /** Makes every request answer with this status and body (once, or until cleared with null). */
  failWith(
    status: number | null,
    body?: unknown,
    headers?: Record<string, string>,
  ): void;
}

const hex = (input: string): string => {
  // Two independent 32-bit hashes stretched to 40 hex digits; unique enough for a test double.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    a = Math.imul(a ^ input.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b + input.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  let out = '';
  let x = a;
  let y = b;
  while (out.length < 40) {
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
    y = Math.imul(y ^ (y >>> 13), 0x297a2d39) >>> 0;
    out += ((x ^ y) >>> 0).toString(16).padStart(8, '0');
  }
  return out.slice(0, 40);
};

const b64 = (text: string) => bytesToBase64(new TextEncoder().encode(text));

export function createFakeGitHub(options: FakeGitHubOptions = {}): FakeGitHub {
  const repoName = options.repo ?? 'owner/name';
  const tokens = options.tokens ?? [
    'ghp_TESTONLYnotarealtokenABCDEFGH1234567890',
  ];
  const canWrite = options.canWrite ?? true;
  const requests: FakeRequest[] = [];
  const blobs = new Map<string, string>(); // sha -> base64
  const trees = new Map<string, Map<string, string>>(); // sha -> path -> blob sha
  const commits = new Map<string, { tree: string; parents: string[] }>();
  const refs = new Map<string, string>(); // "heads/main" or "tags/v1" -> commit
  let counter = 0;
  let forced: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
  } | null = null;

  const addBlob = (base64: string) => {
    const sha = hex(`blob:${base64}`);
    blobs.set(sha, base64);
    return sha;
  };
  const addTree = (entries: Map<string, string>) => {
    const sha = hex(`tree:${[...entries].sort().join(',')}`);
    trees.set(sha, entries);
    return sha;
  };
  const addCommit = (tree: string, parents: string[]) => {
    const sha = hex(`commit:${tree}:${parents.join(',')}:${counter++}`);
    commits.set(sha, { tree, parents });
    return sha;
  };
  const seed = new Map<string, string>();
  for (const [path, text] of Object.entries(
    options.files ?? { 'README.md': 'hello\n' },
  ))
    seed.set(path, addBlob(b64(text)));
  refs.set('heads/main', addCommit(addTree(seed), []));
  const defaultBranch = 'main';

  const isAncestor = (ancestor: string, of: string): boolean => {
    const stack = [of];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === ancestor) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(commits.get(current)?.parents ?? []));
    }
    return false;
  };

  const resolve = (ref: string): string | undefined =>
    refs.get(`heads/${ref}`) ??
    refs.get(`tags/${ref}`) ??
    (commits.has(ref) ? ref : undefined);

  const filesOf = (commit: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [path, blob] of trees.get(commits.get(commit)!.tree)!) {
      const base64 = blobs.get(blob)!;
      try {
        out[path] = new TextDecoder('utf-8', { fatal: true }).decode(
          base64ToBytes(base64),
        );
      } catch {
        out[path] = base64;
      }
    }
    return out;
  };

  const json = (
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });

  const handle = (
    method: string,
    url: URL,
    headers: Record<string, string>,
    bodyText: string,
  ): Response => {
    const auth = headers['authorization'] ?? '';
    const token = auth.replace(/^Bearer /, '');
    if (!tokens.includes(token))
      return json(401, { message: 'Bad credentials' });
    const route = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
    if (!route) return json(404, { message: 'Not Found' });
    if (
      `${decodeURIComponent(route[1]!)}/${decodeURIComponent(route[2]!)}` !==
      repoName
    )
      return json(404, { message: 'Not Found' });
    if (method !== 'GET' && !canWrite)
      return json(403, {
        message: 'Resource not accessible by personal access token',
      });
    const rest = route[3] ?? '';
    const body = bodyText ? (JSON.parse(bodyText) as Record<string, any>) : {}; // eslint-disable-line @typescript-eslint/no-explicit-any -- test double reading arbitrary JSON
    let m: RegExpMatchArray | null;

    if (method === 'GET' && rest === '')
      return json(200, {
        full_name: repoName,
        default_branch: defaultBranch,
        permissions: { push: canWrite, pull: true },
      });
    if (method === 'GET' && (rest === '/branches' || rest === '/tags')) {
      const kind = rest === '/branches' ? 'heads' : 'tags';
      const all = [...refs]
        .filter(([name]) => name.startsWith(`${kind}/`))
        .map(([name, sha]) => ({
          name: name.slice(kind.length + 1),
          commit: { sha },
        }));
      const per = Math.min(
        Number(url.searchParams.get('per_page') ?? 30),
        options.branchPageSize ?? 100,
      );
      const page = Number(url.searchParams.get('page') ?? 1);
      const next = page * per < all.length;
      const nextUrl = new URL(url);
      nextUrl.searchParams.set('page', String(page + 1));
      nextUrl.searchParams.set('per_page', String(per));
      return json(
        200,
        all.slice((page - 1) * per, page * per),
        next ? { Link: `<${nextUrl.toString()}>; rel="next"` } : {},
      );
    }
    if (method === 'GET' && (m = rest.match(/^\/commits\/(.+)$/))) {
      const sha = resolve(decodeURIComponent(m[1]!));
      if (!sha)
        return json(422, { message: `No commit found for SHA: ${m[1]}` });
      return json(200, {
        sha,
        commit: { tree: { sha: commits.get(sha)!.tree } },
      });
    }
    if (method === 'GET' && (m = rest.match(/^\/git\/ref\/(.+)$/))) {
      const sha = refs.get(decodeURIComponent(m[1]!));
      return sha
        ? json(200, { ref: `refs/${m[1]}`, object: { sha, type: 'commit' } })
        : json(404, { message: 'Not Found' });
    }
    if (method === 'PATCH' && (m = rest.match(/^\/git\/refs\/(.+)$/))) {
      const name = decodeURIComponent(m[1]!);
      const current = refs.get(name);
      if (!current) return json(422, { message: 'Reference does not exist' });
      if (!commits.has(body.sha))
        return json(422, { message: 'Object does not exist' });
      if (!body.force && !isAncestor(current, body.sha))
        return json(422, { message: 'Update is not a fast forward' });
      refs.set(name, body.sha);
      return json(200, { ref: `refs/${name}`, object: { sha: body.sha } });
    }
    if (
      method === 'GET' &&
      (m = rest.match(/^\/git\/commits\/([0-9a-f]{40})$/))
    ) {
      const commit = commits.get(m[1]!);
      return commit
        ? json(200, { sha: m[1], tree: { sha: commit.tree } })
        : json(404, { message: 'Not Found' });
    }
    if (method === 'POST' && rest === '/git/commits') {
      if (!trees.has(body.tree))
        return json(422, { message: 'Tree does not exist' });
      for (const parent of body.parents ?? [])
        if (!commits.has(parent))
          return json(422, { message: 'Parent does not exist' });
      return json(201, { sha: addCommit(body.tree, body.parents ?? []) });
    }
    if (
      method === 'GET' &&
      (m = rest.match(/^\/git\/trees\/([0-9a-f]{40})$/))
    ) {
      const tree = trees.get(m[1]!);
      if (!tree) return json(404, { message: 'Not Found' });
      return json(200, {
        sha: m[1],
        truncated: options.truncateTrees ?? false,
        tree: [...tree]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha })),
      });
    }
    if (method === 'POST' && rest === '/git/trees') {
      const base = trees.get(body.base_tree);
      if (!base) return json(422, { message: 'base_tree does not exist' });
      const next = new Map(base);
      for (const entry of body.tree as { path: string; sha: string | null }[]) {
        if (entry.sha === null) next.delete(entry.path);
        else if (!blobs.has(entry.sha))
          return json(422, { message: `GitRPC::BadObjectState: ${entry.sha}` });
        else next.set(entry.path, entry.sha);
      }
      return json(201, { sha: addTree(next) });
    }
    if (
      method === 'GET' &&
      (m = rest.match(/^\/git\/blobs\/([0-9a-f]{40})$/))
    ) {
      const blob = blobs.get(m[1]!);
      return blob === undefined
        ? json(404, { message: 'Not Found' })
        : json(200, {
            sha: m[1],
            encoding: 'base64',
            content: blob.replace(/(.{60})/g, '$1\n'),
          });
    }
    if (method === 'POST' && rest === '/git/blobs') {
      const content =
        body.encoding === 'base64'
          ? String(body.content)
          : b64(String(body.content));
      return json(201, { sha: addBlob(content) });
    }
    return json(404, { message: 'Not Found' });
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
    head: (branch) => refs.get(`heads/${branch}`),
    commitCount: () => commits.size,
    filesAt: (ref) => filesOf(resolve(ref)!),
    branch: (name, from = 'main') =>
      void refs.set(`heads/${name}`, resolve(from)!),
    tag: (name, commit) => void refs.set(`tags/${name}`, commit),
    externalCommit: (branch, files) => {
      const parent = refs.get(`heads/${branch}`)!;
      const tree = new Map(trees.get(commits.get(parent)!.tree)!);
      for (const [path, content] of Object.entries(files)) {
        if (content === null) tree.delete(path);
        else tree.set(path, addBlob(b64(content)));
      }
      const sha = addCommit(addTree(tree), [parent]);
      refs.set(`heads/${branch}`, sha);
      return sha;
    },
    failWith: (status, body = { message: 'error' }, headers = {}) => {
      forced = status === null ? null : { status, body, headers };
    },
  };
}
