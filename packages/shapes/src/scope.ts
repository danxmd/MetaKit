import {
  optionValue,
  type AttributeDef,
  type Json,
  type TableAttribute,
} from '@metakit-app/core';
import type { Scope, Value } from '@metakit-app/formula';

/** Names that shapes can use besides attribute keys. */
export interface ScopeExtras {
  /** The text shown in the element: its first filled-in text attribute, else the class name. */
  label: string;
  className: string;
  w: number;
  h: number;
  /** A stable pastel fill for the class, so classes can be told apart without any shape setup. */
  fill: string;
  /** Follows a reference value (an element id) to that element's attribute values by key. */
  resolve?: (id: string) => Record<string, Value> | undefined;
  language?: string;
  /** The calculated value of a formula attribute by key; undefined when there is none. */
  computed?: (key: string) => Value | undefined;
  /**
   * The model-aware part of a formula scope (a `ModelCalculator` scope): `call` gives
   * `objects()`, `children()`, `incoming()` and `outgoing()`, `member` follows references with
   * computed values, and `special` gives names such as `self`, `parent`, `from` and `to`.
   */
  host?: Pick<Scope, 'call' | 'member'> & {
    special?: (name: string) => Value | undefined;
  };
}

const READ_SEP = '\u0000';

/**
 * Reads that are not plain names are recorded under a made-up name so that the compile cache
 * can ask the scope again and compare: `call` for a helper result, `member` for a value reached
 * through a reference. Names of attributes never contain a NUL, so the two cannot be confused.
 */
export function callReadName(fn: string, args: Value[]): string {
  return `call${READ_SEP}${fn}${READ_SEP}${JSON.stringify(args)}`;
}

export function memberReadName(value: Value, key: string): string {
  return `member${READ_SEP}${key}${READ_SEP}${JSON.stringify(value)}`;
}

/** The current value of a recorded read, whether a plain name, a helper call or a member access. */
export function probeRead(scope: Scope, name: string): Value | undefined {
  if (!name.includes(READ_SEP)) return scope.get(name);
  const [kind, head, rest] = name.split(READ_SEP) as [string, string, string];
  const json = JSON.parse(rest) as Value;
  if (kind === 'call') return scope.call?.(head, json as Value[]);
  return scope.member?.(json, head);
}

function tableRows(def: TableAttribute, value: Json | undefined): Value {
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

function isEmpty(v: Value | undefined): boolean {
  return (
    v === undefined ||
    v === null ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  );
}

/** Attribute values by key, with defaults for values that were never set. */
export function valuesByKey(
  defs: readonly AttributeDef[],
  attrs: Record<string, Json>,
): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const def of defs) {
    const stored = attrs[def.id];
    if (def.type === 'table') {
      out[def.key] = tableRows(def, stored ?? def.default);
      continue;
    }
    const fallback =
      'default' in def ? (def.default as Value | undefined) : undefined;
    const v = (stored === undefined ? fallback : stored) as Value | undefined;
    out[def.key] = v === undefined ? null : v;
  }
  return out;
}

function fieldLines(
  defs: readonly AttributeDef[],
  values: Record<string, Value>,
  skip: string | undefined,
  language: string,
): string[] {
  const lines: string[] = [];
  for (const def of defs) {
    if (def.key === skip || def.type === 'action' || def.type === 'table')
      continue;
    const v = values[def.key];
    if (isEmpty(v)) continue;
    const label = def.labels?.[language] ?? def.key;
    let text: string;
    if (def.type === 'choice' && typeof v === 'string') {
      const o = def.options.find((x) => optionValue(x) === v);
      text = o && typeof o !== 'string' ? (o.labels?.[language] ?? v) : v;
    } else text = Array.isArray(v) ? v.join(', ') : String(v);
    lines.push(`${label}: ${text}`);
  }
  return lines;
}

/**
 * The scope a shape formula runs in: attribute keys, then `$label`, `$class`, `$width`, `$height`,
 * `$fill` and `$fields` (one "Label: value" line per filled-in attribute besides the label).
 */
export function makeScope(
  defs: readonly AttributeDef[],
  attrs: Record<string, Json>,
  extras: ScopeExtras,
  labelKey?: string,
): Scope {
  const values = valuesByKey(defs, attrs);
  let fields: Value | undefined;
  const dollar = (name: string): Value | undefined => {
    switch (name) {
      case '$label':
        return extras.label;
      case '$class':
        return extras.className;
      case '$width':
        return extras.w;
      case '$height':
        return extras.h;
      case '$fill':
        return extras.fill;
      case '$fields':
        return (fields ??= fieldLines(
          defs,
          values,
          labelKey,
          extras.language ?? 'en',
        ));
      default:
        return undefined;
    }
  };
  const computed = extras.computed;
  const formulaKeys = computed
    ? new Set(defs.filter((d) => d.type === 'formula').map((d) => d.key))
    : undefined;
  const host = extras.host;
  const scope: Scope = {
    get: (name) => {
      if (name.startsWith('$')) return dollar(name);
      if (Object.hasOwn(values, name)) {
        if (formulaKeys?.has(name)) return computed!(name) ?? null;
        return values[name];
      }
      return host?.special?.(name);
    },
    member: (v, key) => {
      const hosted = host?.member?.(v, key);
      if (hosted !== undefined) return hosted;
      if (typeof v === 'string' && extras.resolve) {
        const target = extras.resolve(v);
        if (target) return Object.hasOwn(target, key) ? target[key] : null;
      }
      return undefined;
    },
  };
  if (host?.call) scope.call = (name, args) => host.call!(name, args);
  return scope;
}
