import type { StorageAdapter } from './adapter';
import { AlreadyExistsError, InvalidPathError, NotFoundError } from './errors';
import { joinPath } from './paths';

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = (
    globalThis as unknown as {
      crypto: {
        subtle: {
          digest(name: string, data: Uint8Array): Promise<ArrayBuffer>;
        };
      };
    }
  ).crypto.subtle;
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Stores an asset (an icon, an image) as `<name>.<hash>.<ext>` in `folder`. The hash is part of
 * the name, so the same bytes always get the same file, different bytes never replace each
 * other, and a changed icon is a new file that old models can still find.
 */
export async function addAsset(
  adapter: StorageAdapter,
  folder: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<string> {
  const match = /^(.*?)(?:\.([A-Za-z0-9]{1,8}))?$/.exec(
    fileName.split('/').pop() ?? '',
  );
  const stem = (match?.[1] ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const ext = (match?.[2] ?? '').toLowerCase();
  if (stem === '')
    throw new InvalidPathError(
      `"${fileName}" has no usable name for an asset.`,
    );
  const hash = await sha256Hex(bytes);
  // Eight hex characters are enough in practice; if two different files ever share them, use more.
  for (const length of [8, 16, 64]) {
    const name = `${stem}.${hash.slice(0, length)}${ext ? `.${ext}` : ''}`;
    const path = joinPath(folder, name);
    try {
      await adapter.writeNew(path, bytes);
      return name;
    } catch (error) {
      if (!(error instanceof AlreadyExistsError)) throw error;
      if (same(await adapter.read(path), bytes)) return name;
    }
  }
  throw new Error(
    `Could not store the asset "${fileName}" under a unique name.`,
  );
}

export async function readAsset(
  adapter: StorageAdapter,
  folder: string,
  name: string,
): Promise<Uint8Array> {
  if (name.includes('/'))
    throw new InvalidPathError(`"${name}" is not an asset name.`);
  const path = joinPath(folder, name);
  if (!(await adapter.exists(path)))
    throw new NotFoundError(`There is no asset "${name}".`);
  return adapter.read(path);
}
