export interface DirEntry {
  name: string;
  kind: 'file' | 'directory';
  /** Bytes, for files. */
  size?: number;
  /** Milliseconds since 1970, for files. */
  modified?: number;
}

export type Unwatch = () => void;

/** Called with the paths (relative to the workspace) that appeared, changed or disappeared. */
export type WatchCallback = (changed: string[]) => void;

/**
 * Everything MetaKit needs from a place that holds a workspace. Paths are relative to the
 * workspace root, use `/`, and are checked (see `checkPath`). The same operations work on a
 * folder on disk, a folder picked in the browser, and memory.
 */
export interface StorageAdapter {
  /** This app instance. It may overwrite and remove only files in its own area (rule 6). */
  readonly instanceId: string;
  /** Entries of a folder; an empty list if it does not exist. Temporary `.part` files are not listed. */
  list(dir: string): Promise<DirEntry[]>;
  /** Throws `NotFoundError`. */
  read(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  /** Creates the file and any missing folders. Throws `AlreadyExistsError` if the path is taken. */
  writeNew(path: string, data: Uint8Array): Promise<void>;
  /** Replaces or creates one of this instance's own files. Readers see the old or the new content, whole. */
  overwrite(path: string, data: Uint8Array): Promise<void>;
  /** Removes one of this instance's own files. Removing a file that is already gone is not an error. */
  remove(path: string): Promise<void>;
  /** Reports changes under `dir`, including in subfolders. */
  watch(dir: string, callback: WatchCallback): Unwatch;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export const toBytes = (text: string): Uint8Array => encoder.encode(text);
export const fromBytes = (bytes: Uint8Array): string => decoder.decode(bytes);
