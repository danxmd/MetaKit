import type { Checker } from './guards';

/** Longest script the Kit accepts, so that a damaged file cannot fill memory. */
export const MAX_SCRIPT_CHARS = 200_000;

/** Checks the structure of `scripts`. */
export function checkScripts(c: Checker, scripts: unknown): void {
  if (scripts === undefined) return;
  if (
    scripts === null ||
    typeof scripts !== 'object' ||
    Array.isArray(scripts)
  ) {
    c.add('scripts', 'The scripts must be an object keyed by id.');
    return;
  }
  for (const [id, raw] of Object.entries(scripts)) {
    const path = `scripts.${id}`;
    const s = c.object(
      raw,
      path,
      ['id', 'name', 'source', 'enabled'],
      'A script',
    );
    if (!s) continue;
    if (s.id !== id)
      c.add(
        `${path}.id`,
        `The id "${String(s.id)}" does not match the entry name "${id}".`,
      );
    c.id('script', s.id, `${path}.id`, 'The script id');
    c.string(s.name, `${path}.name`, 'The script name');
    const source = c.string(s.source, `${path}.source`, 'The source', {
      empty: true,
    });
    if (source !== null && source.length > MAX_SCRIPT_CHARS)
      c.add(
        `${path}.source`,
        `The script is longer than ${MAX_SCRIPT_CHARS} characters.`,
      );
    if (s.enabled !== undefined)
      c.boolean(s.enabled, `${path}.enabled`, 'enabled');
  }
}

/** Checks the `permissions` of the manifest. */
export function checkPermissions(c: Checker, value: unknown): void {
  if (value === undefined) return;
  const p = c.object(
    value,
    'manifest.permissions',
    ['network', 'files'],
    'The permissions',
  );
  if (!p) return;
  for (const key of ['network', 'files'])
    if (p[key] !== undefined)
      c.boolean(p[key], `manifest.permissions.${key}`, `The ${key} permission`);
}
