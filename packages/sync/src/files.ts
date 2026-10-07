import type { Json } from '@metakit-app/core';
import { isTimestamp } from './clock';
import { NewerFormatError, SyncFormatError } from './errors';
import { checkOp, flatten, type Op, type StampedOp } from './ops';
import type { DocKind } from './path';
import { stateFromDocument, SyncState, type Register } from './state';

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

type Cell = [string, number] | [string, number, Json];

interface SnapshotEntity {
  b?: [string, number];
  d?: [string, number];
  f: Record<string, Cell>;
}

export interface SnapshotFile {
  formatVersion: number;
  kind: DocKind;
  instance: string;
  savedAt: string;
  /** The highest change-file sequence folded in, per instance (this one included). */
  seen: Record<string, number>;
  instances: string[];
  entities: Record<string, SnapshotEntity>;
  plain: Record<string, Cell>;
}

/**
 * The text of a snapshot. It is meant for machines: one entity per line, so that a file with tens
 * of thousands of registers stays small and a diff still shows which entity changed.
 */
export function formatSnapshot(
  state: SyncState,
  meta: { instance: string; savedAt: string; seen: Record<string, number> },
): string {
  const instances = new Set<string>([meta.instance]);
  const idx = (by: string) => {
    instances.add(by);
    return [...instances].indexOf(by);
  };
  const cell = (r: Register): Cell =>
    r.v === undefined ? [r.t, idx(r.by)] : [r.t, idx(r.by), r.v];
  const entities: Record<string, SnapshotEntity> = {};
  for (const key of [...state.entities.keys()].sort()) {
    const e = state.entities.get(key)!;
    const out: SnapshotEntity = { f: {} };
    if (e.birth) out.b = [e.birth.t, idx(e.birth.by)];
    if (e.death) out.d = [e.death.t, idx(e.death.by)];
    for (const k of [...e.fields.keys()].sort())
      out.f[k] = cell(e.fields.get(k)!);
    entities[key] = out;
  }
  const plain: Record<string, Cell> = {};
  for (const k of [...state.plain.keys()].sort())
    plain[k] = cell(state.plain.get(k)!);

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
    `  "instances": ${JSON.stringify([...instances])},`,
    '  "plain": {',
    ...Object.entries(plain).map(
      ([k, c], i, a) =>
        `    ${JSON.stringify(k)}: ${JSON.stringify(c)}${i < a.length - 1 ? ',' : ''}`,
    ),
    '  },',
    '  "entities": {',
    ...Object.entries(entities).map(
      ([k, e], i, a) =>
        `    ${JSON.stringify(k)}: ${JSON.stringify(e)}${i < a.length - 1 ? ',' : ''}`,
    ),
    '  }',
    '}',
  ];
  return `${lines.join('\n')}\n`;
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
      'The snapshot does not say whether it holds a tool library or a model.',
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

export function parseSnapshot(
  text: string,
  expectedKind?: DocKind,
): ParsedSnapshot {
  if (!text.endsWith('\n'))
    throw new SyncFormatError(
      'The snapshot is not complete (no final newline).',
    );
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
  const state = new SyncState(f.kind);
  const stamp = (c: [string, number]) => {
    if (!isTimestamp(c[0]) || f.instances[c[1]] === undefined)
      throw new SyncFormatError('The snapshot has a malformed stamp.');
    return { t: c[0], by: f.instances[c[1]]! };
  };
  const ops: StampedOp[] = [];
  const cellOp = (p: string[], c: Cell): StampedOp => {
    const at = stamp([c[0], c[1]]);
    return c.length === 2 ? { ...at, p, u: 1 } : { ...at, p, v: c[2] };
  };
  for (const [k, c] of Object.entries(f.plain))
    ops.push(cellOp(k === '' ? [] : keyPath(k), c));
  for (const [ek, e] of Object.entries(f.entities)) {
    const base = ek.split('/');
    if (e.b) ops.push({ ...stamp(e.b), p: base, b: 1 });
    if (e.d) ops.push({ ...stamp(e.d), p: base, d: 1 });
    for (const [k, c] of Object.entries(e.f))
      ops.push(cellOp([...base, ...keyPath(k)], c));
  }
  state.applyAll(ops);
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
