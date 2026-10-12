import { renameName } from '@metakit-app/formula';
import type {
  AttributeId,
  ClassId,
  ModelTypeId,
  RelationId,
  ShapeId,
} from '../ids';
import { deepEqual, type Json } from '../json';
import {
  effectiveAttributes,
  effectiveRelationAttributes,
  subclasses,
} from './inherit';
import { isFormula } from './shape-types';
import type { AttributeDef, Kit } from './types';

export type KeyOwner =
  | { kind: 'class'; id: ClassId }
  | { kind: 'relation'; id: RelationId }
  | { kind: 'modelType'; id: ModelTypeId };

/** What a key belongs to: a class, a relation class, a model type, or an attribute of one of them. */
export type KeyScope =
  KeyOwner | { kind: 'attribute'; owner: KeyOwner; id: AttributeId };

export interface KeyChange {
  /** Never contains array indexes: arrays are written as a whole. */
  path: string[];
  value: Json;
}

export interface RenamePlan {
  changes: KeyChange[];
  /** Where the old key is read, in plain English (shown before a rename or delete). */
  usages: string[];
}

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set(['true', 'false', 'null']);

/** Why a key cannot be used, or null when it can. */
export function keyProblem(key: string): string | null {
  if (!KEY.test(key))
    return 'A key starts with a letter or underscore and has only letters, digits and underscores.';
  if (RESERVED.has(key))
    return `"${key}" is a reserved word and cannot be a key.`;
  return null;
}

export function ownerDef(kit: Kit, owner: KeyOwner) {
  const table =
    owner.kind === 'class'
      ? kit.classes
      : owner.kind === 'relation'
        ? kit.relations
        : kit.modelTypes;
  return (table as Record<string, { key: string; attributes: AttributeDef[] }>)[
    owner.id
  ];
}

/** The owners that see this owner's attributes: itself and everything that extends it. */
export function scopeOwners(kit: Kit, owner: KeyOwner): KeyOwner[] {
  if (owner.kind === 'class')
    return [
      owner,
      ...subclasses(kit, owner.id).map((c) => ({
        kind: 'class' as const,
        id: c.id,
      })),
    ];
  if (owner.kind === 'relation') {
    const subs = Object.values(kit.relations)
      .filter(
        (r) => r.id !== owner.id && isRelationDescendant(kit, r.id, owner.id),
      )
      .map((r) => ({ kind: 'relation' as const, id: r.id }));
    return [owner, ...subs];
  }
  return [owner];
}

function isRelationDescendant(
  kit: Kit,
  id: RelationId,
  ancestor: RelationId,
): boolean {
  const seen = new Set<string>();
  let cur: RelationId | undefined = kit.relations[id]?.extends;
  while (cur && !seen.has(cur)) {
    if (cur === ancestor) return true;
    seen.add(cur);
    cur = kit.relations[cur]?.extends;
  }
  return false;
}

/** Keys that an attribute of this owner could clash with: everything it inherits or passes on. */
export function relatedKeys(
  kit: Kit,
  owner: KeyOwner,
  except: AttributeId,
): Map<string, string> {
  const keys = new Map<string, string>();
  const add = (attrs: AttributeDef[], by: string) => {
    for (const a of attrs)
      if (a.id !== except && !keys.has(a.key)) keys.set(a.key, by);
  };
  if (owner.kind === 'modelType') {
    add(
      kit.modelTypes[owner.id]?.attributes ?? [],
      `model type "${kit.modelTypes[owner.id]?.key}"`,
    );
    return keys;
  }
  const own = ownerDef(kit, owner);
  try {
    add(
      owner.kind === 'class'
        ? effectiveAttributes(kit, owner.id)
        : effectiveRelationAttributes(kit, owner.id),
      `"${own?.key}" or a parent`,
    );
  } catch {
    add(own?.attributes ?? [], `"${own?.key}"`);
  }
  for (const o of scopeOwners(kit, owner)) {
    const def = ownerDef(kit, o);
    if (def) add(def.attributes, `"${def.key}", which extends "${own?.key}"`);
  }
  return keys;
}

// Rewriting -----------------------------------------------------------------------------------

interface Walk {
  from: string;
  to: string;
  hits: number;
}

function rewriteFormulaText(text: string, w: Walk): string {
  // The leading `=` (and the space around it) is not part of the formula language.
  const m = /^(\s*=?\s*)([\s\S]*)$/.exec(text)!;
  const next = renameName(m[2]!, w.from, w.to);
  if (next !== m[2]) w.hits++;
  return m[1]! + next;
}

/**
 * A simple look names attributes by key: `by` (colour by data), `attribute` (text, badge, label)
 * and the `fields` list. Core cannot use the look compiler, so the same rename is written here;
 * the stored parts hold formulas, which the ordinary rewrite handles.
 */
function rewriteLookKeys(value: Json, w: Walk): Json {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = rewriteLookKeys(v, w);
      if (n !== v) changed = true;
      return n;
    });
    return changed ? out : value;
  }
  if (value !== null && typeof value === 'object') {
    let changed = false;
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      let n: Json;
      if ((k === 'by' || k === 'attribute') && v === w.from) {
        n = w.to;
        w.hits++;
      } else if (k === 'fields' && Array.isArray(v)) {
        n = v.map((f) => {
          if (f !== w.from) return f;
          w.hits++;
          return w.to;
        });
      } else if (k === 'values') n = v as Json;
      else n = rewriteLookKeys(v as Json, w);
      if (n !== v) changed = true;
      out[k] = n;
    }
    return changed ? out : value;
  }
  return value;
}

/** Copies a JSON value, rewriting every formula inside it; unchanged parts keep their identity. */
function rewriteJson(value: Json, key: string | null, w: Walk): Json {
  if (key === 'look') return rewriteLookKeys(value, w);
  if (typeof value === 'string') {
    // `over` (repeat) and `when` (variant) hold formula text with or without a leading `=`.
    if (
      key === 'over' ||
      key === 'when' ||
      key === 'formula' ||
      key === 'if' ||
      isFormula(value)
    )
      return rewriteFormulaText(value, w);
    return value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = rewriteJson(v, key, w);
      if (n !== v) changed = true;
      return n;
    });
    return changed ? out : value;
  }
  if (value !== null && typeof value === 'object') {
    let changed = false;
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      const n = rewriteJson(v as Json, k, w);
      if (n !== v) changed = true;
      out[k] = n;
    }
    return changed ? out : value;
  }
  return value;
}

/** Shapes that classes or relations in scope draw with, including the ones they embed with `use`. */
function shapesInScope(kit: Kit, start: (ShapeId | undefined)[]): Set<ShapeId> {
  const found = new Set<ShapeId>();
  const queue = start.filter((s): s is ShapeId => s !== undefined);
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (found.has(id)) continue;
    const shape = kit.shapes?.[id];
    if (!shape) continue;
    found.add(id);
    const visit = (
      parts: { type: string; shape?: ShapeId; parts?: unknown[] }[],
    ) => {
      for (const p of parts) {
        if (p.type === 'use' && p.shape) queue.push(p.shape);
        if (p.type === 'group') visit((p.parts ?? []) as never);
      }
    };
    if (shape.kind === 'node') {
      visit(shape.parts as never);
      for (const v of shape.variants ?? []) visit(v.parts as never);
    }
  }
  return found;
}

function attributesWithFormulas(
  attrs: AttributeDef[],
  w: Walk,
): AttributeDef[] {
  let changed = false;
  const out = attrs.map((a) => {
    let next: AttributeDef = a;
    if (a.type === 'formula') {
      const text = rewriteFormulaText(a.formula, w);
      if (text !== a.formula) next = { ...a, formula: text };
    }
    if (a.defaultFormula !== undefined) {
      const text = rewriteFormulaText(a.defaultFormula, w);
      if (text !== a.defaultFormula) next = { ...next, defaultFormula: text };
    }
    if (next !== a) changed = true;
    return next;
  });
  return changed ? out : attrs;
}

/**
 * Plans the rename of a key: the new key itself and every formula, shape property and panel
 * condition that reads the old one. Returns an error text instead when the rename is not allowed.
 * The plan is a list of writes, so that running it is one command and one undo step.
 */
export function planKeyRename(
  kit: Kit,
  scope: KeyScope,
  newKey: string,
): RenamePlan | { error: string } {
  const problem = keyProblem(newKey);
  if (problem) return { error: problem };
  const plan: RenamePlan = { changes: [], usages: [] };

  if (scope.kind !== 'attribute') {
    const table =
      scope.kind === 'class'
        ? kit.classes
        : scope.kind === 'relation'
          ? kit.relations
          : kit.modelTypes;
    const def = (table as Record<string, { key: string }>)[scope.id];
    if (!def)
      return {
        error: `There is no such ${scope.kind === 'modelType' ? 'model type' : scope.kind === 'relation' ? 'relation class' : 'class'}.`,
      };
    if (def.key === newKey) return plan;
    const clash = Object.values(
      table as Record<string, { id: string; key: string }>,
    ).find((o) => o.id !== scope.id && o.key === newKey);
    if (clash)
      return {
        error: `The key "${newKey}" is already used by another ${scope.kind === 'modelType' ? 'model type' : scope.kind === 'relation' ? 'relation class' : 'class'}.`,
      };
    const tableName =
      scope.kind === 'class'
        ? 'classes'
        : scope.kind === 'relation'
          ? 'relations'
          : 'modelTypes';
    plan.changes.push({ path: [tableName, scope.id, 'key'], value: newKey });
    return plan;
  }

  const owner = ownerDef(kit, scope.owner);
  const attr = owner?.attributes.find((a) => a.id === scope.id);
  if (!owner || !attr) return { error: 'That attribute does not exist.' };
  if (attr.key === newKey) return plan;
  const clash = relatedKeys(kit, scope.owner, attr.id).get(newKey);
  if (clash)
    return {
      error: `The key "${newKey}" is already used by an attribute of ${clash}.`,
    };

  const w: Walk = { from: attr.key, to: newKey, hits: 0 };
  const tableOf = (o: KeyOwner) =>
    o.kind === 'class'
      ? 'classes'
      : o.kind === 'relation'
        ? 'relations'
        : 'modelTypes';
  const owners = scopeOwners(kit, scope.owner);

  // Attribute lists: the renamed attribute, and formula attributes that read it.
  for (const o of owners) {
    const def = ownerDef(kit, o)!;
    const probe: Walk = { ...w, hits: 0 };
    let attrs = attributesWithFormulas(def.attributes, probe);
    if (probe.hits > 0) plan.usages.push(`a formula attribute of "${def.key}"`);
    if (o.kind === scope.owner.kind && o.id === scope.owner.id)
      attrs = attrs.map((a) =>
        a.id === attr.id ? ({ ...a, key: newKey } as AttributeDef) : a,
      );
    if (attrs !== def.attributes)
      plan.changes.push({
        path: [tableOf(o), o.id, 'attributes'],
        value: attrs as unknown as Json,
      });
  }

  // Constraints of the owners, and rules about their classes.
  for (const o of owners) {
    const def = ownerDef(kit, o)!;
    const constraints = (def as { constraints?: unknown }).constraints;
    if (!constraints) continue;
    const probe: Walk = { ...w, hits: 0 };
    const next = rewriteJson(constraints as Json, null, probe);
    if (probe.hits > 0) {
      plan.changes.push({
        path: [tableOf(o), o.id, 'constraints'],
        value: next,
      });
      plan.usages.push(`a constraint of "${def.key}"`);
    }
  }
  const classOwners = new Set(
    owners.filter((o) => o.kind === 'class').map((o) => o.id as string),
  );
  for (const rule of Object.values(kit.rules ?? {})) {
    if (!rule.when.class || !classOwners.has(rule.when.class)) continue;
    const probe: Walk = { ...w, hits: 0 };
    let next = rewriteJson(
      rule as unknown as Json,
      null,
      probe,
    ) as unknown as Record<string, Json>;
    const renamed = renameRuleKeys(next as unknown as Json, attr.key, newKey);
    if (probe.hits === 0 && !renamed.changed) continue;
    next = renamed.value as unknown as Record<string, Json>;
    for (const [k, v] of Object.entries(next))
      if (!deepEqual(v, (rule as unknown as Record<string, Json>)[k] as Json))
        plan.changes.push({ path: ['rules', rule.id, k], value: v });
    plan.usages.push(`the rule "${rule.label}"`);
  }

  // Shapes and panel layouts that the owners use.
  const starts: (ShapeId | undefined)[] = [];
  for (const o of owners) {
    if (o.kind === 'class') starts.push(kit.classes[o.id]?.shape);
    else if (o.kind === 'relation') starts.push(kit.relations[o.id]?.shape);
    else starts.push(kit.modelTypes[o.id]?.background);
  }
  for (const id of shapesInScope(kit, starts)) {
    const shape = kit.shapes[id]!;
    const probe: Walk = { ...w, hits: 0 };
    const rewritten = rewriteJson(
      shape as unknown as Json,
      null,
      probe,
    ) as unknown as Record<string, Json>;
    if (probe.hits === 0) continue;
    for (const [k, v] of Object.entries(rewritten))
      if (!deepEqual(v, (shape as unknown as Record<string, Json>)[k] as Json))
        plan.changes.push({ path: ['shapes', id, k], value: v });
    plan.usages.push(`the shape "${shape.name ?? id}"`);
  }
  for (const o of owners) {
    const layout = o.kind === 'modelType' ? undefined : kit.panels?.[o.id];
    if (!layout) continue;
    const probe: Walk = { ...w, hits: 0 };
    const tabs = rewriteJson(layout.tabs as unknown as Json, null, probe);
    // Items name attributes by key; those are renamed too, but they are not formulas.
    const renamed = renameItemKeys(tabs, attr.key, newKey);
    if (renamed.changed || probe.hits > 0) {
      plan.changes.push({
        path: ['panels', o.id, 'tabs'],
        value: renamed.value,
      });
      plan.usages.push(`the panel layout of "${ownerDef(kit, o)?.key}"`);
    }
  }
  return plan;
}

function renameItemKeys(
  value: Json,
  from: string,
  to: string,
): { value: Json; changed: boolean } {
  let changed = false;
  const walk = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') {
      const out: Record<string, Json> = {};
      for (const [k, x] of Object.entries(v)) {
        if (k === 'attribute' && x === from) {
          out[k] = to;
          changed = true;
        } else out[k] = walk(x as Json);
      }
      return out;
    }
    return v;
  };
  const out = walk(value);
  return { value: changed ? out : value, changed };
}

/** Where a key is read, for showing before it is renamed or its attribute is deleted. */
export function findKeyUsages(kit: Kit, scope: KeyScope): string[] {
  if (scope.kind !== 'attribute') return [];
  const owner = ownerDef(kit, scope.owner);
  const attr = owner?.attributes.find((a) => a.id === scope.id);
  if (!attr) return [];
  // A name that cannot clash gives the full list of places that read the old one.
  const plan = planKeyRename(kit, scope, `${attr.key}__probe`);
  return 'error' in plan ? [] : [...new Set(plan.usages)];
}

/** Rules name attributes by key outside formulas too: the trigger and the actions that set one. */
function renameRuleKeys(
  value: Json,
  from: string,
  to: string,
): { value: Json; changed: boolean } {
  let changed = false;
  const walk = (v: Json, key: string | null): Json => {
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v !== null && typeof v === 'object') {
      const out: Record<string, Json> = {};
      for (const [k, x] of Object.entries(v)) {
        if (k === 'attribute' && x === from) {
          out[k] = to;
          changed = true;
        } else if (
          k === 'attributes' &&
          x !== null &&
          typeof x === 'object' &&
          !Array.isArray(x)
        ) {
          // createObject: attribute values by key.
          const inner: Record<string, Json> = {};
          for (const [ik, iv] of Object.entries(x)) {
            if (ik === from) changed = true;
            inner[ik === from ? to : ik] = iv as Json;
          }
          out[k] = inner;
        } else out[k] = walk(x as Json, k);
      }
      return out;
    }
    return v;
  };
  const out = walk(value, null);
  return { value: changed ? out : value, changed };
}
