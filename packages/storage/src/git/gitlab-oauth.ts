import { originOf, type FetchLike } from './http';

/**
 * Sign-in to GitLab with OAuth 2.0 and PKCE (RFC 7636), as a public client with no secret. The
 * verifier and the state live in sessionStorage only for the round trip through GitLab; the
 * access token is returned to the caller and is never stored here (rule 9).
 */

const STORAGE_KEY = 'metakit.gitlabSignIn';

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export function createVerifier(): string {
  // 32 random bytes give a 43-character verifier, the shortest length RFC 7636 allows.
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(args: {
  host: string;
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  scope?: string;
}): string {
  const url = new URL('/oauth/authorize', originOf(args.host));
  url.search = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    state: args.state,
    scope: args.scope ?? 'api',
    code_challenge: args.challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export interface GitLabSignInOptions {
  /** `gitlab.com` by default. */
  host?: string;
  /** The Application ID of the OAuth application (see docs/git-oauth-setup.md). Not a secret. */
  clientId: string;
  redirectUri: string;
  storage?: SessionStore;
}

/**
 * Remembers the verifier and state for the round trip and returns the address to send the browser
 * to. The caller navigates (`location.assign(url)`).
 */
export async function beginGitLabSignIn(
  options: GitLabSignInOptions,
): Promise<string> {
  const storage = options.storage ?? sessionStorage;
  const verifier = createVerifier();
  const state = createVerifier();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      verifier,
      state,
      host: options.host ?? 'gitlab.com',
      clientId: options.clientId,
      redirectUri: options.redirectUri,
    }),
  );
  return buildAuthorizeUrl({
    host: options.host ?? 'gitlab.com',
    clientId: options.clientId,
    redirectUri: options.redirectUri,
    state,
    challenge: await challengeFor(verifier),
  });
}

/** True when the address looks like GitLab sending the browser back and a sign-in is pending. */
export function isGitLabSignInReturn(
  search: string | URLSearchParams,
  storage: SessionStore = sessionStorage,
): boolean {
  const params = new URLSearchParams(search);
  return (
    storage.getItem(STORAGE_KEY) !== null &&
    params.has('state') &&
    (params.has('code') || params.has('error'))
  );
}

export interface GitLabSignInResult {
  host: string;
  accessToken: string;
  /** Seconds until the token stops working; GitLab tokens last two hours. */
  expiresIn?: number;
}

/** Completes the round trip: checks the state, exchanges the code, forgets the verifier. */
export async function finishGitLabSignIn(args: {
  /** The query string GitLab sent the browser back with. */
  search: string | URLSearchParams;
  storage?: SessionStore;
  fetch?: FetchLike;
}): Promise<GitLabSignInResult> {
  const storage = args.storage ?? sessionStorage;
  const saved = storage.getItem(STORAGE_KEY);
  // One attempt only: whatever happens next, the verifier is not kept.
  storage.removeItem(STORAGE_KEY);
  if (!saved) throw new Error('No GitLab sign-in was started in this tab.');
  const pending = JSON.parse(saved) as {
    verifier: string;
    state: string;
    host: string;
    clientId: string;
    redirectUri: string;
  };
  const params = new URLSearchParams(args.search);
  if (params.get('state') !== pending.state)
    throw new Error(
      'The sign-in answer did not match this tab. Start the sign-in again.',
    );
  const denied = params.get('error');
  if (denied)
    throw new Error(
      denied === 'access_denied'
        ? 'GitLab sign-in was cancelled.'
        : `GitLab refused the sign-in (${denied}).`,
    );
  const code = params.get('code');
  if (!code) throw new Error('GitLab did not send a sign-in code.');

  const doFetch = args.fetch ?? ((...a) => globalThis.fetch(...a));
  let response: Response;
  try {
    response = await doFetch(
      new URL('/oauth/token', originOf(pending.host)).toString(),
      {
        method: 'POST',
        // Form encoding is a "simple" content type; the token endpoint allows only content-type in
        // a preflight, so nothing else may be added (spike finding 1).
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: pending.clientId,
          code,
          redirect_uri: pending.redirectUri,
          code_verifier: pending.verifier,
        }).toString(),
      },
    );
  } catch {
    throw new Error('Could not reach GitLab to finish the sign-in.');
  }
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `GitLab did not accept the sign-in (status ${response.status}). Start it again.`,
    );
  let token: { access_token?: string; expires_in?: number };
  try {
    token = JSON.parse(text) as typeof token;
  } catch {
    throw new Error('GitLab sent an answer that is not JSON.');
  }
  if (!token.access_token) throw new Error('GitLab sent no access token.');
  return {
    host: pending.host,
    accessToken: token.access_token,
    ...(token.expires_in === undefined ? {} : { expiresIn: token.expires_in }),
  };
}
