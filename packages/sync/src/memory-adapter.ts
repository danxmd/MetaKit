// A test adapter that behaves like the storage layer's: write-once files, and an instance may only
// overwrite or remove its own files. It records every write so that tests can check the rule.
import { decode, encode, type SyncAdapter, type SyncDirEntry } from './adapter';

interface Stored {
  data: Uint8Array;
  modified: number;
}

export class MemoryFolder {
  readonly files = new Map<string, Stored>();
  clock = 1;
  /** Every write and removal, with who did it. */
  readonly log: {
    by: string;
    op: 'new' | 'overwrite' | 'remove';
    path: string;
  }[] = [];

  instance(id: string): MemoryAdapter {
    return new MemoryAdapter(this, id);
  }

  text(path: string): string {
    return decode(this.files.get(path)!.data);
  }

  paths(): string[] {
    return [...this.files.keys()].sort();
  }
}

class NamedError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

export class MemoryAdapter implements SyncAdapter {
  readonly watchers = new Set<{
    dir: string;
    cb: (changed: string[]) => void;
  }>();

  constructor(
    private readonly folder: MemoryFolder,
    readonly instanceId: string,
  ) {}

  private ownArea(path: string): boolean {
    return (
      path.includes(`/_state/${this.instanceId}/`) ||
      path === `_presence/${this.instanceId}.json`
    );
  }

  async list(dir: string): Promise<SyncDirEntry[]> {
    const prefix = dir === '' ? '' : `${dir}/`;
    const out = new Map<string, SyncDirEntry>();
    for (const [path, f] of this.folder.files) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash < 0)
        out.set(rest, {
          name: rest,
          kind: 'file',
          size: f.data.length,
          modified: f.modified,
        });
      else
        out.set(rest.slice(0, slash), {
          name: rest.slice(0, slash),
          kind: 'directory',
        });
    }
    return [...out.values()];
  }

  async read(path: string): Promise<Uint8Array> {
    const f = this.folder.files.get(path);
    if (!f) throw new NamedError('NotFoundError', `${path} does not exist`);
    return f.data;
  }

  async exists(path: string): Promise<boolean> {
    return this.folder.files.has(path);
  }

  private put(path: string, data: Uint8Array) {
    this.folder.files.set(path, { data, modified: this.folder.clock++ });
    for (const w of this.watchers) if (path.startsWith(w.dir)) w.cb([path]);
  }

  async writeNew(path: string, data: Uint8Array): Promise<void> {
    if (path.includes('/_state/') && !this.ownArea(path))
      throw new NamedError(
        'NotOwnedError',
        `${path} belongs to another instance`,
      );
    if (this.folder.files.has(path))
      throw new NamedError('AlreadyExistsError', `${path} exists`);
    this.folder.log.push({ by: this.instanceId, op: 'new', path });
    this.put(path, data);
  }

  async overwrite(path: string, data: Uint8Array): Promise<void> {
    if (!this.ownArea(path))
      throw new NamedError(
        'NotOwnedError',
        `${path} belongs to another instance`,
      );
    this.folder.log.push({ by: this.instanceId, op: 'overwrite', path });
    this.put(path, data);
  }

  async remove(path: string): Promise<void> {
    if (!this.ownArea(path))
      throw new NamedError(
        'NotOwnedError',
        `${path} belongs to another instance`,
      );
    this.folder.log.push({ by: this.instanceId, op: 'remove', path });
    this.folder.files.delete(path);
  }

  watch(dir: string, cb: (changed: string[]) => void): () => void {
    const w = { dir, cb };
    this.watchers.add(w);
    return () => this.watchers.delete(w);
  }
}

export const planted = (folder: MemoryFolder, path: string, text: string) =>
  folder.files.set(path, { data: encode(text), modified: folder.clock++ });
