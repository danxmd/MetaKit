import {
  isIsoDate,
  optionValue,
  type ChoiceOption,
  type Json,
  type TableAttribute,
  type TableColumn,
} from '@metakit-app/core';
import { parseNumberText, toIsoDate } from './input';

export interface PasteResult {
  rows: Record<string, Json>[];
  problems: string[];
}

/**
 * Splits spreadsheet text into rows and cells. Cells that spreadsheets wrap in double quotes
 * (because they contain tabs or line breaks) are unwrapped; one trailing empty line is ignored.
 */
function splitCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (ch === '\t') {
      row.push(cell);
      cell = '';
      atCellStart = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      atCellStart = true;
    } else {
      cell += ch;
      atCellStart = false;
    }
  }
  // The last line has no line break after it. A completely empty one is a trailing newline.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const TRUE = new Set(['true', 'yes', '1']);
const FALSE = new Set(['false', 'no', '0']);

function matchOption(
  options: readonly ChoiceOption[],
  text: string,
): string | null {
  const wanted = text.toLowerCase();
  for (const option of options) {
    const names =
      typeof option === 'string'
        ? [option]
        : [option.value, ...Object.values(option.labels ?? {})];
    if (names.some((n) => n.toLowerCase() === wanted))
      return optionValue(option);
  }
  return null;
}

/** Converts one cell; returns the value, or a message when the text does not fit the column. */
function convertCell(
  column: TableColumn,
  raw: string,
): { value: Json } | { message: string } {
  const text = raw.trim();
  const bad = (what: string) => ({ message: `"${text}" is not ${what}.` });
  switch (column.type) {
    case 'text':
      return { value: raw };
    case 'integer':
    case 'number': {
      const n = parseNumberText(text);
      if (n === null) return bad('a number');
      if (column.type === 'integer' && !Number.isInteger(n))
        return bad('a whole number');
      return { value: n };
    }
    case 'boolean': {
      const t = text.toLowerCase();
      if (TRUE.has(t)) return { value: true };
      if (FALSE.has(t)) return { value: false };
      return bad('true or false (or yes, no, 1, 0)');
    }
    case 'date': {
      const iso = toIsoDate(text);
      if (iso === null || !isIsoDate(iso)) return bad('a date');
      return { value: iso };
    }
    case 'choice': {
      const value = matchOption(column.options ?? [], text);
      return value === null ? bad('one of the options') : { value };
    }
  }
}

/**
 * Converts pasted tab-separated text into table rows keyed by column id. Cells fill the columns
 * from `startColumn` in order. Empty cells and cells that do not fit their column are left out of
 * the row; the latter add a message to `problems`. Rows beyond `maxRows` are dropped.
 */
export function parseTablePaste(
  attr: TableAttribute,
  text: string,
  startColumn = 0,
): PasteResult {
  const problems: string[] = [];
  let lines = text.trim() === '' ? [] : splitCells(text);
  if (attr.maxRows !== undefined && lines.length > attr.maxRows) {
    problems.push(
      `Only ${attr.maxRows} rows fit in this table; ${lines.length - attr.maxRows} extra rows were left out.`,
    );
    lines = lines.slice(0, attr.maxRows);
  }
  const rows = lines.map((cells, r) => {
    const row: Record<string, Json> = {};
    const room = attr.columns.length - startColumn;
    if (cells.slice(Math.max(0, room)).some((c) => c.trim() !== ''))
      problems.push(
        `Row ${r + 1}: there are more cells than columns; the extra cells were left out.`,
      );
    cells.forEach((raw, c) => {
      const column = attr.columns[startColumn + c];
      if (column === undefined) return;
      if (raw.trim() === '') return;
      const result = convertCell(column, raw);
      if ('message' in result) {
        const name = column.labels?.en ?? column.key;
        problems.push(`Row ${r + 1}, column "${name}": ${result.message}`);
      } else row[column.id] = result.value;
    });
    return row;
  });
  return { rows, problems };
}

/**
 * Puts pasted rows into the existing rows from `startRow` on. Cells that were pasted replace the
 * old ones; other cells of those rows stay. Rows past the end are appended. The input is not
 * changed. `maxRows` cuts the result.
 */
export function tableWithPaste(
  current: readonly Record<string, Json>[],
  startRow: number,
  pasted: readonly Record<string, Json>[],
  maxRows?: number,
): Record<string, Json>[] {
  const out = current.map((r) => ({ ...r }));
  const start = Math.max(0, Math.min(Math.floor(startRow), out.length));
  pasted.forEach((row, i) => {
    out[start + i] = { ...(out[start + i] ?? {}), ...row };
  });
  return maxRows === undefined ? out : out.slice(0, maxRows);
}
