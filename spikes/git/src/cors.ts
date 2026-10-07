export interface ProbeResult {
  ok: boolean;
  status?: number;
  /** Response headers the page is allowed to read (CORS hides the rest). */
  visibleHeaders?: string[];
  error?: string;
}

/**
 * Makes one request the way the app will, with an Authorization header so the browser sends a
 * preflight. A TypeError means the browser blocked it (CORS) or the host was unreachable;
 * the browser does not say which.
 */
export async function probe(
  url: string,
  init: RequestInit,
): Promise<ProbeResult> {
  try {
    const response = await fetch(url, init);
    await response.text();
    return {
      ok: true,
      status: response.status,
      visibleHeaders: [...response.headers.keys()].sort(),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
    };
  }
}
