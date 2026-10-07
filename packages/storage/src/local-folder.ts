import type {
  DirEntry,
  StorageAdapter,
  Unwatch,
  WatchCallback,
} from './adapter';
import { AlreadyExistsError, NotFoundError } from './errors';
import {
  assertMayWrite,
  baseName,
  checkInstanceId,
  checkPath,
  parentOf,
} from './paths';
import { pollWatch } from './watch';

const PART = '.part';

const isMissing = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'NotFoundError' || error.name === 'TypeMismatchError');

/**
 * A workspace in a folder the user picked in the browser (File System Access API, Chrome and
 * Edge on desktop). Files are replaced atomically when a write finishes; a new file can be seen
 * empty for a moment, which readers handle through the "ends with a newline" rule.
 */
export class LocalFolderAdapter implements StorageAdapter {
  readonly instanceId: string;

  constructor(
    private readonly root: FileSystemDirectoryHandle,
    instanceId: string,
    private readonly options: {
      pollIntervalMs?: number;
      useObserver?: boolean;
    } = {},
  ) {
    this.instanceId = checkInstanceId(instanceId);
  }

  private async folder(
    path: string,
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | null> {
    let handle = this.root;
    for (const part of checkPath(path)) {
      try {
        handle = await handle.getDirectoryHandle(part, { create });
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    }
    return handle;
  }

  async list(dir: string): Promise<DirEntry[]> {
    const folder = await this.folder(dir, false);
    if (!folder) return [];
    const entries: DirEntry[] = [];
    for await (const [name, handle] of folder.entries()) {
      if (name.endsWith(PART)) continue;
      if (handle.kind === 'directory')
        entries.push({ name, kind: 'directory' });
      else {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          entries.push({
            name,
            kind: 'file',
            size: file.size,
            modified: file.lastModified,
          });
        } catch (error) {
          // Removed between the listing and the read.
          if (!isMissing(error)) throw error;
        }
      }
    }
    return entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  async read(path: string): Promise<Uint8Array> {
    checkPath(path);
    const folder = await this.folder(parentOf(path), false);
    try {
      if (!folder) throw new NotFoundError(`There is no file "${path}".`);
      const handle = await folder.getFileHandle(baseName(path));
      return new Uint8Array(await (await handle.getFile()).arrayBuffer());
    } catch (error) {
      if (isMissing(error))
        throw new NotFoundError(`There is no file "${path}".`);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    checkPath(path);
    const folder = await this.folder(parentOf(path), false);
    if (!folder) return false;
    try {
      await folder.getFileHandle(baseName(path));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  private async write(path: string, data: Uint8Array): Promise<void> {
    const folder = (await this.folder(parentOf(path), true))!;
    const handle = await folder.getFileHandle(baseName(path), { create: true });
    // The browser writes to a temporary copy and swaps it in when the stream closes.
    const stream = await handle.createWritable();
    await stream.write(data as unknown as BufferSource);
    await stream.close();
  }

  async writeNew(path: string, data: Uint8Array): Promise<void> {
    checkPath(path);
    assertMayWrite(path, this.instanceId, 'new');
    if (await this.exists(path)) {
      throw new AlreadyExistsError(
        `"${path}" already exists. Files that other instances may have read are written once and never replaced.`,
      );
    }
    await this.write(path, data);
  }

  async overwrite(path: string, data: Uint8Array): Promise<void> {
    checkPath(path);
    assertMayWrite(path, this.instanceId, 'own');
    await this.write(path, data);
  }

  async remove(path: string): Promise<void> {
    checkPath(path);
    assertMayWrite(path, this.instanceId, 'own');
    const folder = await this.folder(parentOf(path), false);
    if (!folder) return;
    try {
      await folder.removeEntry(baseName(path));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  watch(dir: string, callback: WatchCallback): Unwatch {
    checkPath(dir);
    const Observer =
      this.options.useObserver === false
        ? undefined
        : window.FileSystemObserver;
    // With a native observer the scan is only a safety net; without one it is the detection.
    const watcher = pollWatch(this, dir, callback, {
      intervalMs: this.options.pollIntervalMs ?? (Observer ? 10_000 : 2000),
    });
    let observer: FileSystemObserverLike | null = null;
    let stopped = false;
    if (Observer) {
      void (async () => {
        try {
          const target = await this.folder(dir, false);
          if (!target || stopped) return;
          observer = new Observer(() => void watcher.check());
          await observer.observe(target, { recursive: true });
        } catch {
          // Not supported for this kind of folder: the scan covers it.
        }
      })();
    }
    return () => {
      stopped = true;
      watcher.stop();
      observer?.disconnect();
    };
  }
}
