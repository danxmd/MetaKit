import { createHash, randomBytes } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

/**
 * A small stand-in for the GitLab endpoints the spike uses, following the documented shapes.
 * The wording of the stale-file error is taken from memory of GitLab's messages and is NOT
 * verified against gitlab.com; the real run shows the real text (see docs/spikes/git.md).
 */
export interface MockGitLab {
  server: Server;
  url: string;
  requests: {
    method: string;
    url: string;
    auth: string | undefined;
    body: string;
  }[];
  close(): Promise<void>;
}

interface Commit {
  parent: string | null;
  files: Map<string, { content: string; lastCommit: string }>;
}

const id = (...p: string[]) =>
  createHash('sha1').update(p.join('\0')).digest('hex');

export async function startMockGitLab(
  options: { cors?: boolean; pageSize?: number; seedFiles?: number } = {},
): Promise<MockGitLab> {
  const cors = options.cors ?? true;
  const commits = new Map<string, Commit>();
  const branches = new Map<string, string>();
  const requests: MockGitLab['requests'] = [];
  const codes = new Map<string, { challenge: string; clientId: string }>();

  const seed = new Map<string, { content: string; lastCommit: string }>();
  const rootId = id('root');
  for (let i = 0; i < (options.seedFiles ?? 5); i++)
    seed.set(`docs/file-${String(i).padStart(3, '0')}.md`, {
      content: `file ${i}`,
      lastCommit: rootId,
    });
  commits.set(rootId, { parent: null, files: seed });
  branches.set('main', rootId);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type,private-token',
    'Access-Control-Allow-Methods':
      'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers':
      'Link, X-Total, X-Total-Pages, X-Per-Page, X-Page, X-Next-Page, X-Prev-Page, X-Gitlab-Last-Commit-Id',
  };
  const send = (
    res: ServerResponse,
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
  ) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      ...(cors ? corsHeaders : {}),
      ...headers,
    });
    res.end(JSON.stringify(body));
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

    // OAuth: the authorisation step is a browser navigation, so only the token endpoint is mocked.
    if (url.pathname === '/oauth/authorize') {
      // What the real authorize page does after sign-in: send the browser back with a code.
      const q = url.searchParams;
      if (q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge'))
        return send(res, 400, { error: 'invalid_request' });
      const code = randomBytes(6).toString('hex');
      codes.set(code, {
        challenge: q.get('code_challenge') ?? '',
        clientId: q.get('client_id') ?? '',
      });
      const back = new URL(q.get('redirect_uri') ?? '');
      back.searchParams.set('code', code);
      back.searchParams.set('state', q.get('state') ?? '');
      res.writeHead(302, { Location: back.toString() });
      return void res.end();
    }
    if (url.pathname === '/__authorize') {
      // Test helper: registers a code for a challenge, as the real authorize endpoint would.
      const q = url.searchParams;
      const code = randomBytes(6).toString('hex');
      codes.set(code, {
        challenge: q.get('code_challenge') ?? '',
        clientId: q.get('client_id') ?? '',
      });
      return send(res, 200, { code });
    }
    if (url.pathname === '/oauth/token' && req.method === 'POST') {
      const form = new URLSearchParams(body);
      const entry = codes.get(form.get('code') ?? '');
      if (!entry || entry.clientId !== form.get('client_id'))
        return send(res, 400, { error: 'invalid_grant' });
      const verifier = form.get('code_verifier') ?? '';
      const challenge = createHash('sha256')
        .update(verifier)
        .digest('base64url');
      if (challenge !== entry.challenge)
        return send(res, 400, {
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        });
      codes.delete(form.get('code')!);
      return send(res, 200, {
        access_token: `glpat-oauth-${randomBytes(12).toString('hex')}`,
        token_type: 'Bearer',
        expires_in: 7200,
      });
    }

    const token =
      auth?.replace(/^Bearer /, '') ??
      (req.headers['private-token'] as string | undefined);
    if (!token) return send(res, 401, { message: '401 Unauthorized' });

    const route = url.pathname.match(
      /^\/api\/v4\/projects\/([^/]+)\/repository\/(.*)$/,
    );
    if (!route) return send(res, 404, { message: '404 Not Found' });
    const rest = route[2]!;
    const branchOf = (name: string) => branches.get(name);
    const filesAt = (branch: string) =>
      commits.get(branches.get(branch) ?? '')?.files;
    let m: RegExpMatchArray | null;

    if (req.method === 'GET' && rest === 'tree') {
      const files = filesAt(url.searchParams.get('ref') ?? 'main');
      if (!files) return send(res, 404, { message: '404 Tree Not Found' });
      const all = [...files.keys()].sort().map((path) => ({
        id: id('blob', files.get(path)!.content),
        name: path.split('/').pop(),
        type: 'blob',
        path,
        mode: '100644',
      }));
      const perPage = Math.min(
        Number(url.searchParams.get('per_page') ?? 20),
        options.pageSize ?? 100,
      );
      const page = Number(url.searchParams.get('page') ?? 1);
      const pages = Math.max(1, Math.ceil(all.length / perPage));
      return send(res, 200, all.slice((page - 1) * perPage, page * perPage), {
        'X-Page': String(page),
        'X-Per-Page': String(perPage),
        'X-Total': String(all.length),
        'X-Total-Pages': String(pages),
        'X-Next-Page': page < pages ? String(page + 1) : '',
      });
    }
    if (req.method === 'GET' && (m = rest.match(/^files\/(.+)$/))) {
      const path = decodeURIComponent(m[1]!);
      const file = filesAt(url.searchParams.get('ref') ?? 'main')?.get(path);
      return file
        ? send(
            res,
            200,
            {
              file_path: path,
              last_commit_id: file.lastCommit,
              encoding: 'base64',
              content: Buffer.from(file.content).toString('base64'),
            },
            { 'X-Gitlab-Last-Commit-Id': file.lastCommit },
          )
        : send(res, 404, { message: '404 File Not Found' });
    }
    if (req.method === 'DELETE' && (m = rest.match(/^branches\/(.+)$/))) {
      if (!branches.delete(decodeURIComponent(m[1]!)))
        return send(res, 404, { message: '404 Branch Not Found' });
      res.writeHead(204, cors ? corsHeaders : {});
      return void res.end();
    }
    if (req.method === 'POST' && rest === 'branches') {
      const name = url.searchParams.get('branch')!;
      const from = branchOf(url.searchParams.get('ref') ?? 'main');
      if (branches.has(name))
        return send(res, 400, { message: 'Branch already exists' });
      if (!from) return send(res, 400, { message: 'Invalid reference name' });
      branches.set(name, from);
      return send(res, 201, { name, commit: { id: from } });
    }
    if (req.method === 'POST' && rest === 'commits') {
      const json = JSON.parse(body) as {
        branch: string;
        commit_message: string;
        actions: {
          action: string;
          file_path: string;
          content?: string;
          last_commit_id?: string;
        }[];
      };
      const parentId = branchOf(json.branch);
      if (!parentId)
        return send(res, 400, {
          message: 'A branch called that does not exist',
        });
      const next = new Map(commits.get(parentId)!.files);
      const newId = id(
        'commit',
        parentId,
        json.commit_message,
        randomBytes(4).toString('hex'),
      );
      for (const a of json.actions) {
        const existing = next.get(a.file_path);
        if (a.action === 'create') {
          if (existing)
            return send(res, 400, {
              message: `A file with this name already exists`,
            });
          next.set(a.file_path, {
            content: a.content ?? '',
            lastCommit: newId,
          });
        } else if (a.action === 'update') {
          if (!existing)
            return send(res, 400, {
              message: `A file with this name doesn't exist`,
            });
          if (a.last_commit_id && a.last_commit_id !== existing.lastCommit) {
            return send(res, 400, {
              message:
                'You are attempting to update a file that has changed since you started editing it',
            });
          }
          next.set(a.file_path, {
            content: a.content ?? '',
            lastCommit: newId,
          });
        } else if (a.action === 'delete') {
          if (!existing)
            return send(res, 400, {
              message: `A file with this name doesn't exist`,
            });
          if (a.last_commit_id && a.last_commit_id !== existing.lastCommit) {
            return send(res, 400, {
              message:
                'You are attempting to delete a file that has changed since you started editing it',
            });
          }
          next.delete(a.file_path);
        } else {
          return send(res, 400, {
            message: `actions[][action] does not have a valid value`,
          });
        }
      }
      commits.set(newId, { parent: parentId, files: next });
      branches.set(json.branch, newId);
      return send(res, 201, {
        id: newId,
        parent_ids: [parentId],
        title: json.commit_message,
      });
    }
    return send(res, 404, { message: '404 Not Found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
