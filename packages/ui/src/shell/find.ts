import {
  effectiveAttributes,
  effectiveRelationAttributes,
  type ConnectorId,
  type ElementId,
  type Model,
  type ToolLibrary,
} from '@metakit-app/core';

export interface FindHit {
  id: ElementId | ConnectorId;
  kind: 'element' | 'connector';
  /** What to show for the hit: its name, or the class name when it has none. */
  title: string;
  /** Where the text was found: "name" or the key of the attribute. */
  field: string;
  /** The text that matched, shortened around the match. */
  excerpt: string;
}

const MAX_EXCERPT = 80;

function excerptAround(text: string, at: number, length: number): string {
  if (text.length <= MAX_EXCERPT) return text;
  const start = Math.max(0, at - 20);
  const end = Math.min(text.length, at + length + 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean')
    return [String(value)];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (value !== null && typeof value === 'object')
    return Object.values(value).flatMap(stringsOf);
  return [];
}

/**
 * Finds elements and connectors whose name or any attribute value contains the query (ignoring
 * case and accents), names first. Results keep the drawing order within each group.
 */
export function findInModel(
  tool: ToolLibrary,
  model: Model,
  query: string,
  language = 'en',
  limit = 100,
): FindHit[] {
  const needle = fold(query.trim());
  if (needle === '') return [];
  const named: FindHit[] = [];
  const valued: FindHit[] = [];
  const consider = (
    id: ElementId | ConnectorId,
    kind: 'element' | 'connector',
    attrs: Record<string, unknown>,
    defs: { id: string; key: string; type: string }[],
    fallbackTitle: string,
  ) => {
    let title = fallbackTitle;
    const firstText = defs.find(
      (d) =>
        d.type === 'text' &&
        typeof attrs[d.id] === 'string' &&
        attrs[d.id] !== '',
    );
    if (firstText) title = attrs[firstText.id] as string;
    let found: FindHit | null = null;
    let foundByName = false;
    for (const def of defs) {
      for (const text of stringsOf(attrs[def.id])) {
        const at = fold(text).indexOf(needle);
        if (at < 0) continue;
        const isName = def === firstText;
        if (!found || (isName && !foundByName)) {
          found = {
            id,
            kind,
            title,
            field: isName ? 'name' : def.key,
            excerpt: excerptAround(text, at, needle.length),
          };
          foundByName = isName;
        }
      }
    }
    if (found) (foundByName ? named : valued).push(found);
  };

  for (const e of Object.values(model.elements).sort((a, b) =>
    a.pos < b.pos ? -1 : 1,
  )) {
    const cls = tool.classes[e.class];
    const defs = attributesOrNone(() =>
      cls ? effectiveAttributes(tool, e.class) : [],
    );
    consider(
      e.id,
      'element',
      e.attrs,
      defs,
      cls ? (cls.labels[language] ?? cls.key) : '',
    );
  }
  for (const c of Object.values(model.connectors).sort((a, b) =>
    a.pos < b.pos ? -1 : 1,
  )) {
    const rel = tool.relations[c.relation];
    const defs = attributesOrNone(() =>
      rel ? effectiveRelationAttributes(tool, c.relation) : [],
    );
    consider(
      c.id,
      'connector',
      c.attrs,
      defs,
      rel ? (rel.labels[language] ?? rel.key) : '',
    );
  }
  return [...named, ...valued].slice(0, limit);
}

/** A broken class chain has no attributes to search; it must not stop the search of the rest. */
function attributesOrNone(
  read: () => { id: string; key: string; type: string }[],
): { id: string; key: string; type: string }[] {
  try {
    return read();
  } catch {
    return [];
  }
}

function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
