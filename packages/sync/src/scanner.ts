import { decode, sleep, type SyncAdapter } from './adapter';
import { NewerFormatError, PartialFileError, SyncFormatError } from './errors';
import {
  instanceFolder,
  parseChangeFile,
  parseSnapshot,
  sequenceOf,
  stateFolder,
  snapshotPath,
  type ChangeHeader,
} from './files';
import type { StampedOp } from './ops';
import type { DocKind } from './path';
import { SyncState } from './state';

export interface ScanBatch {
  by: string;
  seq: number;
  header: ChangeHeader;
  ops: StampedOp[];
}

export interface ScanSnapshot {
  instance: string;
  state: SyncState;
  seen: Record<string, number>;
  savedAt: string;
  /** Format the file was in; 1 means it came from a phase 1 workspace. */
  from: number;
}

export interface ScanResult {
  snapshots: ScanSnapshot[];
  batches: ScanBatch[];
  warnings: string[];
}

export interface ScannerOptions {
  /** Leave this instance's own folder out (a running session already knows its own changes). */
  skipOwn?: boolean;
  /** Tries before a file without a final newline is left for the next scan. */
  retries?: number;
  delayMs?: number;
}

/**
 * Finds what is new in a document folder: snapshots that changed and change files not read yet.
 * It remembers how far it has read every instance, which is what a snapshot and a change-file
 * header report as `seen`.
 */
export class Scanner {
  private readonly covered = new Map<string, number>();
  private readonly applied = new Map<string, Set<number>>();
  private readonly snapshotSig = new Map<string, string>();
  private readonly broken = new Set<string>();
  private readonly highest = new Map<string, number>();
  private readonly retries: number;
  private readonly delayMs: number;

  constructor(
    private readonly adapter: SyncAdapter,
    private readonly folder: string,
    private readonly kind: DocKind,
    private readonly options: ScannerOptions = {},
  ) {
    this.retries = options.retries ?? 3;
    this.delayMs = options.delayMs ?? 100;
  }

  /** How far each instance's change files are known to be read: no gaps below the number. */
  seen(): Record<string, number> {
    const out: Record<string, number> = {};
    const instances = new Set([...this.covered.keys(), ...this.applied.keys()]);
    for (const inst of instances) {
      let n = this.covered.get(inst) ?? 0;
      const set = this.applied.get(inst);
      while (set?.has(n + 1)) n += 1;
      if (n > 0) out[inst] = n;
    }
    return out;
  }

  /** Records that a file of this instance's own was written, so it is never read back. */
  /** The highest sequence number seen for an instance, in a change file or in a snapshot's `seen`. */
  highestSeq(instance: string): number {
    return this.highest.get(instance) ?? 0;
  }

  markApplied(instance: string, seq: number): void {
    if (seq > (this.highest.get(instance) ?? 0))
      this.highest.set(instance, seq);
    let set = this.applied.get(instance);
    if (!set) this.applied.set(instance, (set = new Set()));
    set.add(seq);
  }

  /** Records what a snapshot this instance wrote covers. */
  markCovered(seen: Record<string, number>): void {
    for (const [inst, n] of Object.entries(seen)) {
      if (n > (this.covered.get(inst) ?? 0)) this.covered.set(inst, n);
      if (n > (this.highest.get(inst) ?? 0)) this.highest.set(inst, n);
    }
  }

  private isRead(instance: string, seq: number): boolean {
    return (
      seq <= (this.covered.get(instance) ?? 0) ||
      (this.applied.get(instance)?.has(seq) ?? false)
    );
  }

  private async readText(path: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const text = decode(await this.adapter.read(path));
      if (text.endsWith('\n')) return text;
      if (attempt >= this.retries)
        throw new PartialFileError(`${path} is not complete yet.`);
      await sleep(this.delayMs);
    }
  }

  async scan(): Promise<ScanResult> {
    const result: ScanResult = { snapshots: [], batches: [], warnings: [] };
    const dirs = (await this.adapter.list(stateFolder(this.folder)))
      .filter((e) => e.kind === 'directory')
      .map((e) => e.name)
      .filter(
        (name) => !(this.options.skipOwn && name === this.adapter.instanceId),
      )
      .sort();
    const listings = new Map<
      string,
      Awaited<ReturnType<SyncAdapter['list']>>
    >();
    for (const inst of dirs)
      listings.set(
        inst,
        await this.adapter.list(instanceFolder(this.folder, inst)),
      );

    // Snapshots first: what they cover need not be read from change files.
    for (const inst of dirs) {
      const entry = listings
        .get(inst)!
        .find((e) => e.kind === 'file' && e.name === 'snapshot.json');
      if (!entry) continue;
      const sig = `${entry.size ?? '?'}:${entry.modified ?? '?'}`;
      if (this.snapshotSig.get(inst) === sig) continue;
      try {
        const parsed = parseSnapshot(
          await this.readText(snapshotPath(this.folder, inst)),
          this.kind,
        );
        this.snapshotSig.set(inst, sig);
        this.markCovered(parsed.seen);
        result.snapshots.push({
          instance: inst,
          state: parsed.state,
          seen: parsed.seen,
          savedAt: parsed.savedAt,
          from: parsed.from,
        });
      } catch (error) {
        if (error instanceof NewerFormatError) throw error;
        // Not complete yet, or damaged: the change files still carry what happened, and the next scan tries again.
        result.warnings.push(
          `The snapshot of instance ${inst} could not be read yet: ${(error as Error).message}`,
        );
      }
    }

    for (const inst of dirs) {
      const files = listings
        .get(inst)!
        .flatMap((e) =>
          e.kind === 'file' ? [{ seq: sequenceOf(e.name), name: e.name }] : [],
        )
        .filter((f): f is { seq: number; name: string } => f.seq !== null)
        .sort((a, b) => a.seq - b.seq);
      for (const { seq, name } of files) {
        const id = `${inst}/${name}`;
        if (this.isRead(inst, seq) || this.broken.has(id)) continue;
        const path = `${instanceFolder(this.folder, inst)}/${name}`;
        try {
          const parsed = parseChangeFile(await this.readText(path), inst);
          result.batches.push({
            by: inst,
            seq,
            header: parsed.header,
            ops: parsed.ops,
          });
          this.markApplied(inst, seq);
        } catch (error) {
          if (error instanceof NewerFormatError) throw error;
          if (error instanceof PartialFileError) {
            result.warnings.push(
              `${id} is not complete yet; it will be read again.`,
            );
          } else if (error instanceof SyncFormatError) {
            this.broken.add(id);
            result.warnings.push(`${id} was skipped: ${error.message}`);
          } else if ((error as Error).name === 'NotFoundError') {
            // Removed between listing and reading (its owner folded it into a snapshot).
          } else {
            result.warnings.push(
              `${id} could not be read: ${(error as Error).message}`,
            );
          }
        }
      }
    }
    return result;
  }
}

export interface LoadedDocument {
  state: SyncState;
  scanner: Scanner;
  warnings: string[];
  /** Files read, for measuring. */
  files: number;
  snapshots: number;
}

/** Reads a document folder: every snapshot and every change file not folded into one, merged. */
export async function loadDocument(
  adapter: SyncAdapter,
  folder: string,
  kind: DocKind,
  options: ScannerOptions = {},
): Promise<LoadedDocument> {
  const scanner = new Scanner(adapter, folder, kind, options);
  const result = await scanner.scan();
  const state = new SyncState(kind);
  for (const s of result.snapshots) state.mergeFrom(s.state);
  for (const b of result.batches) state.applyAll(b.ops);
  return {
    state,
    scanner,
    warnings: result.warnings,
    files: result.batches.length,
    snapshots: result.snapshots.length,
  };
}
