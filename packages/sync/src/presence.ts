import { decode, encode, type SyncAdapter } from './adapter';
import { NewerFormatError, SyncFormatError } from './errors';
import type { DocKind } from './path';
import type { Timers } from './session';

export const PRESENCE_FORMAT = 1;

export interface PresenceDocument {
  kind: DocKind;
  /** The folder name of the document in the workspace. */
  slug: string;
}

/** What one instance tells the others, in `_presence/<instanceId>.json`. */
export interface PresenceFile {
  formatVersion: number;
  instance: string;
  name: string;
  colour: string;
  /** When it was written, ISO 8601. */
  at: string;
  document: PresenceDocument | null;
  /** Ids of the elements or connectors selected. */
  selection: string[];
  /** An item opened in an editor (a script or rule, later), for the soft warning. */
  editing: string | null;
  /** Hash of the merged state of the open document. */
  hash: string;
  /** How far the instance has read every instance's change files. */
  seen: Record<string, number>;
}

export const presencePath = (instance: string) => `_presence/${instance}.json`;

export function formatPresence(p: PresenceFile): string {
  const sorted = Object.fromEntries(
    Object.entries(p).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

export function parsePresence(text: string): PresenceFile {
  if (!text.endsWith('\n'))
    throw new SyncFormatError('The presence file is not complete yet.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new SyncFormatError('The presence file is not valid JSON.');
  }
  const p = value as Partial<PresenceFile> | null;
  if (!p || typeof p !== 'object' || typeof p.formatVersion !== 'number')
    throw new SyncFormatError('The presence file has no format version.');
  if (p.formatVersion > PRESENCE_FORMAT)
    throw new NewerFormatError(
      `The presence file is in format ${p.formatVersion}, newer than this version understands.`,
    );
  if (
    typeof p.instance !== 'string' ||
    typeof p.name !== 'string' ||
    typeof p.at !== 'string'
  )
    throw new SyncFormatError(
      'The presence file lacks its instance, name or time.',
    );
  return {
    formatVersion: p.formatVersion,
    instance: p.instance,
    name: p.name,
    colour: typeof p.colour === 'string' ? p.colour : '#868e96',
    at: p.at,
    document: p.document ?? null,
    selection: Array.isArray(p.selection) ? p.selection.map(String) : [],
    editing: typeof p.editing === 'string' ? p.editing : null,
    hash: typeof p.hash === 'string' ? p.hash : '',
    seen: p.seen ?? {},
  };
}

/** A presence file counts for 30 seconds after it was written. */
export function isFresh(
  p: PresenceFile,
  nowMs: number,
  maxAgeMs = 30_000,
): boolean {
  const at = Date.parse(p.at);
  return !Number.isNaN(at) && nowMs - at <= maxAgeMs;
}

export interface Divergence {
  document: PresenceDocument;
  a: PresenceFile;
  b: PresenceFile;
}

const sameSeen = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
};

/**
 * Pairs of instances with the same document open that have read exactly the same files but hold
 * different states. Different `seen` only means that one has not caught up yet.
 */
export function detectDivergence(files: readonly PresenceFile[]): Divergence[] {
  const out: Divergence[] = [];
  for (let i = 0; i < files.length; i++)
    for (let j = i + 1; j < files.length; j++) {
      const a = files[i]!;
      const b = files[j]!;
      if (!a.document || !b.document) continue;
      if (
        a.document.kind !== b.document.kind ||
        a.document.slug !== b.document.slug
      )
        continue;
      if (
        a.hash !== '' &&
        b.hash !== '' &&
        a.hash !== b.hash &&
        sameSeen(a.seen, b.seen)
      )
        out.push({ document: a.document, a, b });
    }
  return out;
}

/** Other people who have an item open in an editor, for the warning before editing it too. */
export function whoIsEditing(
  people: readonly PresenceFile[],
  document: PresenceDocument,
  item: string,
  me: string,
): PresenceFile[] {
  return people.filter(
    (p) =>
      p.instance !== me &&
      p.editing === item &&
      p.document?.kind === document.kind &&
      p.document.slug === document.slug,
  );
}

export interface PresenceProfile {
  name: string;
  colour: string;
}

export interface PresenceOptions {
  adapter: SyncAdapter;
  profile: PresenceProfile;
  now?: () => number;
  timers?: Timers;
  /** How often the file is refreshed. */
  intervalMs?: number;
  /** How long after its last write a file still counts. */
  staleMs?: number;
  /** The least time between writes caused by changes of selection. */
  minGapMs?: number;
  onPeople?: (people: PresenceFile[]) => void;
}

/** What the open document reports about itself. */
export interface DocumentReport {
  hash: string;
  seen: Record<string, number>;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * Writes this instance's presence file every few seconds and reads everyone else's. It writes
 * only `_presence/<instanceId>.json`, and removes it when stopped.
 */
export class PresenceService {
  private readonly me: string;
  private readonly timers: Timers;
  private document: PresenceDocument | null = null;
  private report: () => DocumentReport = () => ({ hash: '', seen: {} });
  private selection: string[] = [];
  private editing: string | null = null;
  private timer: unknown = null;
  private gapTimer: unknown = null;
  private lastWrite = -Infinity;
  private running = false;
  private unwatch: (() => void) | null = null;
  private watchTimer: unknown = null;
  private current: PresenceFile[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: PresenceOptions) {
    this.me = options.adapter.instanceId;
    this.timers = options.timers ?? realTimers;
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  /** The people seen at the last refresh, not including this instance. */
  get people(): PresenceFile[] {
    return this.current;
  }

  setDocument(
    document: PresenceDocument | null,
    report?: () => DocumentReport,
  ): void {
    this.document = document;
    this.selection = [];
    this.editing = null;
    this.report = report ?? (() => ({ hash: '', seen: {} }));
    this.touch();
  }

  setSelection(ids: Iterable<string>): void {
    this.selection = [...ids].sort();
    this.touch();
  }

  setEditing(item: string | null): void {
    this.editing = item;
    this.touch();
  }

  setProfile(profile: PresenceProfile): void {
    this.options.profile.name = profile.name;
    this.options.profile.colour = profile.colour;
    this.touch();
  }

  /** A change worth telling the others soon, but not more often than `minGapMs`. */
  private touch(): void {
    if (!this.running || this.gapTimer !== null) return;
    const wait = Math.max(
      0,
      (this.options.minGapMs ?? 1000) - (this.now() - this.lastWrite),
    );
    this.gapTimer = this.timers.setTimeout(() => {
      this.gapTimer = null;
      void this.refresh().catch(() => undefined);
    }, wait);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // A change in someone else's file is read at once (without writing our own, which would make
    // the others read in turn, for ever); the timer covers adapters that cannot report changes.
    this.unwatch = this.options.adapter.watch('_presence', () => {
      if (this.watchTimer !== null) return;
      this.watchTimer = this.timers.setTimeout(() => {
        this.watchTimer = null;
        void this.readOnly().catch(() => undefined);
      }, 300);
    });
    void this.refresh().catch(() => undefined);
  }

  /** Reads the others' files without writing ours. */
  readOnly(): Promise<PresenceFile[]> {
    const job = this.queue.then(async () => {
      if (!this.running) return this.current;
      const people = await this.read();
      if (JSON.stringify(people) !== JSON.stringify(this.current)) {
        this.current = people;
        this.options.onPeople?.(people);
      }
      return this.current;
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Writes this instance's file and reads the others'. */
  refresh(): Promise<PresenceFile[]> {
    const job = this.queue.then(async () => {
      if (!this.running) return this.current;
      await this.write();
      this.current = await this.read();
      this.options.onPeople?.(this.current);
      return this.current;
    });
    this.queue = job.catch(() => undefined);
    return job.finally(() => this.scheduleNext());
  }

  private scheduleNext(): void {
    if (!this.running || this.timer !== null) return;
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      void this.refresh().catch(() => undefined);
    }, this.options.intervalMs ?? 10_000);
  }

  private async write(): Promise<void> {
    const report = this.document ? this.report() : { hash: '', seen: {} };
    const file: PresenceFile = {
      formatVersion: PRESENCE_FORMAT,
      instance: this.me,
      name: this.options.profile.name,
      colour: this.options.profile.colour,
      at: new Date(this.now()).toISOString(),
      document: this.document,
      selection: this.selection,
      editing: this.editing,
      hash: report.hash,
      seen: report.seen,
    };
    await this.options.adapter.overwrite(
      presencePath(this.me),
      encode(formatPresence(file)),
    );
    this.lastWrite = this.now();
  }

  private async read(): Promise<PresenceFile[]> {
    const staleMs = this.options.staleMs ?? 30_000;
    const out: PresenceFile[] = [];
    for (const entry of await this.options.adapter.list('_presence')) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
      if (entry.name === `${this.me}.json`) continue;
      try {
        const p = parsePresence(
          decode(await this.options.adapter.read(`_presence/${entry.name}`)),
        );
        if (isFresh(p, this.now(), staleMs)) out.push(p);
      } catch {
        // Half written or from a newer version: it is read again at the next refresh.
      }
    }
    return out.sort((a, b) => (a.instance < b.instance ? -1 : 1));
  }

  /** Stops, and removes this instance's presence file so that others see it leave at once. */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    for (const h of [this.timer, this.gapTimer])
      if (h !== null) this.timers.clearTimeout(h);
    this.timer = this.gapTimer = null;
    await this.queue;
    await this.options.adapter
      .remove(presencePath(this.me))
      .catch(() => undefined);
    this.current = [];
  }
}
