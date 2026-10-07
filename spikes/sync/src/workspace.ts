import { HybridClock } from './clock';
import {
  TOMBSTONE_FIELD,
  applyOps,
  emptyState,
  liveElements,
  mergeStates,
  type Op,
  type State,
} from './merge';

export interface Presence {
  id: string;
  name: string;
  color: string;
  at: number;
  model: string;
}

export interface WorkspaceOptions {
  root: FileSystemDirectoryHandle;
  instanceId: string;
  name: string;
  color: string;
  /** Longest delay between an edit and its change file. */
  flushMs?: number;
  /** Scan interval where FileSystemObserver is missing. */
  scanMs?: number;
  snapshotMs?: number;
  presenceMs?: number;
}

interface SnapshotFile {
  format: 'spike-0';
  instance: string;
  state: State;
  /** Highest change-file sequence folded in, per instance. */
  upTo: Record<string, number>;
}

export interface WorkspaceStats {
  filesWritten: number;
  filesRead: number;
  /** Reads that failed to parse (a sync client can expose a file mid-copy). */
  partialReads: number;
  scans: number;
  observer: boolean;
}

const MODEL_ID = 'mdl_main';

async function dir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

async function writeText(
  parent: FileSystemDirectoryHandle,
  name: string,
  text: string,
): Promise<void> {
  const handle = await parent.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function readText(handle: FileSystemFileHandle): Promise<string> {
  return (await handle.getFile()).text();
}

const sequenceOf = (name: string): number | null => {
  const match = /^(\d{6})\.jsonl$/.exec(name);
  return match ? Number(match[1]) : null;
};

export class Workspace {
  state: State = emptyState();
  readonly stats: WorkspaceStats = {
    filesWritten: 0,
    filesRead: 0,
    partialReads: 0,
    scans: 0,
    observer: false,
  };
  /** Latest change that came from another instance, for the status line. */
  lastRemote: { by: string; at: number } | null = null;
  presence: Presence[] = [];
  onChange: () => void = () => undefined;

  private readonly clock = new HybridClock();
  private readonly seen = new Set<string>();
  private readonly snapshotStamp = new Map<string, string>();
  /** Per instance: change files up to this sequence are already inside a snapshot we merged. */
  private readonly covered: Record<string, number> = {};
  private readonly maxRead: Record<string, number> = {};
  private pending: Op[] = [];
  private seq = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private observer: FileSystemObserverLike | null = null;
  private scanning = false;
  private rescan = false;
  private dirty = false;
  private stateDir!: FileSystemDirectoryHandle;
  private ownDir!: FileSystemDirectoryHandle;
  private presenceDir!: FileSystemDirectoryHandle;

  constructor(private readonly options: WorkspaceOptions) {}

  get instanceId(): string {
    return this.options.instanceId;
  }

  async start(): Promise<void> {
    const { root, instanceId } = this.options;
    this.stateDir = await dir(root, '_state');
    this.ownDir = await dir(this.stateDir, instanceId);
    this.presenceDir = await dir(root, '_presence');
    try {
      await root.getFileHandle('workspace.json');
    } catch {
      // Both instances may race here; they write the same content, so either result is fine.
      await writeText(
        root,
        'workspace.json',
        `${JSON.stringify({ spike: true, models: [MODEL_ID] }, null, 2)}\n`,
      );
    }
    await this.scan(true);
    this.seq = (this.maxRead[instanceId] ?? this.covered[instanceId] ?? -1) + 1;
    await this.writePresence();

    const { FileSystemObserver } = window;
    if (FileSystemObserver) {
      try {
        this.observer = new FileSystemObserver(() => void this.scan());
        await this.observer.observe(root, { recursive: true });
        this.stats.observer = true;
      } catch {
        this.observer = null;
      }
    }
    // Without the observer the scan is the only change detection; with it, a slow scan covers
    // lost notifications.
    const scanMs = this.observer ? 10_000 : (this.options.scanMs ?? 2000);
    this.timers.push(setInterval(() => void this.scan(), scanMs));
    this.timers.push(
      setInterval(
        () => void this.writePresence(),
        this.options.presenceMs ?? 10_000,
      ),
    );
    this.timers.push(
      setInterval(
        () => void this.snapshot(),
        this.options.snapshotMs ?? 180_000,
      ),
    );
  }

  stop(): void {
    this.observer?.disconnect();
    for (const timer of this.timers) clearInterval(timer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  /** Local edit: applied at once, written to a change file within `flushMs`. */
  edit(el: string, field: string, value?: unknown): void {
    const op: Op = {
      t: this.clock.tick(),
      by: this.options.instanceId,
      el,
      f: field,
      ...(field === TOMBSTONE_FIELD ? {} : { v: value }),
    };
    this.state = applyOps(this.state, [op]);
    this.pending.push(op);
    this.dirty = true;
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(
        () => void this.flush(),
        this.options.flushMs ?? 2000,
      );
    }
    this.onChange();
  }

  elements(): Record<string, Record<string, unknown>> {
    return liveElements(this.state);
  }

  /** Writes pending edits as one new, never-rewritten change file. */
  async flush(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.pending.length === 0) return;
    const ops = this.pending;
    this.pending = [];
    const name = `${String(this.seq).padStart(6, '0')}.jsonl`;
    this.seq += 1;
    const text = `${ops.map((op) => JSON.stringify(op)).join('\n')}\n`;
    await writeText(this.ownDir, name, text);
    this.seen.add(`${this.options.instanceId}/${name}`);
    this.maxRead[this.options.instanceId] = this.seq - 1;
    this.stats.filesWritten += 1;
  }

  /** Folds everything read so far into snapshot.json, then removes own change files it covers. */
  async snapshot(): Promise<void> {
    await this.flush();
    if (!this.dirty) return;
    const { instanceId } = this.options;
    const upTo: Record<string, number> = { ...this.covered };
    for (const [id, seq] of Object.entries(this.maxRead)) {
      upTo[id] = Math.max(upTo[id] ?? -1, seq);
    }
    const file: SnapshotFile = {
      format: 'spike-0',
      instance: instanceId,
      state: this.state,
      upTo,
    };
    await writeText(this.ownDir, 'snapshot.json', `${JSON.stringify(file)}\n`);
    this.covered[instanceId] = Math.max(
      this.covered[instanceId] ?? -1,
      upTo[instanceId] ?? -1,
    );
    for await (const [name] of this.ownDir.entries()) {
      const seq = sequenceOf(name);
      if (seq !== null && seq <= (upTo[instanceId] ?? -1)) {
        await this.ownDir.removeEntry(name);
      }
    }
    this.dirty = false;
  }

  /** Reads snapshots and change files not seen yet. Overlapping calls are merged into one. */
  async scan(initial = false): Promise<void> {
    if (this.scanning) {
      this.rescan = true;
      return;
    }
    this.scanning = true;
    try {
      do {
        this.rescan = false;
        await this.scanOnce(initial);
        await this.readPresence();
      } while (this.rescan);
    } finally {
      this.scanning = false;
    }
  }

  private async scanOnce(initial: boolean): Promise<void> {
    this.stats.scans += 1;
    const { instanceId } = this.options;
    const incoming: Op[] = [];
    const snapshots: State[] = [];
    const newRemote = new Set<string>();

    for await (const [id, handle] of this.stateDir.entries()) {
      if (handle.kind !== 'directory') continue;
      const instanceDir = handle as FileSystemDirectoryHandle;
      const files: [string, FileSystemFileHandle][] = [];
      for await (const [name, entry] of instanceDir.entries()) {
        if (entry.kind === 'file')
          files.push([name, entry as FileSystemFileHandle]);
      }
      const isOwn = id === instanceId;

      const snapshotEntry = files.find(([name]) => name === 'snapshot.json');
      if (snapshotEntry && (!isOwn || initial)) {
        const file = await snapshotEntry[1].getFile();
        const stamp = `${file.lastModified}:${file.size}`;
        if (this.snapshotStamp.get(id) !== stamp) {
          const parsed = await this.parse<SnapshotFile>(file);
          if (parsed) {
            this.snapshotStamp.set(id, stamp);
            snapshots.push(parsed.state);
            for (const [who, seq] of Object.entries(parsed.upTo)) {
              this.covered[who] = Math.max(this.covered[who] ?? -1, seq);
            }
            if (!isOwn) newRemote.add(id);
          }
        }
      }

      for (const [name, fileHandle] of files.sort(([a], [b]) =>
        a < b ? -1 : 1,
      )) {
        const seq = sequenceOf(name);
        if (seq === null) continue;
        this.maxRead[id] = Math.max(this.maxRead[id] ?? -1, seq);
        const key = `${id}/${name}`;
        if (this.seen.has(key)) continue;
        if (isOwn && !initial) continue;
        if (seq <= (this.covered[id] ?? -1)) {
          this.seen.add(key);
          continue;
        }
        const file = await fileHandle.getFile();
        const parsed = await this.parseLines(file);
        if (!parsed) continue; // Possibly mid-copy; the next scan retries it.
        this.seen.add(key);
        incoming.push(...parsed);
        if (!isOwn) newRemote.add(id);
      }
    }

    if (snapshots.length === 0 && incoming.length === 0) return;
    for (const snapshot of snapshots)
      this.state = mergeStates(this.state, snapshot);
    this.state = applyOps(this.state, incoming);
    for (const op of incoming) this.clock.observe(op.t);
    const remoteBy =
      incoming.filter((op) => op.by !== instanceId).at(-1)?.by ??
      [...newRemote][0];
    if (remoteBy) this.lastRemote = { by: remoteBy, at: Date.now() };
    this.onChange();
  }

  private async parse<T>(file: File): Promise<T | null> {
    this.stats.filesRead += 1;
    try {
      return JSON.parse(await file.text()) as T;
    } catch {
      this.stats.partialReads += 1;
      return null;
    }
  }

  private async parseLines(file: File): Promise<Op[] | null> {
    this.stats.filesRead += 1;
    const text = await file.text();
    // A new file is visible before its content lands. Change files always end in a newline, so
    // anything else is a partial read and is retried on the next scan.
    if (!text.endsWith('\n')) {
      this.stats.partialReads += 1;
      return null;
    }
    try {
      return text
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Op);
    } catch {
      this.stats.partialReads += 1;
      return null;
    }
  }

  async writePresence(): Promise<void> {
    const { instanceId, name, color } = this.options;
    const presence: Presence = {
      id: instanceId,
      name,
      color,
      at: Date.now(),
      model: MODEL_ID,
    };
    await writeText(
      this.presenceDir,
      `${instanceId}.json`,
      `${JSON.stringify(presence)}\n`,
    );
  }

  private async readPresence(): Promise<void> {
    const found: Presence[] = [];
    for await (const [name, handle] of this.presenceDir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
      try {
        const parsed = JSON.parse(
          await readText(handle as FileSystemFileHandle),
        ) as Presence;
        // 30 s is three refresh periods: one missed write does not drop someone.
        if (
          parsed.id !== this.options.instanceId &&
          Date.now() - parsed.at < 30_000
        ) {
          found.push(parsed);
        }
      } catch {
        // A half-synced presence file is ignored until the next refresh.
      }
    }
    this.presence = found;
  }

  nameOf(id: string): string {
    return this.presence.find((p) => p.id === id)?.name ?? id;
  }
}
