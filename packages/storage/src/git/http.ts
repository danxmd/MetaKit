import { GitAccessError } from './remote';
import { Redactor } from './redact';

export type FetchLike = typeof fetch;

export interface HttpResult {
  status: number;
  ok: boolean;
  text: string;
  header(name: string): string | null;
}

/** The text a service puts in `message` or `error`, or the raw body. */
export function messageOf(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    const message = parsed.message ?? parsed.error;
    return typeof message === 'string'
      ? message
      : JSON.stringify(message ?? body);
  } catch {
    return body;
  }
}

/**
 * The one place that talks to `fetch` for an adapter. The token goes into the Authorization header
 * and nowhere else; every error that leaves this class has been through the redactor.
 */
export class Http {
  readonly redactor = new Redactor();
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly service: 'GitHub' | 'GitLab',
    token: string,
    fetchImpl?: FetchLike,
  ) {
    this.redactor.add(token);
    this.fetchImpl = fetchImpl ?? ((...a) => globalThis.fetch(...a));
  }

  clean(text: string): string {
    return this.redactor.clean(text);
  }

  async send(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<HttpResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          ...headers,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      // The browser cannot tell "blocked by CORS" from "unreachable", and the original message may
      // name the request, so it is not passed on.
      throw new Error(
        `Could not reach ${this.service}. Check the address and your connection; the service may also refuse requests from a browser.`,
      );
    }
    const text = method === 'HEAD' ? '' : await response.text();
    return {
      status: response.status,
      ok: response.ok,
      text,
      header: (name) => response.headers.get(name),
    };
  }

  /** Turns a failed answer into a plain-English error. `notFound` replaces the text for 404. */
  fail(method: string, result: HttpResult, notFound?: string): never {
    const detail = this.clean(messageOf(result.text)).slice(0, 200);
    if (result.status === 401)
      throw new GitAccessError(
        'The token was refused. It may be wrong, expired or revoked.',
        401,
      );
    if (result.status === 403) {
      if (
        result.header('x-ratelimit-remaining') === '0' ||
        /rate limit/i.test(detail)
      )
        throw new GitAccessError(
          `${this.service} is limiting requests. Wait a minute and try again.`,
          403,
        );
      throw new GitAccessError(
        method === 'GET' || method === 'HEAD'
          ? 'The token cannot read this repository.'
          : 'The token cannot write to this repository.',
        403,
      );
    }
    if (result.status === 404)
      throw new GitAccessError(
        notFound ?? 'The repository was not found or the token cannot see it.',
        404,
      );
    throw new Error(
      `${this.service} answered with status ${result.status}${detail ? `: ${detail}` : '.'}`,
    );
  }

  /** Parsed JSON of a successful answer; any other answer throws. */
  async json<T>(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown,
    notFound?: string,
  ): Promise<{ data: T; result: HttpResult }> {
    const result = await this.send(method, url, headers, body);
    if (!result.ok) this.fail(method, result, notFound);
    try {
      return {
        data: (result.text ? JSON.parse(result.text) : undefined) as T,
        result,
      };
    } catch {
      throw new Error(`${this.service} sent an answer that is not JSON.`);
    }
  }
}

export interface GitRemoteOptions {
  /** `github.com` / `gitlab.com` by default; a self-hosted address may carry `https://`. */
  host?: string;
  /** `owner/name` on GitHub, the full project path on GitLab. */
  repo: string;
  /** Where the Kit lives inside the repository; '' for the root. */
  folder: string;
  /** Held in memory by the remote and sent in the Authorization header only. */
  token: string;
  fetch?: FetchLike;
}

/** The address of a host with a scheme: `gitlab.com` becomes `https://gitlab.com`. */
export function originOf(host: string): string {
  const trimmed = host.replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
