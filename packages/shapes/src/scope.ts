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
  return {
    get: (name) =>
      name.startsWith('$')
        ? dollar(name)
        : Object.hasOwn(values, name)
          ? values[name]
          : undefined,
    member: (v, key) => {
      if (typeof v === 'string' && extras.resolve) {
        const target = extras.resolve(v);
        if (target) return Object.hasOwn(target, key) ? target[key] : null;
      }
      return undefined;
    },
  };
}
