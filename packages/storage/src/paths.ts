import { InvalidPathError, NotOwnedError } from './errors';

// Characters Windows cannot have in a name; a workspace may be opened on any system through a sync client.
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const FORBIDDEN = /[<>:"|?*\\\u0000-\u001f]/;
const MAX_SEGMENT = 200;

/**
 * Workspace paths are relative, use `/`, and have no empty, `.` or `..` parts. Names do not start
 * with a dot (some sync tools skip hidden files), end in a dot or space, or contain characters
 * Windows refuses.
 */
export function checkPath(path: string): string[] {
  if (typeof path !== 'string')
    throw new InvalidPathError('A path must be text.');
  if (path === '') return [];
  if (path.startsWith('/'))
    throw new InvalidPathError(
      `"${path}" starts with "/"; paths are relative to the workspace.`,
    );
  const segments = path.split('/');
  for (const s of segments) {
    if (s === '') throw new InvalidPathError(`"${path}" has an empty part.`);
    if (s === '.' || s === '..')
      throw new InvalidPathError(
        `"${path}" contains "${s}"; paths cannot leave the workspace.`,
      );
    if (FORBIDDEN.test(s))
      throw new InvalidPathError(
        `"${s}" in "${path}" has a character that some systems do not allow.`,
      );
    if (s.startsWith('.'))
      throw new InvalidPathError(
        `"${s}" in "${path}" starts with a dot; sync tools may skip such files.`,
      );
    if (s.endsWith('.') || s.endsWith(' '))
      throw new InvalidPathError(
        `"${s}" in "${path}" ends with a dot or a space.`,
      );
    if (s.length > MAX_SEGMENT)
      throw new InvalidPathError(
        `A part of "${path}" is longer than ${MAX_SEGMENT} characters.`,
      );
  }
  return segments;
}

export function joinPath(...parts: string[]): string {
  return parts.filter((p) => p !== '').join('/');
}

export function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Valid instance ids are short alphanumeric strings, so they are safe as folder names. */
export function checkInstanceId(id: string): string {
  if (!/^[A-Za-z0-9]{4,32}$/.test(id))
    throw new InvalidPathError(
      `"${id}" is not a valid instance id (4 to 32 letters and digits).`,
    );
  return id;
}

/** Whose area a path is in (a `_state/<instance>/` folder or `_presence/<instance>.json`), or null for shared files. */
export function ownerOf(path: string): string | null {
  const parts = path.split('/');
  const state = parts.indexOf('_state');
  if (state >= 0 && parts.length > state + 2) return parts[state + 1]!;
  if (parts[0] === '_presence' && parts.length === 2)
    return parts[1]!.replace(/\.json$/, '');
  return null;
}

/**
 * Rule 6: an instance writes only its own files. `mode` 'new' may create shared files and its own;
 * 'own' (overwrite, remove) is only for files in its own area.
 */
export function assertMayWrite(
  path: string,
  instanceId: string,
  mode: 'new' | 'own',
): void {
  const owner = ownerOf(path);
  if (mode === 'own' && owner !== instanceId) {
    throw new NotOwnedError(
      owner === null
        ? `"${path}" is a shared file. Shared files are written once and never changed; only files under _state/${instanceId}/ can be overwritten or removed.`
        : `"${path}" belongs to instance ${owner}, not to this instance (${instanceId}).`,
    );
  }
  if (mode === 'new' && owner !== null && owner !== instanceId) {
    throw new NotOwnedError(
      `"${path}" is in the area of instance ${owner}; this instance (${instanceId}) writes only its own files.`,
    );
  }
}

/** A fresh random instance id: 8 hex characters. Each browser profile, or each CLI run, is one instance. */
export function newInstanceId(): string {
  const random = (
    globalThis as unknown as {
      crypto: { getRandomValues(a: Uint8Array): Uint8Array };
    }
  ).crypto;
  return [...random.getRandomValues(new Uint8Array(4))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
