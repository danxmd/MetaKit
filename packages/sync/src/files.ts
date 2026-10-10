import type { Json } from '@metakit-app/core';
import { isTimestamp } from './clock';
import { NewerFormatError, SyncFormatError } from './errors';
import { checkOp, flatten, type Op, type StampedOp } from './ops';
import type { DocKind } from './path';
import {
  stateFromDocument,
  SyncState,
  type Entity,
  type Register,
} from './state';

export const CHANGE_FORMAT = 1;
export const SNAPSHOT_FORMAT = 2;

export const stateFolder = (folder: string) => `${folder}/_state`;
export const instanceFolder = (folder: string, instance: string) =>
  `${folder}/_state/${instance}`;
export const snapshotPath = (folder: string, instance: string) =>
  `${folder}/_state/${instance}/snapshot.json`;
export const changeFilePath = (folder: string, instance: string, seq: number) =>
  `${folder}/_state/${instance}/${String(seq).padStart(6, '0')}.jsonl`;

/** The sequence number in a change file name, or null for other names. */
export function sequenceOf(name: string): number | null {
  const m = /^(\d{6,})\.jsonl$/.exec(name);
  return m ? Number(m[1]) : null;
}

export interface ChangeHeader {
  format: number;
  by: string;
  /** The highest change-file sequence this instance had read from each other instance. */
  seen: Record<string, number>;
}

/** The text of a change file: a header line, then one line per op, each ending in a newline. */
export function formatChangeFile(
  header: ChangeHeader,
  ops: readonly Op[],
): string {
  const lines = [JSON.stringify(header), ...ops.map((o) => JSON.stringify(o))];
  return `${lines.join('\n')}\n`;
}

export interface ParsedChangeFile {
  header: ChangeHeader;
  ops: StampedOp[];
}

/** Parses a change file written by `by`. A file without a final newline is not complete yet. */
export function parseChangeFile(text: string, by: string): ParsedChangeFile {
  if (!text.endsWith('\n'))
    throw new SyncFormatError(
      'The change file is not complete (no final newline).',
    );
  const lines = text.slice(0, -1).split('\n');
  let header: unknown;
  try {
    header = JSON.parse(lines[0]!);
  } catch {
    throw new SyncFormatError(
      'The first line of the change file is not valid JSON.',
    );
  }
  const h = header as Partial<ChangeHeader> | null;
  if (!h || typeof h !== 'object' || typeof h.format !== 'number')
    throw new SyncFormatError('The change file has no header line.');
  if (h.format > CHANGE_FORMAT)
    throw new NewerFormatError(
      `The change file is in format ${h.format}, newer than this version understands (${CHANGE_FORMAT}).`,
    );
  if (h.by !== by)
    throw new SyncFormatError(
      `The change file says it is from ${String(h.by)} but lies in the folder of ${by}.`,
    );
  const ops: StampedOp[] = [];
  for (let i = 1; i < lines.length; i++) {
    let value: unknown;
    try {
      value = JSON.parse(lines[i]!);
    } catch {
      throw new SyncFormatError(
        `Line ${i + 1} of the change file is not valid JSON.`,
      );
    }
    const checked = checkOp(value);
    if (typeof checked === 'string')
      throw new SyncFormatError(
        `Line ${i + 1} of the change file: ${checked}.`,
      );
    ops.push({ ...checked, by });
  }
  return { header: { format: h.format, by, seen: h.seen ?? {} }, ops };
}

// Snapshots ---------------------------------------------------------------------------------

/** A register in a snapshot: the index of its stamp, and its value unless it was unset. */
type Cell = [number] | [number, Json];

interface SnapshotEntity {
  b?: number;
  d?: number;
  f: Record<string, Cell>;
}

export interface SnapshotHeader {
  formatVersion: number;
  kind: DocKind;
  instance: string;
  savedAt: string;
  /** The highest change-file sequence folded in, per instance (this one included). */
  seen: Record<string, number>;
  /** Hash of the merged state, so that a reader can adopt it without recomputing. */
  hash: string;
}

export interface SnapshotFile extends SnapshotHeader {
  instances: string[];
  /** Every distinct stamp once: `[time, index into instances]`. */
  stamps: [string, number][];
  plain: Record<string, Cell>;
  entities: Record<string, SnapshotEntity>;
}

/**
 * The text of a snapshot. It is meant for machines: stamps are listed once and shared, and each
 * entity is one line, so a file with tens of thousands of registers stays small and a diff still
 * shows which entity changed. The small header comes first so that it can be read alone.
 */
export function formatSnapshot(
  state: SyncState,
  meta: { instance: string; savedAt: string; seen: Record<string, number> },
): string {
  const instances: string[] = [meta.instance];
  const stampIndex = new Map<string, number>();
  const stamps: [string, number][] = [];
  const stampOf = (s: { t: string; by: string }): number => {
    const key = `${s.t}|${s.by}`;
    let i = stampIndex.get(key);
    if (i === undefined) {
      let by = instances.indexOf(s.by);
      if (by < 0) by = instances.push(s.by) - 1;
      i = stamps.push([s.t, by]) - 1;
      stampIndex.set(key, i);
    }
    return i;
  };
  const cell = (r: Register): Cell =>
    r.v === undefined ? [stampOf(r)] : [stampOf(r), r.v];
  const plainLines = [...state.plain.keys()]
    .sort()
    .map(
      (k) =>
        `    ${JSON.stringify(k)}: ${JSON.stringify(cell(state.plain.get(k)!))}`,
    );
  const entityLines = [...state.entities.keys()].sort().map((key) => {
    const e = state.entities.get(key)!;
    const out: SnapshotEntity = { f: {} };
    if (e.birth) out.b = stampOf(e.birth);
    if (e.death) out.d = stampOf(e.death);
    for (const k of [...e.fields.keys()].sort())
      out.f[k] = cell(e.fields.get(k)!);
    return `    ${JSON.stringify(key)}: ${JSON.stringify(out)}`;
  });
  const sortedSeen = Object.fromEntries(
    Object.entries(meta.seen).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const lines = [
    '{',
    `  "formatVersion": ${SNAPSHOT_FORMAT},`,
    `  "kind": ${JSON.stringify(state.kind)},`,
    `  "instance": ${JSON.stringify(meta.instance)},`,
    `  "savedAt": ${JSON.stringify(meta.savedAt)},`,
    `  "seen": ${JSON.stringify(sortedSeen)},`,
    `  "hash": ${JSON.stringify(state.hash)},`,
    `  "instances": ${JSON.stringify(instances)},`,
    `  "stamps": ${JSON.stringify(stamps)},`,
    '  "plain": {',
    plainLines.join(',\n'),
    '  },',
    '  "entities": {',
    entityLines.join(',\n'),
    '  }',
    '}',
  ];
  return `${lines.join('\n').replace(/\n\n/g, '\n')}\n`;
}

/**
 * Format 1 held a plain document. It becomes a state with every register written at the time it
 * was saved by the instance that saved it (migration of `snapshot` from 1 to 2).
 */
export function snapshotV1ToState(file: Record<string, unknown>): {
  state: SyncState;
  seen: Record<string, number>;
  instance: string;
  savedAt: string;
} {
  const kind = file['kind'];
  if (kind !== 'tool' && kind !== 'model')
    throw new SyncFormatError(
      'The snapshot does not say whether it holds a Kit or a model.',
    );
  const doc = file['document'];
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc))
    throw new SyncFormatError('The snapshot has no document.');
  const instance = String(file['instance'] ?? 'unknown');
  const savedAtText = String(file['savedAt'] ?? '');
  const wall = Date.parse(savedAtText);
  if (Number.isNaN(wall))
    throw new SyncFormatError('The snapshot has no valid save time.');
  const t = `${new Date(wall).toISOString()}/000000`;
  const state = stateFromDocument(kind, doc as Record<string, Json>, {
    t,
    by: instance,
  });
  return { state, seen: {}, instance, savedAt: savedAtText };
}

export interface ParsedSnapshot {
  state: SyncState;
  seen: Record<string, number>;
  instance: string;
  savedAt: string;
  /** The format the file was in; below the current one means it was migrated in memory. */
  from: number;
}

function check(text: string): void {
  if (!text.endsWith('\n'))
    throw new SyncFormatError(
      'The snapshot is not complete (no final newline).',
    );
}

/**
 * Reads only the small header of a snapshot: who wrote it, when, and how far it had read. Returns
 * null for format 1, which has no such header and is read as a whole.
 */
export function parseSnapshotHeader(
  text: string,
  expectedKind?: DocKind,
): SnapshotHeader | null {
  check(text);
  const cut = text.indexOf('\n  "instances"');
  if (cut < 0) {
    // A format 1 file, or something else: let the full parser say which.
    return null;
  }
  let header: SnapshotHeader;
  try {
    header = JSON.parse(
      `${text.slice(0, cut).replace(/,\s*$/, '')}\n}`,
    ) as SnapshotHeader;
  } catch {
    throw new SyncFormatError('The header of the snapshot is not valid JSON.');
  }
  if (header.formatVersion > SNAPSHOT_FORMAT)
    throw new NewerFormatError(
      `The snapshot is in format ${header.formatVersion}, newer than this version understands (${SNAPSHOT_FORMAT}).`,
    );
  if (expectedKind && header.kind !== expectedKind)
    throw new SyncFormatError(
      `The snapshot holds a ${String(header.kind)}, not a ${expectedKind}.`,
    );
  return header;
}

export function parseSnapshot(
  text: string,
  expectedKind?: DocKind,
): ParsedSnapshot {
  check(text);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new SyncFormatError('The snapshot is not valid JSON.');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new SyncFormatError('The snapshot must contain an object.');
  const file = value as Record<string, unknown>;
  const version = file['formatVersion'];
  if (typeof version !== 'number')
    throw new SyncFormatError('The snapshot has no format version.');
  if (version > SNAPSHOT_FORMAT)
    throw new NewerFormatError(
      `The snapshot is in format ${version}, newer than this version understands (${SNAPSHOT_FORMAT}).`,
    );
  if (expectedKind && file['kind'] !== expectedKind)
    throw new SyncFormatError(
      `The snapshot holds a ${String(file['kind'])}, not a ${expectedKind}.`,
    );
  if (version === 1) return { ...snapshotV1ToState(file), from: 1 };
  if (version !== SNAPSHOT_FORMAT)
    throw new SyncFormatError(`Unknown snapshot format ${version}.`);

  const f = file as unknown as SnapshotFile;
  const stamps = f.stamps.map(([t, i]) => {
    const by = f.instances[i];
    if (!isTimestamp(t) || by === undefined)
      throw new SyncFormatError('The snapshot has a malformed stamp.');
    return { t, by };
  });
  const stampAt = (i: number) => {
    const s = stamps[i];
    if (!s)
      throw new SyncFormatError(
        'The snapshot refers to a stamp that is not listed.',
      );
    return s;
  };
  let maxT = '';
  const register = (p: string[], c: Cell): Register => {
    const s = stampAt(c[0]);
    if (s.t > maxT) maxT = s.t;
    return { t: s.t, by: s.by, p, v: c.length === 1 ? undefined : c[1] };
  };
  const plain = new Map<string, Register>();
  for (const [k, c] of Object.entries(f.plain))
    plain.set(k, register(keyPath(k), c));
  const entities = new Map<string, Entity>();
  for (const [ek, e] of Object.entries(f.entities)) {
    const slash = ek.indexOf('/');
    const entity: Entity = {
      collection: ek.slice(0, slash),
      id: ek.slice(slash + 1),
      fields: new Map(),
    };
    if (e.b !== undefined) entity.birth = stampAt(e.b);
    if (e.d !== undefined) entity.death = stampAt(e.d);
    for (const [k, c] of Object.entries(e.f))
      entity.fields.set(k, register(keyPath(k), c));
    for (const s of [entity.birth, entity.death])
      if (s && s.t > maxT) maxT = s.t;
    entities.set(ek, entity);
  }
  const state = SyncState.adopt(f.kind, {
    entities,
    plain,
    hash: f.hash,
    maxT,
  });
  return {
    state,
    seen: f.seen ?? {},
    instance: f.instance,
    savedAt: f.savedAt,
    from: version,
  };
}

function keyPath(key: string): string[] {
  return key.split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export { flatten };

/**
 * Migration of the `snapshot` file kind from format 1 (a plain document) to format 2 (registers),
 * as JSON text for the storage layer's migration registry.
 */
export function snapshotV1ToV2(
  file: Record<string, unknown>,
): Record<string, unknown> {
  const { state, instance, savedAt } = snapshotV1ToState(file);
  return JSON.parse(
    formatSnapshot(state, { instance, savedAt, seen: {} }),
  ) as Record<string, unknown>;
}
