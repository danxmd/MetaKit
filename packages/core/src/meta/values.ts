import type { AttributeDef } from './types';
import { optionValue } from './types';

/**
 * One thing wrong with a value. `message` is a sentence fragment that follows the attribute's
 * name, for example "is longer than 10 characters (it has 11)".
 */
export interface ValueProblem {
  code: string;
  message: string;
}

/** Missing, null, empty text or an empty list. Zero and false are values. */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,9})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;
const DURATION =
  /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/;

function realDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function isIsoDate(text: string): boolean {
  const m = DATE.exec(text);
  return m !== null && realDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function isIsoDateTime(text: string): boolean {
  const m = DATE_TIME.exec(text);
  return m !== null && realDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function isIsoDuration(text: string): boolean {
  return DURATION.test(text);
}

const problem = (code: string, message: string): ValueProblem[] => [
  { code, message },
];

function decimalsOf(value: number): number {
  let d = 0;
  let scaled = value;
  while (Math.abs(scaled - Math.round(scaled)) > 1e-9 && d < 15) {
    scaled *= 10;
    d += 1;
  }
  return d;
}

function listOf(options: readonly (string | { value: string })[]): string {
  return options.map((o) => (typeof o === 'string' ? o : o.value)).join(', ');
}

/**
 * Checks a value against the type and options of an attribute. An empty value is never a problem
 * here: whether a value is required is a separate rule.
 */
export function checkAttributeValue(
  def: AttributeDef,
  value: unknown,
): ValueProblem[] {
  if (isEmptyValue(value) && def.type !== 'boolean') return [];
  switch (def.type) {
    case 'text': {
      if (typeof value !== 'string')
        return problem('wrong-type', 'must be text');
      const out: ValueProblem[] = [];
      if (def.maxLength !== undefined && value.length > def.maxLength) {
        out.push({
          code: 'max-length',
          message: `is longer than ${def.maxLength} characters (it has ${value.length})`,
        });
      }
      if (def.pattern !== undefined) {
        let matches = true;
        try {
          matches = new RegExp(def.pattern).test(value);
        } catch {
          // An invalid pattern is reported when the Kit is checked, not for every value.
        }
        if (!matches)
          out.push({
            code: 'pattern',
            message: `does not match the pattern ${def.pattern}`,
          });
      }
      return out;
    }
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        return problem('wrong-type', 'must be a number');
      const out: ValueProblem[] = [];
      if (def.type === 'integer' && !Number.isInteger(value)) {
        out.push({ code: 'not-integer', message: 'must be a whole number' });
      }
      if (
        def.type === 'number' &&
        def.decimals !== undefined &&
        decimalsOf(value) > def.decimals
      ) {
        out.push({
          code: 'decimals',
          message: `must have at most ${def.decimals} decimal places`,
        });
      }
      if (def.min !== undefined && value < def.min)
        out.push({ code: 'min', message: `must be at least ${def.min}` });
      if (def.max !== undefined && value > def.max)
        out.push({ code: 'max', message: `must be at most ${def.max}` });
      return out;
    }
    case 'boolean':
      return value === undefined || value === null || typeof value === 'boolean'
        ? []
        : problem('wrong-type', 'must be true or false');
    case 'date':
      if (typeof value !== 'string')
        return problem('wrong-type', 'must be a date like 2026-10-07');
      return isIsoDate(value)
        ? []
        : problem(
            'bad-date',
            `is not a valid date (use the form 2026-10-07): "${value}"`,
          );
    case 'date-time':
      if (typeof value !== 'string')
        return problem(
          'wrong-type',
          'must be a date and time like 2026-10-07T09:30:00Z',
        );
      return isIsoDateTime(value)
        ? []
        : problem(
            'bad-date-time',
            `is not a valid date and time (use the form 2026-10-07T09:30:00Z): "${value}"`,
          );
    case 'duration':
      if (typeof value !== 'string')
        return problem('wrong-type', 'must be a duration like PT90M');
      return isIsoDuration(value)
        ? []
        : problem(
            'bad-duration',
            `is not a valid duration (use the form PT90M or P1DT2H): "${value}"`,
          );
    case 'choice': {
      if (typeof value !== 'string')
        return problem('wrong-type', 'must be one of the options');
      const values = def.options.map(optionValue);
      return values.includes(value)
        ? []
        : problem(
            'not-an-option',
            `must be one of: ${listOf(def.options)} (it is "${value}")`,
          );
    }
    case 'multi-choice': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
        return problem('wrong-type', 'must be a list of options');
      const values = def.options.map(optionValue);
      const out: ValueProblem[] = [];
      const bad = value.filter((v) => !values.includes(v as string));
      if (bad.length > 0)
        out.push({
          code: 'not-an-option',
          message: `has values that are not options: ${bad.join(', ')} (options: ${listOf(def.options)})`,
        });
      if (new Set(value).size !== value.length)
        out.push({
          code: 'duplicate',
          message: 'lists an option more than once',
        });
      if (def.min !== undefined && value.length < def.min)
        out.push({
          code: 'min-count',
          message: `needs at least ${def.min} options (it has ${value.length})`,
        });
      if (def.max !== undefined && value.length > def.max)
        out.push({
          code: 'max-count',
          message: `allows at most ${def.max} options (it has ${value.length})`,
        });
      return out;
    }
    case 'formula':
    case 'action':
      return [];
    case 'table': {
      if (!Array.isArray(value))
        return problem('wrong-type', 'must be a list of rows');
      const out: ValueProblem[] = [];
      if (def.maxRows !== undefined && value.length > def.maxRows) {
        out.push({
          code: 'max-count',
          message: `allows at most ${def.maxRows} rows (it has ${value.length})`,
        });
      }
      value.forEach((row, index) => {
        if (row === null || typeof row !== 'object' || Array.isArray(row)) {
          out.push({
            code: 'wrong-type',
            message: `row ${index + 1} must be an object with one value per column`,
          });
          return;
        }
        for (const column of def.columns) {
          const cell = (row as Record<string, unknown>)[column.id];
          const asAttribute = {
            id: 'att_cell',
            key: column.key,
            type: column.type,
            options: column.options ?? [],
          } as AttributeDef;
          for (const p of checkAttributeValue(asAttribute, cell)) {
            out.push({
              code: `cell-${p.code}`,
              message: `row ${index + 1}, column ${column.key} ${p.message}`,
            });
          }
        }
        const known = new Set(def.columns.map((c) => c.id));
        const extra = Object.keys(row).filter((k) => !known.has(k));
        if (extra.length > 0)
          out.push({
            code: 'unknown-column',
            message: `row ${index + 1} has values for unknown columns: ${extra.join(', ')}`,
          });
      });
      return out;
    }
    case 'reference': {
      if (!Array.isArray(value))
        return problem('wrong-type', 'must be a list of references');
      const out: ValueProblem[] = [];
      if (
        value.some(
          (r) =>
            r === null ||
            typeof r !== 'object' ||
            typeof (r as { element?: unknown }).element !== 'string',
        )
      ) {
        out.push({
          code: 'wrong-type',
          message: 'must be a list of references, each with an element',
        });
      }
      if (def.max !== undefined && value.length > def.max)
        out.push({
          code: 'max-count',
          message: `allows at most ${def.max} references (it has ${value.length})`,
        });
      return out;
    }
    case 'link': {
      if (typeof value !== 'string')
        return problem('wrong-type', 'must be a link');
      const isUrl = /^https?:\/\/\S+$/.test(value);
      const isFile =
        !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
        !value.startsWith('/') &&
        !value.split('/').includes('..');
      const target = def.target ?? 'any';
      if (target === 'url' && !isUrl)
        return problem(
          'bad-link',
          `must be a web address starting with http:// or https:// (it is "${value}")`,
        );
      if (target === 'file' && !isFile)
        return problem(
          'bad-link',
          `must be a file inside the workspace, such as assets/plan.pdf (it is "${value}")`,
        );
      if (target === 'any' && !isUrl && !isFile)
        return problem(
          'bad-link',
          `must be a web address or a file inside the workspace (it is "${value}")`,
        );
      return [];
    }
  }
}
