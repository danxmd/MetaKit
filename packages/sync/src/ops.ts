import { deepEqual, type Json, type Patch } from '@metakit-app/core';
import { COLLECTIONS, entityOf, type DocKind, type Path } from './path';
import { isTimestamp } from './clock';

/**
 * One edit, as it is stored in a change file (ADR 0002). The instance that wrote it is the folder
 * of the file; in memory it is carried as `by`.
 */
export type OpBody =
  /** Set a register. */
  | { v: Json }
  /** Unset a register: the field is absent. */
  | { u: 1 }
  /** An entity is born (created, or brought back by an undo). */
  | { b: 1 }
  /** An entity is deleted. */
  | { d: 1 };

export type Op = { t: string; p: string[] } & OpBody;
export type StampedOp = Op & { by: string };

export type OpKind = 'set' | 'unset' | 'birth' | 'death';

export function opKind(op: Op): OpKind {
  if ('v' in op) return 'set';
  if ('u' in op) return 'unset';
  if ('b' in op) return 'birth';
  return 'death';
}

/** Checks one parsed change line; returns the op or a reason it is not one. */
export function checkOp(value: unknown): Op | string {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return 'a change line must be an object';
  const o = value as Record<string, unknown>;
  if (!isTimestamp(o['t'])) return 'the stamp "t" is missing or malformed';
  if (
    !Array.isArray(o['p']) ||
    o['p'].length === 0 ||
    o['p'].some((x) => typeof x !== 'string')
  )
    return 'the path "p" must be a list of names';
  const kinds = ['v', 'u', 'b', 'd'].filter((k) => k in o);
  if (kinds.length !== 1)
    return 'a change line needs exactly one of v, u, b or d';
  if (kinds[0] !== 'v' && o[kinds[0]!] !== 1) return `"${kinds[0]}" must be 1`;
  return value as Op;
}

const isRecord = (value: unknown): value is Record<string, Json> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The registers a value is made of, below `path`: every plain object is a container register (an
 * empty object, so that it exists even when all its keys are removed) and its keys are written
 * one by one. Arrays and everything else are one register each (ADR 0002).
 */
export function flatten(path: Path, value: Json): [string[], Json][] {
  const out: [string[], Json][] = [];
  const walk = (p: string[], v: Json) => {
    if (isRecord(v)) {
      out.push([p, {}]);
      for (const [k, child] of Object.entries(v)) walk([...p, k], child);
    } else out.push([p, v]);
  };
  walk([...path], value);
  return out;
}

const keyOf = (p: readonly string[]) => JSON.stringify(p);

/**
 * Turns the writes of one store step into change lines. A new entity gets a birth and all its
 * registers, a removed one a death, anything else the registers that changed or disappeared.
 * `stamp` is called once per line, so lines of one step have increasing stamps.
 */
export function patchesToOps(
  kind: DocKind,
  patches: readonly Patch[],
  stamp: () => string,
): Op[] {
  const ops: Op[] = [];
  const set = (p: string[], v: Json) => ops.push({ t: stamp(), p, v });
  const unset = (p: string[]) => ops.push({ t: stamp(), p, u: 1 });

  /** Writes what differs between two values at a path; `skipRoot` leaves out the root container (an entity). */
  const diff = (
    path: string[],
    before: Json | undefined,
    after: Json | undefined,
    skipRoot = false,
  ) => {
    const leaves = (value: Json | undefined) => {
      const list = value === undefined ? [] : flatten(path, value);
      return new Map(
        (skipRoot ? list.slice(1) : list).map(([p, v]) => [
          keyOf(p),
          [p, v] as const,
        ]),
      );
    };
    const a = leaves(after);
    const b = leaves(before);
    for (const [k, [p, v]] of a) {
      const old = b.get(k);
      if (!old || !deepEqual(old[1], v)) set(p, v);
    }
    for (const [k, [p]] of b) if (!a.has(k)) unset(p);
  };

  const entity = (
    collection: string,
    id: string,
    before: Json | undefined,
    after: Json | undefined,
  ) => {
    const path = [collection, id];
    if (before === undefined && after !== undefined) {
      ops.push({ t: stamp(), p: path, b: 1 });
      diff(path, undefined, after, true);
    } else if (before !== undefined && after === undefined) {
      ops.push({ t: stamp(), p: path, d: 1 });
    } else if (before !== undefined && after !== undefined) {
      // The whole record replaced: write what differs, field by field.
      diff(path, before, after, true);
    }
  };

  for (const patch of patches) {
    const { path, before, after } = patch;
    if (path.length === 1 && COLLECTIONS[kind].includes(path[0]!)) {
      // A whole collection written at once.
      const b = isRecord(before) ? before : {};
      const a = isRecord(after) ? after : {};
      for (const id of new Set([...Object.keys(b), ...Object.keys(a)]))
        entity(path[0]!, id, b[id], a[id]);
      continue;
    }
    const ref = entityOf(kind, path);
    if (ref && ref.rest.length === 0)
      entity(ref.collection, ref.id, before, after);
    else diff([...path], before, after);
  }
  return ops;
}
