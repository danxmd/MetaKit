import {
  deepEqual,
  freezeCopy,
  type BaseCommand,
  type ChangeEvent,
  type Json,
  type Patch,
} from '@metakit-app/core';
import { encode, type SyncAdapter } from './adapter';
import { HybridClock } from './clock';
import { updateDocument } from './doc';
import {
  CHANGE_FORMAT,
  changeFilePath,
  formatChangeFile,
  formatSnapshot,
  instanceFolder,
  sequenceOf,
  snapshotPath,
  stateFolder,
} from './files';
import { patchesToOps, type StampedOp } from './ops';
import { pathKey, type DocKind } from './path';
import { loadDocument, Scanner } from './scanner';
import { materialize, type SyncState } from './state';

/** What the session needs from a document store: its state, its change events and a way to take in remote changes. */
export interface SyncableStore {
  readonly state: unknown;
  subscribe(listener: (event: ChangeEvent<never, never>) => void): () => void;
  applyRemote(next: never, patches: readonly Patch[]): void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface Clash {
  /** The register, as a path in the document. */
  path: string[];
  mine: Json | undefined;
  theirs: Json | undefined;
  /** The instance whose edit was kept. */
  by: string;
}

export interface SyncStatus {
  /** Lines written locally and not yet in a change file. */
  pending: number;
  lastFlushAt: number | null;
  lastRemote: { by: string; at: number } | null;
  error: string | null;
}

export interface SessionOptions {
  adapter: SyncAdapter;
  /** The document's folder, such as `models/order-process-9xk2`. */
  folder: string;
  kind: DocKind;
  clock?: HybridClock;
  now?: () => number;
  /** The longest delay between an edit and its change file. */
  flushMs?: number;
  /** How often to fold change files into the snapshot while there are changes. */
  snapshotMs?: number;
  /** Registers of entities deleted longer ago than this are left out of snapshots. */
  retentionMs?: number;
  timers?: Timers;
  /** Retries and delay for files that are not complete yet. */
  retries?: number;
  delayMs?: number;
  onRemote?: (info: { by: string; changes: number }) => void;
  onClash?: (clash: Clash) => void;
  onStatus?: (status: SyncStatus) => void;
  onWarning?: (message: string) => void;
}

const DAY = 24 * 3600 * 1000;

/** Undo reverts the writes of a step: before and after change places, last write first. */
function inverse(patches: readonly Patch[]): Patch[] {
  return [...patches].reverse().map((p) => ({
    path: p.path,
    ...(p.after === undefined ? {} : { before: p.after }),
    ...(p.before === undefined ? {} : { after: p.before }),
  }));
}

/**
 * Connects one document store to the shared folder. Edits made here become change lines (written
 * within `flushMs`); change files and snapshots of other instances are merged into the store
 * without becoming undo steps. It writes only below `_state/<instance>/` of its own document folder.
 */
export class SyncSession {
  private readonly clock: HybridClock;
  private readonly me: string;
  private pending: StampedOp[] = [];
  private nextSeq: number;
  private lastOwnSeq: number;
  private queue: Promise<unknown> = Promise.resolve();
  private flushTimer: unknown = null;
  private snapshotTimer: unknown = null;
  private rescanTimer: unknown = null;
  private unwatch: (() => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private closed = false;
  private dirty = false;
  /** Register key to the sequence of the file it was written in, or null while it is not written yet. */
  private readonly localWrites = new Map<string, number | null>();
  private readonly timers: Timers;
  private currentStatus: SyncStatus = {
    pending: 0,
    lastFlushAt: null,
    lastRemote: null,
    error: null,
  };

  private constructor(
    private readonly options: SessionOptions,
    private readonly store: SyncableStore,
    private readonly state: SyncState,
    private readonly scanner: Scanner,
    clock: HybridClock,
  ) {
    this.clock = clock;
    this.me = options.adapter.instanceId;
    this.timers = options.timers ?? realTimers;
    this.lastOwnSeq = Math.max(
      scanner.highestSeq(this.me),
      scanner.seen()[this.me] ?? 0,
    );
    this.nextSeq = this.lastOwnSeq + 1;
    this.unsubscribe = store.subscribe((event) =>
      this.onStoreEvent(event as ChangeEvent<unknown, BaseCommand>),
    );
  }

  /**
   * Reads the document folder and makes the store from what it holds. `makeStore` receives the
   * merged document, frozen, and returns the store to keep in step with the folder.
   */
  static async open<T extends SyncableStore>(
    options: SessionOptions,
    makeStore: (doc: Record<string, Json>) => T,
  ): Promise<{ session: SyncSession; store: T; warnings: string[] }> {
    const loaded = await loadDocument(
      options.adapter,
      options.folder,
      options.kind,
      {
        ...(options.retries === undefined ? {} : { retries: options.retries }),
        ...(options.delayMs === undefined ? {} : { delayMs: options.delayMs }),
      },
    );
    // From here on this session's own changes are known to it; other instances' are read by `rescan`.
    const clock = options.clock ?? new HybridClock(options.now);
    if (loaded.state.maxT) clock.observe(loaded.state.maxT);
    const doc = freezeCopy(materialize(loaded.state)) as Record<string, Json>;
    const store = makeStore(doc);
    const scanner = new Scanner(options.adapter, options.folder, options.kind, {
      skipOwn: true,
      ...(options.retries === undefined ? {} : { retries: options.retries }),
      ...(options.delayMs === undefined ? {} : { delayMs: options.delayMs }),
    });
    // Carry over how far everything has been read; own files were read by the loader.
    scanner.markCovered(loaded.scanner.seen());
    for (const [inst, n] of Object.entries(loaded.scanner.seen()))
      for (let i = 1; i <= n; i++) scanner.markApplied(inst, i);
    const session = new SyncSession(
      options,
      store,
      loaded.state,
      scanner,
      clock,
    );
    for (const w of loaded.warnings) options.onWarning?.(w);
    return { session, store, warnings: loaded.warnings };
  }

  get status(): SyncStatus {
    return this.currentStatus;
  }

  /** A hash of the merged state, equal on every instance that has read the same files. */
  get hash(): string {
    return this.state.hash;
  }

  /** How far this instance has read every other instance's change files. */
  seen(): Record<string, number> {
    return {
      ...this.scanner.seen(),
      ...(this.lastOwnSeq > 0 ? { [this.me]: this.lastOwnSeq } : {}),
    };
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...patch };
    this.options.onStatus?.(this.currentStatus);
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  // Local edits -------------------------------------------------------------------------------

  private onStoreEvent(event: ChangeEvent<unknown, BaseCommand>): void {
    if (this.closed || event.origin === 'remote') return;
    const patches =
      event.origin === 'undo' ? inverse(event.patches) : event.patches;
    const ops = patchesToOps(this.options.kind, patches, () =>
      this.clock.tick(),
    ).map((op) => ({ ...op, by: this.me }) as StampedOp);
    if (ops.length === 0) return;
    this.state.applyAll(ops);
    for (const op of ops) this.localWrites.set(pathKey(op.p), null);
    this.pending.push(...ops);
    this.dirty = true;
    this.setStatus({ pending: this.pending.length });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null || this.closed) return;
    this.flushTimer = this.timers.setTimeout(() => {
      this.flushTimer = null;
      void this.flush().catch(() => undefined);
    }, this.options.flushMs ?? 2000);
  }

  /** Writes the pending lines as one change file; resolves when it is in the folder. */
  flush(): Promise<void> {
    if (this.flushTimer !== null) {
      this.timers.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    return this.enqueue(() => this.writePending());
  }

  private async writePending(): Promise<void> {
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    const lines = batch.map(({ by: _by, ...op }) => op);
    let seq = this.nextSeq;
    for (let attempt = 0; ; attempt++) {
      const text = formatChangeFile(
        { format: CHANGE_FORMAT, by: this.me, seen: this.scanner.seen() },
        lines,
      );
      try {
        await this.options.adapter.writeNew(
          changeFilePath(this.options.folder, this.me, seq),
          encode(text),
        );
        break;
      } catch (error) {
        const name = (error as Error).name;
        if (name === 'AlreadyExistsError' && attempt < 20) {
          seq += 1; // a file of this name exists (an earlier run of this tab): take the next number
          continue;
        }
        this.pending = [...batch, ...this.pending];
        this.setStatus({
          pending: this.pending.length,
          error: `Could not write changes: ${(error as Error).message}`,
        });
        this.scheduleRetry();
        throw error;
      }
    }
    this.nextSeq = seq + 1;
    this.lastOwnSeq = seq;
    this.scanner.markApplied(this.me, seq);
    for (const op of batch) {
      const key = pathKey(op.p);
      if (this.localWrites.get(key) === null) this.localWrites.set(key, seq);
    }
    this.setStatus({
      pending: this.pending.length,
      lastFlushAt: this.now(),
      error: null,
    });
  }

  private scheduleRetry(): void {
    if (this.flushTimer !== null || this.closed) return;
    this.flushTimer = this.timers.setTimeout(() => {
      this.flushTimer = null;
      void this.flush().catch(() => undefined);
    }, 5000);
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  // Remote changes ----------------------------------------------------------------------------

  /** Reads change files and snapshots of other instances that are new and merges them into the store. */
  rescan(): Promise<number> {
    return this.enqueue(async () => {
      if (this.closed) return 0;
      const result = await this.scanner.scan();
      for (const w of result.warnings) this.options.onWarning?.(w);
      const touches = [];
      let lastBy: string | null = null;
      let changes = 0;
      for (const snap of result.snapshots) {
        for (const op of opsOf(snap.state)) this.clock.observe(op.t);
        const t = this.state.mergeFrom(snap.state);
        if (t.length > 0) lastBy = snap.instance;
        touches.push(...t);
      }
      for (const batch of result.batches) {
        for (const op of batch.ops) {
          this.clock.observe(op.t);
          const touch = this.state.apply(op);
          if (!touch) continue;
          touches.push(touch);
          lastBy = batch.by;
          this.checkClash(
            op,
            touch.previous,
            batch.header.seen[this.me] ?? 0,
            batch.by,
          );
        }
      }
      if (touches.length === 0) return 0;
      const { doc, patches } = updateDocument(
        this.state,
        this.store.state as Record<string, Json>,
        touches,
      );
      changes = patches.length;
      if (changes > 0) this.store.applyRemote(doc as never, patches);
      this.dirty = true;
      if (lastBy !== null && changes > 0) {
        this.setStatus({ lastRemote: { by: lastBy, at: this.now() } });
        this.options.onRemote?.({ by: lastBy, changes });
      }
      return changes;
    });
  }

  /** A remote write replaced one of mine that its author had not read: report it. */
  private checkClash(
    op: StampedOp,
    previous: { by: string; v: Json | undefined } | undefined,
    theySaw: number,
    by: string,
  ): void {
    if (!previous || previous.by !== this.me) return;
    const theirs = 'v' in op ? op.v : undefined;
    if (
      deepEqual(previous.v ?? null, theirs ?? null) &&
      (previous.v === undefined) === (theirs === undefined)
    )
      return;
    const mine = this.localWrites.get(pathKey(op.p));
    if (mine === undefined) return;
    if (mine === null || mine > theySaw)
      this.options.onClash?.({ path: op.p, mine: previous.v, theirs, by });
  }

  /** Asks for a rescan soon; many calls in a short time make one. */
  requestRescan(delayMs = 200): void {
    if (this.rescanTimer !== null || this.closed) return;
    this.rescanTimer = this.timers.setTimeout(() => {
      this.rescanTimer = null;
      void this.rescan().catch((e: Error) =>
        this.options.onWarning?.(`Reading changes failed: ${e.message}`),
      );
    }, delayMs);
  }

  /** Starts watching the folder for new files and writes a snapshot now and then. */
  start(): void {
    if (this.unwatch || this.closed) return;
    this.unwatch = this.options.adapter.watch(
      stateFolder(this.options.folder),
      () => this.requestRescan(),
    );
    this.scheduleSnapshot();
    this.requestRescan(0);
  }

  // Snapshots ---------------------------------------------------------------------------------

  private scheduleSnapshot(): void {
    if (this.snapshotTimer !== null || this.closed) return;
    this.snapshotTimer = this.timers.setTimeout(
      () => {
        this.snapshotTimer = null;
        void this.snapshot()
          .catch((e: Error) =>
            this.options.onWarning?.(
              `Writing the snapshot failed: ${e.message}`,
            ),
          )
          .finally(() => this.scheduleSnapshot());
      },
      this.options.snapshotMs ?? 3 * 60 * 1000,
    );
  }

  /**
   * Writes this instance's snapshot (its merged state and how far it has read everyone) and then
   * removes its own change files that the snapshot folds in. Files of other instances are not touched.
   */
  snapshot(): Promise<void> {
    return this.enqueue(async () => {
      await this.writePending();
      if (!this.dirty && this.lastOwnSeq === 0) return;
      this.state.compact(this.now(), this.options.retentionMs ?? 30 * DAY);
      const seen = this.seen();
      const text = formatSnapshot(this.state, {
        instance: this.me,
        savedAt: new Date(this.now()).toISOString(),
        seen,
      });
      await this.options.adapter.overwrite(
        snapshotPath(this.options.folder, this.me),
        encode(text),
      );
      this.scanner.markCovered(seen);
      this.dirty = false;
      const own = await this.options.adapter.list(
        instanceFolder(this.options.folder, this.me),
      );
      for (const entry of own) {
        const seq = sequenceOf(entry.name);
        if (entry.kind === 'file' && seq !== null && seq <= this.lastOwnSeq)
          await this.options.adapter.remove(
            `${instanceFolder(this.options.folder, this.me)}/${entry.name}`,
          );
      }
    });
  }

  /** Writes what is pending, folds it into the snapshot, and stops. */
  async close(): Promise<void> {
    if (this.closed) return;
    for (const h of [this.flushTimer, this.snapshotTimer, this.rescanTimer])
      if (h !== null) this.timers.clearTimeout(h);
    this.flushTimer = this.snapshotTimer = this.rescanTimer = null;
    this.unwatch?.();
    this.unwatch = null;
    try {
      await this.snapshot();
    } finally {
      this.closed = true;
      this.unsubscribe?.();
      this.unsubscribe = null;
    }
  }
}

function* opsOf(state: SyncState): Generator<{ t: string }> {
  // Only the largest stamp matters to the clock, and the state tracks it.
  if (state.maxT) yield { t: state.maxT };
}
