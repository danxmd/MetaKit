/**
 * What scripts may ask of the app beyond models and dialogs. The app implements these; both need
 * a permission the person has allowed for the Kit in this browser (permissions.ts).
 */

/** Text files inside the workspace folder. Paths use `/` and are relative to the workspace. */
export interface ScriptFiles {
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  /** Names of the files and folders in a folder of the workspace ("" is the workspace itself). */
  list(folder: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

export interface ScriptHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ScriptHttpResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
}

/**
 * A `fetch` for scripts. In a browser this can only reach web services that accept requests from
 * other websites; the app implements it with `fetch` and no credentials.
 */
export interface ScriptHttp {
  request(request: ScriptHttpRequest): Promise<ScriptHttpResponse>;
}

/** The most text that crosses between a script and a file or a web service in one call. */
export const MAX_TRANSFER_CHARS = 5_000_000;

/**
 * A path inside the workspace: `/` separated, no empty, `.` or `..` parts, no drive letters. Returns
 * null when the path is not one, so that a script cannot step out of the folder.
 */
export function workspacePath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const clean = path.replace(/^\.\//, '');
  if (clean === '') return '';
  if (/^[/\\]|^[A-Za-z]:|\\|\0/.test(clean)) return null;
  const parts = clean.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
  return parts.join('/');
}
