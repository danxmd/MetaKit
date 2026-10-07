import { describe, expect, it, vi } from 'vitest';
import { createFakeGitHub } from './fake-github';
import { createFakeGitLab } from './fake-gitlab';
import { GitHubRemote } from './github';
import { GitLabRemote } from './gitlab';
import {
  beginGitLabSignIn,
  challengeFor,
  finishGitLabSignIn,
  isGitLabSignInReturn,
} from './gitlab-oauth';
import { Redactor } from './redact';
import { createMemoryKeyValue, TokenStore } from './tokens';

// Made-up tokens with the right shape. Real tokens are typed into the page at run time.
const GH_TOKEN = 'ghp_TESTONLYnotarealtokenABCDEFGH1234567890';
const GL_TOKEN = 'glpat-TESTONLY-notarealtoken-1234';

describe('TokenStore', () => {
  it('adds, lists without the secret, reveals, renames and removes', async () => {
    const store = new TokenStore(createMemoryKeyValue());
    const added = await store.add({
      service: 'github',
      label: ' Work ',
      token: ` ${GH_TOKEN} `,
    });
    expect(added).toMatchObject({
      service: 'github',
      host: 'github.com',
      label: 'Work',
    });
    expect(added.id).toMatch(/^tok_[0-9a-f]{12}$/);
    expect(JSON.stringify(added)).not.toContain(GH_TOKEN);
    const second = await store.add({
      service: 'gitlab',
      host: 'https://gitlab.example.org/',
      label: '',
      token: GL_TOKEN,
    });
    expect(second.host).toBe('https://gitlab.example.org');
    expect(second.label).toBe('gitlab.com');

    const listed = await store.list();
    expect(listed.map((t) => t.id)).toEqual([added.id, second.id]);
    expect(JSON.stringify(listed)).not.toContain(GH_TOKEN);
    expect(JSON.stringify(listed)).not.toContain(GL_TOKEN);
    for (const info of listed) expect(info).not.toHaveProperty('token');

    expect(await store.reveal(added.id)).toBe(GH_TOKEN);
    await store.rename(added.id, 'Personal');
    expect((await store.list())[0]!.label).toBe('Personal');
    await store.rename(added.id, '  ');
    expect((await store.list())[0]!.label).toBe('Personal');

    await store.remove(added.id);
    expect((await store.list()).map((t) => t.id)).toEqual([second.id]);
    expect(await store.reveal(added.id)).toBeUndefined();
  });

  it('refuses an empty token without echoing anything', async () => {
    const store = new TokenStore(createMemoryKeyValue());
    await expect(
      store.add({ service: 'github', label: 'x', token: '  ' }),
    ).rejects.toThrow('Paste the token first.');
  });

  it('keeps quick successive changes', async () => {
    const store = new TokenStore(createMemoryKeyValue());
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.add({
          service: 'github',
          label: `t${i}`,
          token: `${GH_TOKEN}${i}`,
        }),
      ),
    );
    expect(await store.list()).toHaveLength(10);
  });

  it('ignores damaged records in the backing store', async () => {
    const kv = createMemoryKeyValue();
    await kv.set('gitTokens', { bad: { id: 'bad' }, other: 42 });
    expect(await new TokenStore(kv).list()).toEqual([]);
  });

  it('keeps the secret only in the backing store under its own key', async () => {
    const kv = createMemoryKeyValue();
    const writes: string[] = [];
    const spy = {
      get: kv.get.bind(kv),
      set: async (key: string, value: unknown) => {
        writes.push(key);
        await kv.set(key, value);
      },
    };
    await new TokenStore(spy).add({
      service: 'github',
      label: 'x',
      token: GH_TOKEN,
    });
    expect(writes).toEqual(['gitTokens']);
  });
});

describe('a token never leaves in text', () => {
  const failures = [
    { status: 401, body: { message: `Bad credentials for ${GH_TOKEN}` } },
    { status: 403, body: { message: `Forbidden ${GH_TOKEN}` } },
    { status: 404, body: { message: `Not Found ${GH_TOKEN}` } },
    { status: 422, body: { message: `Echo ${GH_TOKEN} and ${GL_TOKEN}` } },
    { status: 500, body: { message: `Server says Bearer ${GH_TOKEN}` } },
  ];

  it.each(failures)(
    'GitHub $status: message and string form are clean',
    async ({ status, body }) => {
      const fake = createFakeGitHub();
      const remote = new GitHubRemote({
        repo: 'owner/name',
        folder: '',
        token: GH_TOKEN,
        fetch: fake.fetch,
      });
      fake.failWith(status, body);
      const error = (await remote.test().catch((e: unknown) => e)) as Error;
      for (const text of [
        error.message,
        String(error),
        `${error.name}: ${error.message}`,
        JSON.stringify({ ...error }),
      ])
        expect(text).not.toContain(GH_TOKEN);
      expect(error.message).not.toContain(GL_TOKEN);
    },
  );

  it.each(failures)(
    'GitLab $status: message and string form are clean',
    async ({ status, body }) => {
      const fake = createFakeGitLab();
      const remote = new GitLabRemote({
        repo: 'group/project',
        folder: '',
        token: GL_TOKEN,
        fetch: fake.fetch,
      });
      fake.failWith(
        status,
        JSON.parse(JSON.stringify(body).replaceAll(GH_TOKEN, GL_TOKEN)),
      );
      const error = (await remote.test().catch((e: unknown) => e)) as Error;
      for (const text of [
        error.message,
        String(error),
        error.stack?.split('\n')[0] ?? '',
      ])
        expect(text).not.toContain(GL_TOKEN);
    },
  );

  it('a network failure whose message contains the token is replaced by a plain message', async () => {
    const remote = new GitHubRemote({
      repo: 'owner/name',
      folder: '',
      token: GH_TOKEN,
      fetch: (() =>
        Promise.reject(
          new TypeError(`bad header Bearer ${GH_TOKEN}`),
        )) as typeof fetch,
    });
    const error = (await remote.test().catch((e: unknown) => e)) as Error;
    expect(error.message).not.toContain(GH_TOKEN);
    expect(error.cause).toBeUndefined();
  });

  it('even a short custom token is hidden when it is long enough to be a secret', () => {
    const redactor = new Redactor();
    redactor.add('abc123xyz');
    expect(redactor.clean('oops abc123xyz here')).toBe(
      'oops [token hidden] here',
    );
    expect(
      redactor.clean(`${GH_TOKEN} ${GL_TOKEN} github_pat_${'A'.repeat(30)}`),
    ).not.toMatch(/ghp_|glpat-|github_pat_/);
    expect(new Redactor().clean('Update is not a fast forward')).toBe(
      'Update is not a fast forward',
    );
  });

  it('sends the token only in the Authorization header, never in a URL or a body, and logs nothing', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const gh = createFakeGitHub();
    const github = new GitHubRemote({
      repo: 'owner/name',
      folder: 'lib',
      token: GH_TOKEN,
      fetch: gh.fetch,
    });
    await github.commit({
      branch: 'main',
      parent: await github.head('main'),
      message: 'm',
      changes: [{ path: 'a.json', content: '{}' }],
    });
    await github.read('main');
    await github.listTags();
    const gl = createFakeGitLab();
    const gitlab = new GitLabRemote({
      repo: 'group/project',
      folder: 'lib',
      token: GL_TOKEN,
      fetch: gl.fetch,
    });
    await gitlab.commit({
      branch: 'main',
      parent: await gitlab.head('main'),
      message: 'm',
      changes: [{ path: 'a.json', content: '{}' }],
    });
    await gitlab.read('main');
    for (const [fake, token] of [
      [gh, GH_TOKEN],
      [gl, GL_TOKEN],
    ] as const) {
      expect(fake.requests.length).toBeGreaterThan(5);
      for (const r of fake.requests) {
        expect(r.headers['authorization']).toBe(`Bearer ${token}`);
        expect(r.url).not.toContain(token);
        expect(r.body).not.toContain(token);
        expect(
          Object.entries(r.headers).filter(
            ([k, v]) => k !== 'authorization' && v.includes(token),
          ),
        ).toEqual([]);
      }
    }
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe('GitLab sign-in with PKCE', () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      map,
    };
  };

  it('stores verifier and state for the round trip and builds a public-client address', async () => {
    const storage = memory();
    const url = new URL(
      await beginGitLabSignIn({
        clientId: 'app-id',
        redirectUri: 'https://x.test/MetaKit/',
        storage,
      }),
    );
    expect(url.origin + url.pathname).toBe(
      'https://gitlab.com/oauth/authorize',
    );
    const p = url.searchParams;
    expect(Object.fromEntries(p)).toMatchObject({
      client_id: 'app-id',
      redirect_uri: 'https://x.test/MetaKit/',
      response_type: 'code',
      scope: 'api',
      code_challenge_method: 'S256',
    });
    const saved = JSON.parse(storage.map.get('metakit.gitlabSignIn')!) as {
      verifier: string;
      state: string;
    };
    expect(p.get('state')).toBe(saved.state);
    expect(p.get('code_challenge')).toBe(await challengeFor(saved.verifier));
    expect(url.toString()).not.toContain(saved.verifier);
    expect(isGitLabSignInReturn(`?code=c&state=${saved.state}`, storage)).toBe(
      true,
    );
    expect(isGitLabSignInReturn('?foo=1', storage)).toBe(false);
  });

  it('matches the RFC 7636 example challenge', async () => {
    expect(
      await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('exchanges the code with the verifier and no secret, returns the token and keeps nothing', async () => {
    const storage = memory();
    await beginGitLabSignIn({
      host: 'gitlab.example.org',
      clientId: 'app-id',
      redirectUri: 'https://x.test/cb',
      storage,
    });
    const saved = JSON.parse(storage.map.get('metakit.gitlabSignIn')!) as {
      verifier: string;
      state: string;
    };
    let sent:
      | { url: string; body: string; headers: HeadersInit | undefined }
      | undefined;
    const result = await finishGitLabSignIn({
      search: `?code=the-code&state=${saved.state}`,
      storage,
      fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
        sent = {
          url: String(url),
          body: String(init?.body),
          headers: init?.headers,
        };
        return new Response(
          JSON.stringify({
            access_token: GL_TOKEN,
            token_type: 'Bearer',
            expires_in: 7200,
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    expect(result).toEqual({
      host: 'gitlab.example.org',
      accessToken: GL_TOKEN,
      expiresIn: 7200,
    });
    expect(sent!.url).toBe('https://gitlab.example.org/oauth/token');
    expect(sent!.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    const form = new URLSearchParams(sent!.body);
    expect(form.get('code_verifier')).toBe(saved.verifier);
    expect(form.get('client_id')).toBe('app-id');
    expect(sent!.body).not.toContain('client_secret');
    expect(storage.map.size).toBe(0);
    expect(JSON.stringify([...storage.map])).not.toContain(GL_TOKEN);
  });

  it('refuses a mismatched state and forgets the attempt', async () => {
    const storage = memory();
    await beginGitLabSignIn({
      clientId: 'a',
      redirectUri: 'https://x.test/',
      storage,
    });
    await expect(
      finishGitLabSignIn({
        search: '?code=c&state=wrong',
        storage,
        fetch: (() => {
          throw new Error('must not be called');
        }) as typeof fetch,
      }),
    ).rejects.toThrow(/did not match/);
    expect(storage.map.size).toBe(0);
  });

  it('says plainly when GitLab refuses, without echoing the response', async () => {
    const storage = memory();
    await beginGitLabSignIn({
      clientId: 'a',
      redirectUri: 'https://x.test/',
      storage,
    });
    const { state } = JSON.parse(storage.map.get('metakit.gitlabSignIn')!) as {
      state: string;
    };
    const error = await finishGitLabSignIn({
      search: `?code=c&state=${state}`,
      storage,
      fetch: (async () =>
        new Response(`{"error":"invalid_grant","hint":"${GL_TOKEN}"}`, {
          status: 400,
        })) as typeof fetch,
    }).catch((e: Error) => e);
    expect((error as Error).message).toBe(
      'GitLab did not accept the sign-in (status 400). Start it again.',
    );
    await beginGitLabSignIn({
      clientId: 'a',
      redirectUri: 'https://x.test/',
      storage,
    });
    const second = JSON.parse(storage.map.get('metakit.gitlabSignIn')!) as {
      state: string;
    };
    await expect(
      finishGitLabSignIn({
        search: `?error=access_denied&state=${second.state}`,
        storage,
      }),
    ).rejects.toThrow('GitLab sign-in was cancelled.');
  });
});
