import {
  effectiveAttributes,
  effectiveRelationAttributes,
  inDrawingOrder,
  type AttributeDef,
  type Json,
  type Model,
  type Kit,
} from '@metakit-app/core';
import { zipFiles } from './zip';

export interface CsvOptions {
  /** Start each file with a UTF-8 byte order mark, which makes Excel read accents and umlauts correctly. */
  bom?: boolean;
}

const BOM = '﻿';
const EOL = '\r\n';

/** One cell as RFC 4180 has it: in quotes when it holds a comma, a quote or a line break. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

/**
 * The text of a stored value in a cell. Text as it is, numbers and booleans plainly, a multiple
 * choice joined with `;`, a table as JSON in one cell and a reference as the id of the element
 * it points at (several are joined with `;`).
 */
export function csvValue(def: AttributeDef, value: Json | undefined): string {
  if (value === undefined || value === null) return '';
  switch (def.type) {
    case 'multi-choice':
      return Array.isArray(value) ? value.map(String).join(';') : String(value);
    case 'table':
      return JSON.stringify(value);
    case 'reference':
      return Array.isArray(value)
        ? value
            .map((r) =>
              r !== null && typeof r === 'object' && 'element' in r
                ? String((r as { element: unknown }).element)
                : String(r),
            )
            .join(';')
        : String(value);
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

/** Formula results are worked out again from the other values, and a button holds no value, so neither is exported. */
function exported(defs: AttributeDef[]): AttributeDef[] {
  return defs.filter((d) => d.type !== 'formula' && d.type !== 'action');
}

/** Attribute columns, renamed when a key is the same as one of the fixed columns. */
function attributeColumns(
  defs: AttributeDef[],
  fixed: string[],
): { def: AttributeDef; header: string }[] {
  return exported(defs).map((def) => ({
    def,
    header: fixed.includes(def.key) ? `attribute_${def.key}` : def.key,
  }));
}

function table(
  headers: string[],
  rows: string[][],
  options: CsvOptions,
): string {
  return `${options.bom ? BOM : ''}${[headers, ...rows].map(csvRow).join(EOL)}${EOL}`;
}

/**
 * The model as CSV files for spreadsheets and reports, keyed by file name.
 *
 * - `<ClassKey>.csv` for every class that has objects in the model: id, x, y, w, h, parent_id,
 *   then the attributes of the class (including inherited ones) in the order they are defined.
 * - `<RelationKey>.csv` for every relation class that has connectors: id, from_id, to_id,
 *   then its attributes.
 *
 * Rows are in drawing order. Lines end with CRLF as RFC 4180 says.
 */
export function exportCsv(
  kit: Kit,
  model: Model,
  options: CsvOptions = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  const elements = inDrawingOrder(model.elements);
  const classIds = [...new Set(elements.map((e) => e.class))];
  const fixedElement = ['id', 'x', 'y', 'w', 'h', 'parent_id'];
  for (const classId of classIds) {
    const cls = kit.classes[classId];
    // An object of a class the Kit no longer has cannot be named, so it is left out.
    if (!cls) continue;
    const columns = attributeColumns(
      effectiveAttributes(kit, classId),
      fixedElement,
    );
    const rows = elements
      .filter((e) => e.class === classId)
      .map((e) => [
        e.id,
        String(e.x),
        String(e.y),
        String(e.w),
        String(e.h),
        e.parent ?? '',
        ...columns.map((c) => csvValue(c.def, e.attrs[c.def.id])),
      ]);
    out[`${cls.key}.csv`] = table(
      [...fixedElement, ...columns.map((c) => c.header)],
      rows,
      options,
    );
  }

  const connectors = inDrawingOrder(model.connectors);
  const fixedConnector = ['id', 'from_id', 'to_id'];
  for (const relationId of new Set(connectors.map((c) => c.relation))) {
    const rel = kit.relations[relationId];
    if (!rel) continue;
    const columns = attributeColumns(
      effectiveRelationAttributes(kit, relationId),
      fixedConnector,
    );
    const rows = connectors
      .filter((c) => c.relation === relationId)
      .map((c) => [
        c.id,
        c.from,
        c.to,
        ...columns.map((col) => csvValue(col.def, c.attrs[col.def.id])),
      ]);
    // A class and a relation class may share a key; the connectors file then says so.
    let name = `${rel.key}.csv`;
    if (name in out) name = `${rel.key}_connectors.csv`;
    out[name] = table(
      [...fixedConnector, ...columns.map((c) => c.header)],
      rows,
      options,
    );
  }
  return out;
}

/** The CSV files of a model in one zip. */
export function exportCsvZip(
  kit: Kit,
  model: Model,
  options: CsvOptions = {},
): Uint8Array {
  return zipFiles(exportCsv(kit, model, options));
}
