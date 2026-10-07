import {
  newId,
  optionValue,
  type AttributeDef,
  type AttributeType,
  type ChoiceOption,
  type Labels,
} from '@metakit-app/core';

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: 'Text',
  integer: 'Whole number',
  number: 'Number',
  boolean: 'Yes or no',
  date: 'Date',
  'date-time': 'Date and time',
  duration: 'Duration',
  choice: 'Choice (one of a list)',
  'multi-choice': 'Choices (several of a list)',
  formula: 'Formula (calculated, read-only)',
  table: 'Table',
  reference: 'Reference to another object',
  action: 'Button that runs something',
  link: 'Link',
};

/** A new attribute of a type with values that are valid and easy to change. */
export function blankAttribute(type: AttributeType, key: string): AttributeDef {
  const base = { id: newId('attribute'), key };
  switch (type) {
    case 'choice':
      return { ...base, type, options: ['Option A', 'Option B'] };
    case 'multi-choice':
      return { ...base, type, options: ['Option A', 'Option B'] };
    case 'formula':
      return { ...base, type, formula: '0' };
    case 'table':
      return {
        ...base,
        type,
        columns: [
          {
            id: newId('attribute').replace('att_', 'col_'),
            key: 'Column1',
            type: 'text',
          },
        ],
      };
    case 'reference':
      return { ...base, type, target: {} };
    case 'action':
      return { ...base, type, run: { kind: 'command', ref: 'open' } };
    default:
      return { ...base, type } as AttributeDef;
  }
}

/** A key that no other attribute has: `Name`, `Name2`, `Name3`... */
export function uniqueKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const clean = base.replace(/[^A-Za-z0-9_]/g, '') || 'Item';
  const start = /^[A-Za-z_]/.test(clean) ? clean : `_${clean}`;
  if (!used.has(start)) return start;
  for (let i = 2; ; i++) if (!used.has(`${start}${i}`)) return `${start}${i}`;
}

/** The label to show for something with labels per language. */
export function labelIn(
  labels: Labels | undefined,
  language: string,
  fallback: string,
): string {
  return labels?.[language] ?? Object.values(labels ?? {})[0] ?? fallback;
}

/** Labels with one language set; an empty text removes the language. */
export function withLabel(
  labels: Labels | undefined,
  language: string,
  text: string,
): Labels {
  const next = { ...labels };
  if (text.trim() === '') delete next[language];
  else next[language] = text;
  return next;
}

/** One option per line: `value`, or `value | Label` to give it a label in `language`. */
export function optionsToText(
  options: readonly ChoiceOption[],
  language: string,
): string {
  return options
    .map((o) =>
      typeof o === 'string'
        ? o
        : o.labels?.[language]
          ? `${o.value} | ${o.labels[language]}`
          : o.value,
    )
    .join('\n');
}

export function textToOptions(
  text: string,
  language: string,
  previous: readonly ChoiceOption[] = [],
): ChoiceOption[] {
  const out: ChoiceOption[] = [];
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    const [rawValue = '', ...rest] = line.split('|');
    const value = rawValue.trim();
    if (value === '' || seen.has(value)) continue;
    seen.add(value);
    const label = rest.join('|').trim();
    const old = previous.find((o) => optionValue(o) === value);
    const oldLabels = typeof old === 'object' ? { ...old.labels } : {};
    if (label === '') {
      delete oldLabels[language];
      out.push(
        Object.keys(oldLabels).length > 0
          ? { value, labels: oldLabels }
          : value,
      );
    } else out.push({ value, labels: { ...oldLabels, [language]: label } });
  }
  return out;
}

/** A copy of a definition with some fields changed; a field set to undefined is removed. */
export function withPatch<T extends object>(
  def: T,
  patch: Record<string, unknown>,
): T {
  const next: Record<string, unknown> = { ...def, ...patch };
  for (const [k, v] of Object.entries(patch))
    if (v === undefined) delete next[k];
  return next as T;
}

/** The list with a value added (when `on`) or removed, keeping order and leaving no duplicates. */
export function toggled<T>(
  list: readonly T[] | undefined,
  value: T,
  on: boolean,
): T[] {
  const rest = (list ?? []).filter((x) => x !== value);
  return on ? [...rest, value] : rest;
}
