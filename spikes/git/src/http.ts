export type FetchLike = typeof fetch;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly method: string,
    readonly url: string,
  ) {
    super(`${method} ${url} failed with ${status}: ${body.slice(0, 300)}`);
    this.name = 'HttpError';
  }
}

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
