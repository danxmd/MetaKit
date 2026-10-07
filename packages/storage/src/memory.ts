import {
  toBytes,
  type DirEntry,
  type StorageAdapter,
  type Unwatch,
  type WatchCallback,
} from './adapter';
import { AlreadyExistsError, NotFoundError } from './errors';
import { assertMayWrite, checkInstanceId, checkPath } from './paths';
import { pollWatch } from './watch';

interface File {
  data: Uint8Array;
  modified: number;
}

/** A workspace held in memory, for tests and for building documents before they are saved. */
export class MemoryAdapter implements StorageAdapter {
  readonly instanceId: string;
  private readonly files = new Map<string, File>();
  private clock = 1;

  constructor(
    instanceId = 'memory0001',
    private readonly options: {
      pollIntervalMs?: number;
      files?: ReadonlyMap<string, File>;
    } = {},
  ) {
    this.instanceId = checkInstanceId(instanceId);
    for (const [path, file] of options.files ?? []) this.files.set(path, file);
  }

  /** Another instance looking at the same files, as a second browser would. */
  asInstance(instanceId: string): MemoryAdapter {
    const other = new MemoryAdapter(instanceId, {
      ...this.options,
      files: this.files,
    });
    // Shares the same map so that both see each other's writes.
    (other as unknown as { files: Map<string, File> }).files = this.files;
    return other;
  }

  private tick(): number {
    return this.clock++;
  }

  async list(dir: string): Promise<DirEntry[]> {
    checkPath(dir);
    const prefix = dir === '' ? '' : `${dir}/`;
    const entries = new Map<string, DirEntry>();
    for (const [path, file] of this.files) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash < 0)
        entries.set(rest, {
          name: rest,
          kind: 'file',
          size: file.data.length,
          modified: file.modified,
        });
      else
        entries.set(rest.slice(0, slash), {
          name: rest.slice(0, slash),
          kind: 'directory',
        });
    }
    return [...entries.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  async read(path: string): Promise<Uint8Array> {
    checkPath(path);
    const file = this.files.get(path);
    if (!file) throw new NotFoundError(`There is no file "${path}".`);
    return file.data.slice();
  }

  async exists(path: string): Promise<boolean> {
    checkPath(path);
    return this.files.has(path);
  }

  async writeNew(path: string, data: Uint8Array): Promise<void> {
    checkPath(path);
    assertMayWrite(path, this.instanceId, 'new');
    if (this.files.has(path))
      throw new AlreadyExistsError(
        `"${path}" already exists. Files that other instances may have read are written once and never replaced.`,
      );
    this.files.set(path, { data: data.slice(), modified: this.tick() });
  }

  async overwrite(path: string, data: Uint8Array): Promise<void> {
    checkPath(path);
    assertMayWrite(path, this.instanceId, 'own');
    this.files.set(path, { data: data.slice(), modified: this.tick() });
  }

  async remove(path: string): Promise<void> {
    checkPath(path);
    assertMayWrite(path, this.instanceId, 'own');
    this.files.delete(path);
  }

  watch(dir: string, callback: WatchCallback): Unwatch {
    checkPath(dir);
    return pollWatch(this, dir, callback, {
      intervalMs: this.options.pollIntervalMs ?? 50,
    }).stop;
  }

  /** Test helper: every path, sorted. */
  paths(): string[] {
    return [...this.files.keys()].sort();
  }

  /** Test helper: puts a file in place as if another program had written it. */
  plant(path: string, content: string | Uint8Array): void {
    this.files.set(path, {
      data: typeof content === 'string' ? toBytes(content) : content.slice(),
      modified: this.tick(),
    });
  }
}
