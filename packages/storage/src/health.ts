import { toBytes, type StorageAdapter } from './adapter';

export type HealthKind =
  | 'slow-read'
  | 'unreadable'
  | 'empty-file'
  | 'incomplete-file'
  | 'conflicted-copy';

export interface HealthFinding {
  kind: HealthKind;
  /** Plain English, with what to do about it. */
  message: string;
  path?: string;
}

export interface HealthOptions {
  /** Milliseconds, for timing reads; `performance.now` by default. */
  clock?: () => number;
  /** Wall clock in milliseconds, to tell a file still being written from one that stopped. */
  now?: () => number;
  /** How many files to read to time them. */
  sample?: number;
  /** A read slower than this suggests the file is not on this computer yet. */
  slowMs?: number;
  /** A file without a final newline for longer than this is called incomplete. */
  incompleteAfterMs?: number;
}

const CONFLICT =
  /(conflicted copy|\(\d+\)\.[a-z]+$| - copy\b|~\$|\.tmp$|-desktop-|-laptop-|\bversion conflict\b)/i;

const KEEP_ON_DEVICE =
  'Keep the folder on this computer: in OneDrive choose "Always keep on this device", in Google Drive "Available offline", in Dropbox "Make available offline".';

/** The files of a workspace that matter to sync, found by walking its folders. */
async function walk(
  adapter: StorageAdapter,
  dir: string,
  depth: number,
  out: {
    path: string;
    size: number | undefined;
    modified: number | undefined;
  }[],
): Promise<void> {
  if (depth > 6) return;
  for (const entry of await adapter.list(dir)) {
    const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'directory') await walk(adapter, path, depth + 1, out);
    else out.push({ path, size: entry.size, modified: entry.modified });
  }
}

/**
 * Looks at the folder for signs that sync is not set up well: files that are slow to read (often
 * "online only" placeholders), files that cannot be read, files with no content, files that never
 * became complete, and names a sync service gives to conflicted copies. It cannot see whether the
 * sync program is running; it only sees what the files show.
 */
export async function checkFolderHealth(
  adapter: StorageAdapter,
  options: HealthOptions = {},
): Promise<HealthFinding[]> {
  const clock = options.clock ?? (() => performance.now());
  const wall = options.now ?? Date.now;
  const slowMs = options.slowMs ?? 2000;
  const files: {
    path: string;
    size: number | undefined;
    modified: number | undefined;
  }[] = [];
  await walk(adapter, '', 0, files);
  const findings: HealthFinding[] = [];

  for (const f of files) {
    if (CONFLICT.test(f.path.split('/').pop()!))
      findings.push({
        kind: 'conflicted-copy',
        path: f.path,
        message: `"${f.path}" looks like a conflicted copy made by the sync service. MetaKit never edits a file twice, so this should not happen; check whether another program changed files in the folder.`,
      });
    if (f.size === 0 && /\.jsonl?$/.test(f.path))
      findings.push({
        kind: 'empty-file',
        path: f.path,
        message: `"${f.path}" is empty. It may still be arriving from the sync service, or it was not downloaded.`,
      });
  }

  // Read some files and time them. Change files and snapshots are the ones sync depends on.
  const sample = files
    .filter((f) => /\.jsonl?$/.test(f.path) && f.size !== 0)
    .sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0))
    .slice(0, options.sample ?? 20);
  let slow = 0;
  let slowest = 0;
  for (const f of sample) {
    const started = clock();
    try {
      const bytes = await adapter.read(f.path);
      const took = clock() - started;
      if (took > slowMs) {
        slow += 1;
        slowest = Math.max(slowest, took);
      }
      const last = bytes[bytes.length - 1];
      if (
        last !== undefined &&
        last !== toBytes('\n')[0] &&
        f.modified !== undefined &&
        wall() - f.modified > (options.incompleteAfterMs ?? 60_000)
      )
        findings.push({
          kind: 'incomplete-file',
          path: f.path,
          message: `"${f.path}" does not end the way MetaKit writes files and has not changed for a while. It may have been cut short while copying.`,
        });
    } catch (error) {
      findings.push({
        kind: 'unreadable',
        path: f.path,
        message: `"${f.path}" cannot be read: ${(error as Error).message}. If the folder is "online only", download it first. ${KEEP_ON_DEVICE}`,
      });
    }
  }
  if (slow > 0)
    findings.push({
      kind: 'slow-read',
      message: `${slow} file${slow === 1 ? ' was' : 's were'} slow to read (the slowest took ${(slowest / 1000).toFixed(1)} seconds). The folder may keep its files online only. ${KEEP_ON_DEVICE}`,
    });
  return findings;
}
