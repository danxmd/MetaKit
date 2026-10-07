import type { GitFile } from './remote';

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  // Chunks keep the argument list of fromCharCode small for large files.
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  // The services wrap base64 at 60 columns; strip the line breaks to be explicit.
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Text that is valid UTF-8 comes back as text, anything else stays base64. */
export function fileFromBase64(path: string, base64: string): GitFile {
  const bytes = base64ToBytes(base64);
  try {
    return {
      path,
      content: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    };
  } catch {
    return { path, content: bytesToBase64(bytes), encoding: 'base64' };
  }
}

/** Runs `work` over `items` with at most `limit` in flight, keeping the order of the results. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]!);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

/** The folder with no leading or trailing slash; '' for the repository root. */
export function normaliseFolder(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, '');
}

/** Path segments encoded one by one, so `/` stays a separator (GitHub ref and file paths). */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
