import type { Json } from '@metakit-app/core';
import { compareStamps, parseTimestamp } from './clock';
import { flatten, opKind, type StampedOp } from './ops';
import { entityKey, entityOf, keyToPath, pathKey, type DocKind } from './path';

export interface Stamp {
  t: string;
  by: string;
}

/** A register: the winning write for one path. `v` is undefined when the winning write unset it. */
export interface Register extends Stamp {
  p: string[];
  v: Json | undefined;
}

export interface Entity {
  collection: string;
  id: string;
  birth?: Stamp;
  death?: Stamp;
  /** Registers by their path below the entity. */
  fields: Map<string, Register>;
}

/** What an op changed, so that a caller can rebuild only that part of the document. */
export type Touch = (
  { entity: string; plain?: undefined } | { plain: string; entity?: undefined }
) & {
  /** The register this op replaced, for notices about clashes; undefined for births and deaths. */
  previous?: Register | undefined;
  /** The path of the register, for notices. */
  path?: string[] | undefined;
};

/** A 64-bit text hash in two 32-bit halves; summing these over all registers is order independent. */
function hashText(text: string): [number, number] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

const valueText = (v: Json | undefined) =>
  v === undefined ? '~unset' : JSON.stringify(v);

/**
 * The merged state of one document: every register's winning write, and every entity's birth and
 * death. Applying an op keeps the maximum per register, so the state depends only on which ops
 * were applied, not on their order or repetition.
 */
export class SyncState {
  readonly entities = new Map<string, Entity>();
  readonly plain = new Map<string, Register>();
  /** The highest stamp of any op applied, so that a clock can start after it. */
  maxT = '';
  private sumA = 0;
  private sumB = 0;

  constructor(readonly kind: DocKind) {}

  private add(name: string, stamp: Stamp, v: Json | undefined, sign: 1 | -1) {
    const [a, b] = hashText(`${name}|${stamp.t}|${stamp.by}|${valueText(v)}`);
    this.sumA = (this.sumA + sign * a) >>> 0;
    this.sumB = (this.sumB + sign * b) >>> 0;
  }

  /** A hash of the whole state: equal for equal states, whatever order the ops came in. */
  get hash(): string {
    return (
      this.sumA.toString(16).padStart(8, '0') +
      this.sumB.toString(16).padStart(8, '0')
    );
  }

  /**
   * Builds a state from registers that are already merged (a snapshot), without comparing each
   * one: much faster than applying them as ops. `hash` is the hash the snapshot was written with.
   */
  static adopt(
    kind: DocKind,
    parts: {
      entities: Map<string, Entity>;
      plain: Map<string, Register>;
      hash: string;
      maxT: string;
    },
  ): SyncState {
    const state = new SyncState(kind);
    for (const [k, e] of parts.entities) state.entities.set(k, e);
    for (const [k, r] of parts.plain) state.plain.set(k, r);
    state.maxT = parts.maxT;
    state.sumA = parseInt(parts.hash.slice(0, 8), 16) >>> 0;
    state.sumB = parseInt(parts.hash.slice(8, 16), 16) >>> 0;
    return state;
  }

  /** Applies one op; returns what changed, or null if the op did not win (or was already there). */
  apply(op: StampedOp): Touch | null {
    if (op.t > this.maxT) this.maxT = op.t;
    const kind = opKind(op);
    const ref = entityOf(this.kind, op.p);
    const stamp: Stamp = { t: op.t, by: op.by };
    if (!ref) {
      if (kind === 'birth' || kind === 'death') return null;
      const key = pathKey(op.p);
      const current = this.plain.get(key);
      if (current && compareStamps(stamp, current) <= 0) return null;
      if (current) this.add(`p/${key}`, current, current.v, -1);
      const v = 'v' in op ? op.v : undefined;
      this.plain.set(key, { ...stamp, p: op.p, v });
      this.add(`p/${key}`, stamp, v, 1);
      return { plain: key, previous: current, path: op.p };
    }
    const ek = entityKey(ref.collection, ref.id);
    let entity = this.entities.get(ek);
    if (!entity) {
      entity = { collection: ref.collection, id: ref.id, fields: new Map() };
      this.entities.set(ek, entity);
    }
    if (ref.rest.length === 0) {
      if (kind === 'birth' || kind === 'death') {
        const slot = kind === 'birth' ? 'birth' : 'death';
        const current = entity[slot];
        if (current && compareStamps(stamp, current) <= 0) return null;
        if (current) this.add(`${ek}#${slot}`, current, undefined, -1);
        entity[slot] = stamp;
        this.add(`${ek}#${slot}`, stamp, undefined, 1);
        return { entity: ek };
      }
      return null; // a value written at the entity itself is not a thing: ignored
    }
    if (kind === 'birth' || kind === 'death') return null;
    const key = pathKey(ref.rest);
    const current = entity.fields.get(key);
    if (current && compareStamps(stamp, current) <= 0) return null;
    if (current) this.add(`${ek}/${key}`, current, current.v, -1);
    const v = 'v' in op ? op.v : undefined;
    entity.fields.set(key, { ...stamp, p: ref.rest, v });
    this.add(`${ek}/${key}`, stamp, v, 1);
    return {
      entity: ek,
      previous: current,
      path: [ref.collection, ref.id, ...ref.rest],
    };
  }

  /** Applies ops and returns the distinct places that changed. */
  applyAll(ops: Iterable<StampedOp>): Touch[] {
    const seen = new Set<string>();
    const touches: Touch[] = [];
    for (const op of ops) {
      const touch = this.apply(op);
      if (!touch) continue;
      const id =
        touch.entity !== undefined ? `e:${touch.entity}` : `p:${touch.plain}`;
      if (!seen.has(id)) {
        seen.add(id);
        touches.push(touch);
      }
    }
    return touches;
  }

  isAlive(key: string): boolean {
    const e = this.entities.get(key);
    if (!e?.birth) return false;
    return !e.death || compareStamps(e.birth, e.death) > 0;
  }

  /** Merges another state into this one; returns what changed. */
  mergeFrom(other: SyncState): Touch[] {
    return this.applyAll(opsOfState(other));
  }

  clone(): SyncState {
    const copy = new SyncState(this.kind);
    for (const [k, e] of this.entities)
      copy.entities.set(k, { ...e, fields: new Map(e.fields) });
    for (const [k, r] of this.plain) copy.plain.set(k, r);
    copy.maxT = this.maxT;
    copy.sumA = this.sumA;
    copy.sumB = this.sumB;
    return copy;
  }

  /** Recomputes the hash from scratch (after registers were removed). */
  rehash(): void {
    this.sumA = 0;
    this.sumB = 0;
    for (const [k, r] of this.plain) this.add(`p/${k}`, r, r.v, 1);
    for (const [ek, e] of this.entities) {
      if (e.birth) this.add(`${ek}#birth`, e.birth, undefined, 1);
      if (e.death) this.add(`${ek}#death`, e.death, undefined, 1);
      for (const [k, r] of e.fields) this.add(`${ek}/${k}`, r, r.v, 1);
    }
  }

  /** The number of registers, for sizes and budgets. */
  get size(): number {
    let n = this.plain.size;
    for (const e of this.entities.values()) n += e.fields.size + 2;
    return n;
  }

  /**
   * Drops the registers of entities that were deleted long ago. Their birth and death stay, so
   * a late edit still cannot bring them back; an undo of the delete would have to rewrite every
   * field anyway.
   */
  compact(nowMs: number, retentionMs: number): number {
    let dropped = 0;
    for (const [ek, e] of this.entities) {
      if (!e.death || this.isAlive(ek)) continue;
      if (parseTimestamp(e.death.t).wallMs > nowMs - retentionMs) continue;
      dropped += e.fields.size;
      e.fields.clear();
    }
    if (dropped > 0) this.rehash();
    return dropped;
  }

  /** A text that is the same for equal states; for tests and comparisons. */
  canonical(): string {
    const lines: string[] = [];
    for (const [k, r] of this.plain)
      lines.push(`p/${k}|${r.t}|${r.by}|${valueText(r.v)}`);
    for (const [ek, e] of this.entities) {
      if (e.birth) lines.push(`${ek}#birth|${e.birth.t}|${e.birth.by}`);
      if (e.death) lines.push(`${ek}#death|${e.death.t}|${e.death.by}`);
      for (const [k, r] of e.fields)
        lines.push(`${ek}/${k}|${r.t}|${r.by}|${valueText(r.v)}`);
    }
    return lines.sort().join('\n');
  }
}

/** A state as ops, so that merging a snapshot is applying its ops. */
export function* opsOfState(state: SyncState): Generator<StampedOp> {
  for (const r of state.plain.values())
    yield r.v === undefined
      ? { t: r.t, by: r.by, p: r.p, u: 1 }
      : { t: r.t, by: r.by, p: r.p, v: r.v };
  for (const [, e] of state.entities) {
    const base = [e.collection, e.id];
    if (e.birth) yield { ...e.birth, p: base, b: 1 };
    if (e.death) yield { ...e.death, p: base, d: 1 };
    for (const r of e.fields.values()) {
      const p = [...base, ...r.p];
      yield r.v === undefined
        ? { t: r.t, by: r.by, p, u: 1 }
        : { t: r.t, by: r.by, p, v: r.v };
    }
  }
}

/** Puts a value at a path inside an object, making the objects on the way. */
function setPath(root: Record<string, Json>, path: readonly string[], v: Json) {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const next = node[key];
    if (
      next === undefined ||
      next === null ||
      typeof next !== 'object' ||
      Array.isArray(next)
    ) {
      const made: Record<string, Json> = {};
      node[key] = made;
      node = made;
    } else node = next as Record<string, Json>;
  }
  node[path[path.length - 1]!] = v;
}

function build(registers: Iterable<Register>): Record<string, Json> {
  const sorted = [...registers]
    .filter((r) => r.v !== undefined)
    .sort((a, b) => a.p.length - b.p.length);
  const root: Record<string, Json> = {};
  for (const r of sorted) {
    const v = r.v!;
    // A container register is an empty object; a deeper register may already have made it.
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length === 0 &&
      r.p.length > 0
    ) {
      let node: Json | undefined = root;
      for (const k of r.p) node = (node as Record<string, Json>)?.[k];
      if (node !== undefined) continue;
    }
    // A container is always a fresh object: the register's own value must not collect children.
    const isContainer =
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).length === 0;
    setPath(root, r.p, isContainer ? {} : v);
  }
  return root;
}

/** The record of one alive entity, or undefined if it is not alive. */
export function entityObject(state: SyncState, key: string): Json | undefined {
  const e = state.entities.get(key);
  if (!e || !state.isAlive(key)) return undefined;
  return build(e.fields.values());
}

/**
 * The document for a state: plain registers, then every alive entity. In a model, a connector
 * whose end is not alive is left out (it comes back if its end does).
 */
export function materialize(state: SyncState): Record<string, Json> {
  const doc = build(state.plain.values());
  for (const collection of collectionsOf(state.kind))
    if (doc[collection] === undefined) doc[collection] = {};
  for (const [key, e] of state.entities) {
    if (!state.isAlive(key)) continue;
    (doc[e.collection] as Record<string, Json>)[e.id] = build(
      e.fields.values(),
    );
  }
  if (state.kind === 'model') hideDanglingConnectors(doc);
  return doc;
}

function collectionsOf(kind: DocKind): string[] {
  return kind === 'model'
    ? ['elements', 'connectors']
    : ['classes', 'relations', 'modelTypes', 'shapes', 'panels'];
}

/** True when a connector record has both ends in `elements`. */
export function hasEnds(
  connector: Json,
  elements: Record<string, Json>,
): boolean {
  const c = connector as { from?: string; to?: string };
  return (
    typeof c.from === 'string' &&
    typeof c.to === 'string' &&
    c.from in elements &&
    c.to in elements
  );
}

function hideDanglingConnectors(doc: Record<string, Json>): void {
  const elements = doc['elements'] as Record<string, Json>;
  const connectors = doc['connectors'] as Record<string, Json>;
  for (const [id, c] of Object.entries(connectors))
    if (!hasEnds(c, elements)) delete connectors[id];
}

/**
 * A state for a document that exists as plain JSON (a new document, or one read from an old
 * snapshot): every register written at one stamp by one instance.
 */
export function stateFromDocument(
  kind: DocKind,
  doc: Record<string, Json>,
  stamp: Stamp,
): SyncState {
  const state = new SyncState(kind);
  const collections = collectionsOf(kind);
  for (const [key, value] of Object.entries(doc)) {
    if (
      collections.includes(key) &&
      value !== null &&
      typeof value === 'object'
    ) {
      for (const [id, record] of Object.entries(
        value as Record<string, Json>,
      )) {
        state.apply({ ...stamp, p: [key, id], b: 1 });
        for (const [p, v] of flatten([key, id], record).slice(1))
          state.apply({ ...stamp, p, v });
      }
    } else {
      for (const [p, v] of flatten([key], value))
        state.apply({ ...stamp, p, v });
    }
  }
  return state;
}

export { keyToPath };
