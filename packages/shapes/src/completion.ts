import { FUNCTION_NAMES } from '@metakit-app/formula';

export type CompletionKind = 'attribute' | 'let' | 'builtin' | 'function';

export interface Completion {
  name: string;
  kind: CompletionKind;
  /** What to put in the text: functions bring their opening bracket. */
  insert: string;
}

export interface CompletionContext {
  /** Attribute keys of the class the shape is previewed for. */
  attributes?: readonly string[];
  /** Names defined in the shape's `let`. */
  lets?: readonly string[];
}

/** Names every shape formula can read besides attributes (see `makeScope`). */
export const BUILTIN_NAMES = [
  '$label',
  '$class',
  '$width',
  '$height',
  '$fill',
  '$fields',
] as const;

const KIND_ORDER: Record<CompletionKind, number> = {
  attribute: 0,
  let: 1,
  builtin: 2,
  function: 3,
};

/**
 * Names to offer for what has been typed. Names that start with the prefix come first, then names
 * that contain it; the case is ignored. Within each group attributes come before `let` names,
 * `$` names and functions, and then alphabetical order. Nothing typed offers every name.
 */
export function completeNames(
  prefix: string,
  context: CompletionContext,
  limit = 12,
): Completion[] {
  const all: Completion[] = [
    ...(context.attributes ?? []).map((name) => ({
      name,
      kind: 'attribute' as const,
      insert: name,
    })),
    ...(context.lets ?? []).map((name) => ({
      name,
      kind: 'let' as const,
      insert: name,
    })),
    ...BUILTIN_NAMES.map((name) => ({
      name,
      kind: 'builtin' as const,
      insert: name,
    })),
    ...FUNCTION_NAMES.map((name) => ({
      name,
      kind: 'function' as const,
      insert: `${name}(`,
    })),
  ];
  const seen = new Set<string>();
  const needle = prefix.toLowerCase();
  const ranked: { c: Completion; rank: number }[] = [];
  for (const c of all) {
    const key = `${c.kind}:${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hay = c.name.toLowerCase();
    if (hay.startsWith(needle)) ranked.push({ c, rank: 0 });
    else if (hay.includes(needle)) ranked.push({ c, rank: 1 });
  }
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      KIND_ORDER[a.c.kind] - KIND_ORDER[b.c.kind] ||
      a.c.name.localeCompare(b.c.name),
  );
  return ranked.slice(0, limit).map((r) => r.c);
}

export interface NameAtCursor {
  /** What has been typed of the name, up to the cursor. */
  prefix: string;
  /** The whole word the cursor is in, so a chosen name can replace it. */
  start: number;
  end: number;
}

const isNameChar = (c: string | undefined) =>
  c !== undefined && /[A-Za-z0-9_$]/.test(c);

/**
 * The name being typed at `cursor`, or null when the cursor is not in a name: inside a quoted
 * text, after a `.` (record fields are not known here), in a number, or in empty space. A leading
 * `=` of the formula is not part of the name.
 */
export function namesAtCursor(
  text: string,
  cursor: number,
): NameAtCursor | null {
  let quote: string | null = null;
  for (let i = 0; i < cursor && i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') quote = c;
  }
  if (quote) return null;
  let start = cursor;
  while (start > 0 && isNameChar(text[start - 1])) start--;
  let end = cursor;
  while (end < text.length && isNameChar(text[end])) end++;
  if (start === end) return { prefix: '', start, end };
  if (/[0-9]/.test(text[start]!)) return null;
  let before = start - 1;
  while (before >= 0 && text[before] === ' ') before--;
  if (before >= 0 && text[before] === '.') return null;
  return { prefix: text.slice(start, cursor), start, end };
}
