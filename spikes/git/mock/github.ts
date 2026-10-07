import { createHash, randomBytes } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

/**
 * A small stand-in for the parts of GitHub's Git data API the spike uses, following the
 * documented request and response shapes. It is NOT proof of how github.com behaves; the real
 * run with a throwaway repository is the evidence (see docs/spikes/git.md).
 */
export interface MockGitHub {
  server: Server;
  url: string;
  /** Every request the server saw, for assertions about tokens and headers. */
  requests: {
    method: string;
    url: string;
    auth: string | undefined;
    body: string;
  }[];
  head(branch: string): string | undefined;
  close(): Promise<void>;
}

interface Commit {
  tree: string;
  parents: string[];
  message: string;
}

const sha = (...parts: string[]) =>
  createHash('sha1').update(parts.join('\0')).digest('hex');

export async function startMockGitHub(
  options: { cors?: boolean; token?: RegExp } = {},
): Promise<MockGitHub> {
  const cors = options.cors ?? true;
  const tokenShape = options.token ?? /^(ghp_|github_pat_)/;
  const blobs = new Map<string, string>();
  const trees = new Map<string, Map<string, string>>(); // tree sha -> path -> blob sha
  const commits = new Map<string, Commit>();
  const refs = new Map<string, string>(); // "heads/main" -> commit sha
  const requests: MockGitHub['requests'] = [];

  const emptyTree = sha('tree');
  trees.set(emptyTree, new Map([['README.md', sha('blob', 'hello')]]));
  blobs.set(sha('blob', 'hello'), 'hello');
  const root = sha('commit', 'root');
  commits.set(root, { tree: emptyTree, parents: [], message: 'root' });
  refs.set('heads/main', root);

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

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      ...(cors ? corsHeaders : {}),
    });
    res.end(JSON.stringify(body));
  };

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization,content-type,accept,x-github-api-version',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Expose-Headers': 'ETag,Link,X-RateLimit-Remaining',
  };

  async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const body = await readBody(req);
    const auth = req.headers.authorization;
    requests.push({ method: req.method ?? '', url: req.url ?? '', auth, body });
    if (req.method === 'OPTIONS') {
      res.writeHead(cors ? 204 : 404, cors ? corsHeaders : {});
      res.end();
      return;
    }
    const token = auth?.replace(/^(Bearer|token) /, '');
    if (!token || !tokenShape.test(token))
      return send(res, 401, { message: 'Bad credentials' });

    const route = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/(.*)$/);
    if (!route) return send(res, 404, { message: 'Not Found' });
    const rest = route[3]!;
    const json = body ? (JSON.parse(body) as Record<string, any>) : {}; // eslint-disable-line @typescript-eslint/no-explicit-any -- test double reading arbitrary JSON

    let m: RegExpMatchArray | null;
    if (req.method === 'GET' && (m = rest.match(/^ref\/(.+)$/))) {
      const target = refs.get(m[1]!);
      return target
        ? send(res, 200, {
            ref: `refs/${m[1]}`,
            object: { sha: target, type: 'commit' },
          })
        : send(res, 404, { message: 'Not Found' });
    }
    if (req.method === 'POST' && rest === 'refs') {
      const name = String(json.ref).replace(/^refs\//, '');
      if (refs.has(name))
        return send(res, 422, { message: 'Reference already exists' });
      if (!commits.has(json.sha))
        return send(res, 422, { message: 'Object does not exist' });
      refs.set(name, json.sha);
      return send(res, 201, { ref: json.ref, object: { sha: json.sha } });
    }
    if (req.method === 'PATCH' && (m = rest.match(/^refs\/(.+)$/))) {
      const current = refs.get(m[1]!);
      if (!current)
        return send(res, 422, { message: 'Reference does not exist' });
      if (!commits.has(json.sha))
        return send(res, 422, { message: 'Object does not exist' });
      if (!json.force && !isAncestor(current, json.sha))
        return send(res, 422, { message: 'Update is not a fast forward' });
      refs.set(m[1]!, json.sha);
      return send(res, 200, { ref: `refs/${m[1]}`, object: { sha: json.sha } });
    }
    if (req.method === 'DELETE' && (m = rest.match(/^refs\/(.+)$/))) {
      if (!refs.delete(m[1]!))
        return send(res, 422, { message: 'Reference does not exist' });
      res.writeHead(204, cors ? corsHeaders : {});
      return void res.end();
    }
    if (req.method === 'GET' && (m = rest.match(/^commits\/([0-9a-f]{40})$/))) {
      const commit = commits.get(m[1]!);
      return commit
        ? send(res, 200, {
            sha: m[1],
            tree: { sha: commit.tree },
            parents: commit.parents.map((p) => ({ sha: p })),
            message: commit.message,
          })
        : send(res, 404, { message: 'Not Found' });
    }
    if (req.method === 'POST' && rest === 'commits') {
      if (!trees.has(json.tree))
        return send(res, 422, { message: 'Tree does not exist' });
      for (const parent of json.parents ?? [])
        if (!commits.has(parent))
          return send(res, 422, { message: 'Parent does not exist' });
      const id = sha(
        'commit',
        json.tree,
        (json.parents ?? []).join(','),
        json.message,
        randomBytes(4).toString('hex'),
      );
      commits.set(id, {
        tree: json.tree,
        parents: json.parents ?? [],
        message: json.message,
      });
      return send(res, 201, { sha: id });
    }
    if (req.method === 'GET' && (m = rest.match(/^trees\/([0-9a-f]{40})$/))) {
      const tree = trees.get(m[1]!);
      if (!tree) return send(res, 404, { message: 'Not Found' });
      const entries = [...tree.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
      return send(res, 200, {
        sha: m[1],
        truncated: false,
        tree: entries.map(([path, blob]) => ({
          path,
          mode: '100644',
          type: 'blob',
          sha: blob,
          size: blobs.get(blob)?.length ?? 0,
        })),
      });
    }
    if (req.method === 'POST' && rest === 'blobs') {
      const id = sha('blob', String(json.content));
      blobs.set(id, String(json.content));
      return send(res, 201, { sha: id });
    }
    if (req.method === 'POST' && rest === 'trees') {
      const base = trees.get(json.base_tree);
      if (!base) return send(res, 422, { message: 'base_tree does not exist' });
      const next = new Map(base);
      for (const entry of json.tree as { path: string; sha: string | null }[]) {
        if (entry.sha === null) next.delete(entry.path);
        else if (!blobs.has(entry.sha))
          return send(res, 422, {
            message: `GitRPC::BadObjectState: ${entry.sha}`,
          });
        else next.set(entry.path, entry.sha);
      }
      const id = sha('tree', ...[...next.entries()].sort().flat());
      trees.set(id, next);
      return send(res, 201, { sha: id });
    }
    return send(res, 404, { message: 'Not Found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    requests,
    head: (branch) => refs.get(`heads/${branch}`),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
