import {
  describeFormulaProblem,
  evaluate,
  parseCached,
  type EvalResult,
  type Scope,
  type Value,
} from '@metakit-app/formula';
import type { ClassId, ConnectorId, ElementId, RelationId } from '../ids';
import type { Json } from '../json';
import {
  effectiveAttributes,
  effectiveRelationAttributes,
  findClassByKey,
  findRelationByKey,
  isA,
} from '../meta/inherit';
import { formulaSource } from '../meta/shape-types';
import type { AttributeDef, TableAttribute, ToolLibrary } from '../meta/types';
import type { Model } from '../model/types';
import type { Patch } from '../store/tx';

type Reads = Set<string>;

interface Entry {
  value: Value;
  error?: string;
  reads: Reads;
}

/** Everything a calculated value can be told apart by: element ids and attribute keys. */
const sep = '\u0000';
const cacheKey = (id: string, key: string) => `${id}${sep}${key}`;

export interface CalculatorStore {
  subscribe(
    listener: (event: { state: Model; patches: readonly Patch[] }) => void,
  ): () => void;
}

/**
 * Computes formula attributes and one-off formulas over a model, and keeps each calculated value
 * until something it read changes. Nothing is stored in the model: every instance computes the same
 * values from the same data (ADR 0005).
 *
 * What a value read is recorded as tokens: `a:<id>:<key>` an attribute, `x:<id>` that the object
 * exists, `c:<class>` the objects of a class, `r:<relation>:<id>` the connectors of a relation at
 * an object, `pa:<id>` the parent of an object, `ch:<id>` the children of an object.
 */
export class ModelCalculator {
  private readonly cache = new Map<string, Entry>();
  private readonly readers = new Map<string, Set<string>>();
  /** Cache keys by object, so that deleting an object drops its values without a scan. */
  private readonly byObject = new Map<string, Set<string>>();
  private readonly defsCache = new Map<string, Map<string, AttributeDef>>();
  private readonly listeners = new Set<(ids: ReadonlySet<string>) => void>();
  private stack: string[] = [];
  private cyclic = new Set<string>();
  /** Counts evaluations of formula attributes, so tests and the benchmark can see what was redone. */
  evaluations = 0;

  constructor(
    private tool: ToolLibrary,
    private readonly getModel: () => Model,
  ) {}

  /** Follows a store: every change of the model drops the values it touched. */
  attach(store: CalculatorStore): () => void {
    return store.subscribe((event) => this.update(event.patches));
  }

  onChange(listener: (ids: ReadonlySet<string>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Takes a changed tool library (hot reload): everything is calculated again. */
  setTool(tool: ToolLibrary): void {
    this.tool = tool;
    this.defsCache.clear();
    this.cache.clear();
    this.readers.clear();
    this.byObject.clear();
    const ids = new Set<string>([
      ...Object.keys(this.getModel().elements),
      ...Object.keys(this.getModel().connectors),
    ]);
    this.emit(ids);
  }

  private emit(ids: ReadonlySet<string>): void {
    if (ids.size === 0) return;
    for (const l of this.listeners) l(ids);
  }

  // Definitions -------------------------------------------------------------------------------

  private defs(owner: string): Map<string, AttributeDef> {
    let found = this.defsCache.get(owner);
    if (!found) {
      found = new Map();
      let list: AttributeDef[] = [];
      try {
        if (owner === 'model') {
          const m = this.getModel().manifest.modelType;
          list = this.tool.modelTypes[m]?.attributes ?? [];
        } else if (owner.startsWith('rel_'))
          list = effectiveRelationAttributes(this.tool, owner as RelationId);
        else list = effectiveAttributes(this.tool, owner as ClassId);
      } catch {
        // A broken class chain has no attributes to calculate.
      }
      for (const a of list) found.set(a.key, a);
      this.defsCache.set(owner, found);
    }
    return found;
  }

  private ownerOf(id: string): string | undefined {
    const m = this.getModel();
    return (
      m.elements[id as ElementId]?.class ??
      m.connectors[id as ConnectorId]?.relation
    );
  }

  private dataOf(id: string): { attrs: Record<string, Json> } | undefined {
    const m = this.getModel();
    return id === 'model'
      ? { attrs: m.attrs }
      : (m.elements[id as ElementId] ?? m.connectors[id as ConnectorId]);
  }

  // Reading -----------------------------------------------------------------------------------

  private note(token: string): void {
    const top = this.stack.at(-1);
    if (top === undefined) return;
    this.cache.get(top)?.reads.add(token);
  }

  /** The stored value of an attribute as a formula sees it: defaults filled in, tables as rows. */
  private stored(id: string, def: AttributeDef): Value {
    const data = this.dataOf(id);
    const raw = data?.attrs[def.id];
    if (def.type === 'table') return rows(def, raw ?? def.default);
    if (raw !== undefined) return raw as Value;
    return 'default' in def && def.default !== undefined
      ? (def.default as Value)
      : null;
  }

  /** The value of an attribute by key: stored, or calculated for a formula attribute. */
  get(id: string, key: string): Value {
    const owner = id === 'model' ? 'model' : this.ownerOf(id);
    if (owner === undefined) return null;
    const def = this.defs(owner).get(key);
    if (!def) return null;
    this.note(`a:${id}:${key}`);
    if (def.type !== 'formula') return this.stored(id, def);
    return this.compute(id, def.key, def.formula).value;
  }

  /** The problem with a formula attribute's value, in plain English, if there is one. */
  errorOf(id: string, key: string): string | undefined {
    const def = this.defs(
      id === 'model' ? 'model' : (this.ownerOf(id) ?? ''),
    ).get(key);
    if (!def || def.type !== 'formula') return undefined;
    return this.compute(id, key, def.formula).error;
  }

  private compute(id: string, key: string, formula: string): Entry {
    const k = cacheKey(id, key);
    const at = this.stack.indexOf(k);
    const hit = at < 0 ? this.cache.get(k) : undefined;
    if (hit) return hit;
    if (at >= 0) {
      // Reading a value that is being calculated: all formulas in the loop get an error.
      for (const member of this.stack.slice(at)) this.cyclic.add(member);
      return {
        value: null,
        error: 'This formula reads itself.',
        reads: new Set(),
      };
    }
    const entry: Entry = { value: null, reads: new Set() };
    this.cache.set(k, entry);
    let mine = this.byObject.get(id);
    if (!mine) this.byObject.set(id, (mine = new Set()));
    mine.add(k);
    this.stack.push(k);
    this.evaluations++;
    try {
      const result = this.run(
        id,
        formulaSource(formula.startsWith('=') ? formula : `=${formula}`),
      );
      entry.value = result.value;
      if (result.error) entry.error = result.error;
    } finally {
      this.stack.pop();
    }
    if (this.cyclic.delete(k)) {
      entry.value = null;
      entry.error = 'These formulas read each other in a loop.';
    }
    for (const t of entry.reads) {
      let set = this.readers.get(t);
      if (!set) this.readers.set(t, (set = new Set()));
      set.add(k);
    }
    return entry;
  }

  private run(
    id: string,
    source: string,
    extras?: Record<string, Value>,
  ): EvalResult {
    const parsed = parseCached(source);
    const result: EvalResult =
      'error' in parsed
        ? {
            value: null,
            reads: [],
            error: `${parsed.error} (at ${parsed.at})`,
            code: parsed.code as EvalResult['code'] & string,
          }
        : evaluate(parsed.expr, this.scope(id, extras));
    // One place words every problem the same way for panels, shapes, validation and rules.
    return result.error
      ? { ...result, error: describeFormulaProblem(result) }
      : result;
  }

  /**
   * Evaluates a formula for an object (or for the model, with `id` null) without keeping the
   * result; for rules, constraints and panel conditions. `extras` adds names such as `$old`.
   */
  evaluate(
    id: string | null,
    source: string,
    extras?: Record<string, Value>,
  ): EvalResult {
    return this.run(
      id ?? 'model',
      formulaSource(source.startsWith('=') ? source : `=${source}`),
      extras,
    );
  }

  /** The scope formulas run in for an object: its attributes, `self`, `parent`, and the helpers. */
  scope(id: string, extras?: Record<string, Value>): Scope {
    const owner = id === 'model' ? 'model' : (this.ownerOf(id) ?? '');
    const defs = this.defs(owner);
    return {
      get: (name) => {
        if (extras && Object.hasOwn(extras, name)) return extras[name]!;
        if (defs.has(name)) return this.get(id, name);
        if (name === 'self') return id === 'model' ? null : id;
        if (name === 'parent') {
          this.note(`pa:${id}`);
          return this.getModel().elements[id as ElementId]?.parent ?? null;
        }
        // The ends of a connector, for constraints of relation classes.
        if (name === 'from' || name === 'to') {
          const cn = this.getModel().connectors[id as ConnectorId];
          if (cn) {
            this.note(`x:${id}`);
            return cn[name];
          }
        }
        return undefined;
      },
      member: (v, key) => this.member(v, key),
      call: (name, args) => this.call(id, name, args),
    };
  }

  private member(v: Value, key: string): Value | undefined {
    if (typeof v !== 'string' || !(v.startsWith('el_') || v.startsWith('cn_')))
      return undefined;
    const m = this.getModel();
    this.note(`x:${v}`);
    const el = m.elements[v as ElementId];
    const cn = m.connectors[v as ConnectorId];
    if (!el && !cn) return null;
    const owner = el?.class ?? cn!.relation;
    if (this.defs(owner).has(key)) return this.get(v, key);
    switch (key) {
      case 'id':
        return v;
      case 'class':
        return owner;
      case 'parent':
        this.note(`pa:${v}`);
        return el?.parent ?? null;
      case 'from':
      case 'to':
        return cn ? cn[key] : null;
      case 'x':
      case 'y':
      case 'w':
      case 'h':
        return el ? el[key] : null;
      default:
        return null;
    }
  }

  private classOf(name: Value | undefined): ClassId | null {
    if (typeof name !== 'string') return null;
    return (
      (this.tool.classes[name as ClassId] ?? findClassByKey(this.tool, name))
        ?.id ?? null
    );
  }

  private call(self: string, name: string, args: Value[]): Value | undefined {
    const m = this.getModel();
    switch (name) {
      case 'objects': {
        const cls = this.classOf(args[0]);
        if (!cls) return [];
        this.note(`c:${cls}`);
        const out: string[] = [];
        for (const e of Object.values(m.elements))
          if (isA(this.tool, e.class, cls)) out.push(e.id);
        return out;
      }
      case 'children': {
        const of = typeof args[0] === 'string' ? args[0] : self;
        this.note(`ch:${of}`);
        const out: string[] = [];
        for (const e of Object.values(m.elements))
          if (e.parent === of) out.push(e.id);
        return out;
      }
      case 'incoming':
      case 'outgoing': {
        const rel =
          typeof args[0] === 'string'
            ? (findRelationByKey(this.tool, args[0])?.id ??
              this.tool.relations[args[0] as RelationId]?.id)
            : undefined;
        if (!rel) return [];
        const of = typeof args[1] === 'string' ? args[1] : self;
        this.note(`r:${rel}:${of}`);
        const out: string[] = [];
        for (const c of Object.values(m.connectors)) {
          if (c.relation !== rel) continue;
          if (name === 'incoming' && c.to === of) out.push(c.from);
          if (name === 'outgoing' && c.from === of) out.push(c.to);
        }
        return out;
      }
      default:
        return undefined;
    }
  }

  // Changes -----------------------------------------------------------------------------------

  /** Drops what the patches touched, and everything that read it; tells listeners which objects. */
  update(patches: readonly Patch[]): ReadonlySet<string> {
    const tokens = new Set<string>();
    const touched = new Set<string>();
    const keyOf = (
      owner: string | undefined,
      attrId: string,
    ): string | undefined => {
      if (!owner) return undefined;
      for (const [key, def] of this.defs(owner))
        if (def.id === attrId) return key;
      return undefined;
    };
    for (const p of patches) {
      const [root, id, field, attr] = p.path as string[];
      if (root === 'elements' && id) {
        touched.add(id);
        if (field === undefined) {
          // Created or deleted.
          tokens.add(`x:${id}`);
          tokens.add(`pa:${id}`);
          const data = (p.after ?? p.before) as
            { class?: ClassId; parent?: string } | undefined;
          if (data?.class) {
            let c: ClassId | undefined = data.class;
            const guard = new Set<string>();
            while (c && !guard.has(c)) {
              guard.add(c);
              tokens.add(`c:${c}`);
              c = this.tool.classes[c]?.extends;
            }
          }
          const was = (p.before as { parent?: string } | undefined)?.parent;
          const now = (p.after as { parent?: string } | undefined)?.parent;
          if (was) tokens.add(`ch:${was}`);
          if (now) tokens.add(`ch:${now}`);
          this.dropObject(id);
        } else if (field === 'attrs' && attr) {
          const key = keyOf(
            this.getModel().elements[id as ElementId]?.class ??
              this.classFromPatches(patches, id),
            attr,
          );
          if (key) tokens.add(`a:${id}:${key}`);
          else tokens.add(`a:${id}:${attr}`);
        } else if (field === 'attrs') {
          // The whole attribute record was replaced.
          for (const k of this.defs(this.ownerOf(id) ?? '').keys())
            tokens.add(`a:${id}:${k}`);
        } else if (field === 'parent') {
          tokens.add(`pa:${id}`);
          if (typeof p.before === 'string') tokens.add(`ch:${p.before}`);
          if (typeof p.after === 'string') tokens.add(`ch:${p.after}`);
        } else if (
          field === 'x' ||
          field === 'y' ||
          field === 'w' ||
          field === 'h'
        ) {
          tokens.add(`a:${id}:${field}`);
        }
      } else if (root === 'connectors' && id) {
        touched.add(id);
        const before = (field === undefined ? p.before : undefined) as
          { relation?: RelationId; from?: string; to?: string } | undefined;
        const after = (
          field === undefined ? p.after : undefined
        ) as typeof before;
        const now = this.getModel().connectors[id as ConnectorId];
        for (const c of [
          before,
          after,
          now
            ? { relation: now.relation, from: now.from, to: now.to }
            : undefined,
        ]) {
          if (!c?.relation) continue;
          tokens.add(`r:${c.relation}:${c.from}`);
          tokens.add(`r:${c.relation}:${c.to}`);
        }
        if (field === 'from' || field === 'to') {
          if (typeof p.before === 'string' && now)
            tokens.add(`r:${now.relation}:${p.before}`);
          if (typeof p.after === 'string' && now)
            tokens.add(`r:${now.relation}:${p.after}`);
        }
        tokens.add(`x:${id}`);
        if (field === 'attrs' && attr) {
          const key = keyOf(this.ownerOf(id), attr);
          if (key) tokens.add(`a:${id}:${key}`);
        }
        if (field === undefined) this.dropObject(id);
      } else if (root === 'attrs') {
        const key = keyOf('model', id ?? '');
        if (key) tokens.add(`a:model:${key}`);
      }
    }
    const changed = this.invalidate(tokens);
    for (const t of touched) changed.add(t);
    this.emit(changed);
    return changed;
  }

  private classFromPatches(
    patches: readonly Patch[],
    id: string,
  ): string | undefined {
    for (const p of patches)
      if (p.path[0] === 'elements' && p.path[1] === id && p.path.length === 2)
        return ((p.after ?? p.before) as { class?: string } | undefined)?.class;
    return undefined;
  }

  private dropObject(id: string): void {
    for (const k of [...this.cache.keys()])
      if (k.startsWith(`${id}${sep}`)) this.remove(k);
  }

  private remove(k: string): void {
    const entry = this.cache.get(k);
    if (!entry) return;
    this.cache.delete(k);
    this.byObject.get(k.split(sep)[0]!)?.delete(k);
    for (const t of entry.reads) this.readers.get(t)?.delete(k);
  }

  /** Drops every value that read one of the tokens, and those that read those, and so on. */
  private invalidate(tokens: Set<string>): Set<string> {
    const changed = new Set<string>();
    const queue = [...tokens];
    const seen = new Set(tokens);
    while (queue.length > 0) {
      const token = queue.pop()!;
      const readers = this.readers.get(token);
      if (!readers) continue;
      for (const k of [...readers]) {
        const [id, key] = k.split(sep) as [string, string];
        changed.add(id);
        this.remove(k);
        const next = `a:${id}:${key}`;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
      this.readers.delete(token);
    }
    return changed;
  }

  /** Values kept right now; tests use it to see that a change dropped little. */
  get size(): number {
    return this.cache.size;
  }
}

function rows(def: TableAttribute, value: Json | undefined): Value {
  if (!Array.isArray(value)) return [];
  const keyOf = new Map(def.columns.map((c) => [c.id, c.key]));
  return value.map((row) => {
    const out: Record<string, Value> = {};
    if (row !== null && typeof row === 'object' && !Array.isArray(row))
      for (const [col, v] of Object.entries(row))
        out[keyOf.get(col) ?? col] = v as Value;
    return out;
  });
}
