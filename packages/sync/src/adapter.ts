/**
 * What the sync layer needs from a place that holds a workspace. It is the same shape as the
 * storage layer's adapter (which satisfies it), declared here so that this package does not
 * depend on storage.
 */
export interface SyncDirEntry {
  name: string;
  kind: 'file' | 'directory';
  size?: number | undefined;
  modified?: number | undefined;
}

export interface SyncAdapter {
  /** This app instance; it writes only below `_state/<instanceId>/` and `_presence/<instanceId>.json`. */
  readonly instanceId: string;
  list(dir: string): Promise<SyncDirEntry[]>;
  read(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  /** Creates a file that must not exist yet (`AlreadyExistsError` otherwise). */
  writeNew(path: string, data: Uint8Array): Promise<void>;
  overwrite(path: string, data: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  watch(dir: string, callback: (changed: string[]) => void): () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const encode = (text: string): Uint8Array => encoder.encode(text);
export const decode = (bytes: Uint8Array): string => decoder.decode(bytes);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
