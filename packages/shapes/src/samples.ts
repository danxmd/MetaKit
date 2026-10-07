import {
  optionValue,
  type AttributeDef,
  type Json,
  type TableColumn,
} from '@metakit-app/core';

function columnSample(col: TableColumn, row: number): Json {
  switch (col.type) {
    case 'integer':
    case 'number':
      return row + 3;
    case 'boolean':
      return row === 0;
    case 'date':
      return '2026-01-15';
    case 'choice': {
      const o = col.options?.[row % Math.max(1, col.options.length)];
      return o === undefined ? null : optionValue(o);
    }
    case 'text':
      return `${col.key} ${row + 1}`;
  }
}

function sampleFor(def: AttributeDef): Json {
  switch (def.type) {
    case 'choice': {
      const first = def.options[0];
      return first === undefined ? null : optionValue(first);
    }
    case 'multi-choice': {
      const first = def.options[0];
      return first === undefined ? [] : [optionValue(first)];
    }
    case 'integer':
    case 'number':
      return 3;
    case 'text':
      return def.key;
    case 'boolean':
      return true;
    case 'date':
      return '2026-01-15';
    case 'date-time':
      return '2026-01-15T09:30:00Z';
    case 'duration':
      return 'PT90M';
    case 'link':
      return 'https://example.com';
    case 'table':
      return [0, 1].map((row) =>
        Object.fromEntries(
          def.columns.map((c) => [c.id, columnSample(c, row)]),
        ),
      );
    case 'reference':
    case 'formula':
    case 'action':
      return null;
  }
}

/**
 * Starting values for the preview strip, by attribute id (the form `makeScope` reads), so a shape
 * can be judged before any element exists. The user can change each one.
 */
export function sampleValuesFor(
  defs: readonly AttributeDef[],
): Record<string, Json> {
  return Object.fromEntries(defs.map((d) => [d.id, sampleFor(d)]));
}
