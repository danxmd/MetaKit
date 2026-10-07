/** OAuth 2.0 authorisation code flow with PKCE (RFC 7636), as a public client with no secret. */

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
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  scope?: string;
}): string {
  const url = new URL('/oauth/authorize', args.baseUrl);
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

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

/** Exchanges the code for a token. No client secret is sent: the verifier proves possession. */
export async function exchangeCode(args: {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
  fetch?: typeof fetch;
}): Promise<TokenResponse> {
  const doFetch =
    args.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const response = await doFetch(
    new URL('/oauth/token', args.baseUrl).toString(),
    {
      method: 'POST',
      // Form encoding is a "simple" content type, and the server also allows content-type in preflight.
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: args.clientId,
        code: args.code,
        redirect_uri: args.redirectUri,
        code_verifier: args.verifier,
      }).toString(),
    },
  );
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `Token exchange failed with ${response.status}: ${text.slice(0, 200)}`,
    );
  return JSON.parse(text) as TokenResponse;
}
