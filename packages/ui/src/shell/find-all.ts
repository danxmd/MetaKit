import {
  effectiveAttributes,
  type AttributeDef,
  type ElementId,
  type Model,
  type ToolLibrary,
} from '@metakit-app/core';

export interface FindAllEntry {
  slug: string;
  name: string;
  model: Model;
  tool: ToolLibrary;
}

export type FindAllMatch =
  'label' | 'class' | 'attribute-value' | 'attribute-key';

export interface FindAllHit {
  /** The model's file slug, to open it. */
  slug: string;
  modelName: string;
  element: ElementId;
  /** What to show for the element: its label, or the class name when it has none. */
  title: string;
  className: string;
  matched: FindAllMatch;
  /** The attribute key for an attribute match, else empty. */
  field: string;
  /** The matching text, shortened around the match. */
  snippet: string;
}

export interface FindAllOptions {
  /** Language for class names (default "en"). */
  language?: string;
  /** Most hits to return (default 200). */
  limit?: number;
}

export const FIND_ALL_LIMIT = 200;

/** Lower is stronger. */
const rank: Record<FindAllMatch, number> = {
  label: 0,
  class: 1,
  'attribute-value': 2,
  'attribute-key': 3,
};
const MAX_SNIPPET = 80;

// Printable ASCII only; anything else (tabs, accents) takes the slower, accent-folding path.
const NOT_PLAIN = /[^\u0020-\u007e]/;
/** Lower case without accents; plain ASCII skips the slow normalisation. */
function fold(text: string): string {
  return !NOT_PLAIN.test(text)
    ? text.toLowerCase()
    : text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function snippetAround(text: string, at: number, length: number): string {
  if (text.length <= MAX_SNIPPET) return text;
  const start = Math.max(0, at - 20);
  const end = Math.min(text.length, at + length + 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

/** Text inside a stored value: strings, numbers, and the strings of lists and objects. */
function collect(value: unknown, out: string[], depth = 0): void {
  if (typeof value === 'string') {
    if (value !== '') out.push(value);
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value));
  } else if (depth < 4 && Array.isArray(value)) {
    for (const v of value) collect(v, out, depth + 1);
  } else if (depth < 4 && value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) collect(v, out, depth + 1);
  }
}

interface ClassInfo {
  name: string;
  /** Where the query sits in the class name, or -1. Worked out once per class. */
  nameAt: number;
  attributes: AttributeDef[];
  /** The first attribute whose key contains the query. */
  keyAt: { key: string } | null;
}

/**
 * Searches every element of every model for the query (ignoring case and accents). An element is
 * reported once, for its best match: its label (first text value), then its class name, then an
 * attribute value, then an attribute key. Stops at `limit` hits (200 by default).
 */
export function findAcrossModels(
  entries: readonly FindAllEntry[],
  query: string,
  options: FindAllOptions = {},
): FindAllHit[] {
  const needle = fold(query.trim());
  if (needle === '') return [];
  const language = options.language ?? 'en';
  const limit = options.limit ?? FIND_ALL_LIMIT;
  const hits: FindAllHit[] = [];

  // Class facts are the same for every element of a class, and models of one tool library share
  // them, so they are worked out once per library.
  const perTool = new Map<ToolLibrary, Map<string, ClassInfo>>();

  for (const entry of entries) {
    const { tool, model } = entry;
    let classes = perTool.get(tool);
    if (!classes) perTool.set(tool, (classes = new Map()));
    const infoOf = (classId: string): ClassInfo => {
      let info = classes.get(classId);
      if (info) return info;
      const cls = tool.classes[classId as keyof ToolLibrary['classes']];
      let attributes: AttributeDef[] = [];
      try {
        if (cls) attributes = effectiveAttributes(tool, cls.id);
      } catch {
        // A broken class chain has no attributes to search, but its elements still can match.
      }
      const name = cls ? (cls.labels[language] ?? cls.key) : '';
      info = {
        name,
        nameAt: fold(name).indexOf(needle),
        attributes,
        keyAt: attributes.find((a) => fold(a.key).includes(needle)) ?? null,
      };
      classes.set(classId, info);
      return info;
    };

    const found: FindAllHit[] = [];
    const strings: string[] = [];
    for (const el of Object.values(model.elements)) {
      const info = infoOf(el.class);
      let title = info.name || el.id;
      let labelDef: AttributeDef | undefined;
      for (const def of info.attributes) {
        const v = el.attrs[def.id];
        if (def.type === 'text' && typeof v === 'string' && v !== '') {
          title = v;
          labelDef = def;
          break;
        }
      }
      // The strongest kind of match wins, in this order, and ends the scan of the element.
      let matched: FindAllMatch | null = null;
      let field = '';
      let snippet = '';
      if (labelDef) {
        const at = fold(title).indexOf(needle);
        if (at >= 0) {
          matched = 'label';
          snippet = snippetAround(title, at, needle.length);
        }
      }
      if (matched === null && info.nameAt >= 0) {
        matched = 'class';
        snippet = snippetAround(info.name, info.nameAt, needle.length);
      }
      if (matched === null) {
        for (const def of info.attributes) {
          const value = el.attrs[def.id];
          if (def === labelDef || value === undefined) continue;
          strings.length = 0;
          collect(value, strings);
          for (const text of strings) {
            const at = fold(text).indexOf(needle);
            if (at < 0) continue;
            matched = 'attribute-value';
            field = def.key;
            snippet = snippetAround(text, at, needle.length);
            break;
          }
          if (matched !== null) break;
        }
      }
      // A key matches even when the element holds no value for it.
      if (matched === null && info.keyAt !== null) {
        matched = 'attribute-key';
        field = info.keyAt.key;
        snippet = info.keyAt.key;
      }
      if (matched !== null)
        found.push({
          slug: entry.slug,
          modelName: entry.name,
          element: el.id,
          title,
          className: info.name,
          matched,
          field,
          snippet,
        });
    }
    // Within a model the strongest matches come first; the sort is stable, so ties keep model order.
    found.sort((a, b) => rank[a.matched] - rank[b.matched]);
    for (const hit of found) {
      if (hits.length >= limit) return hits;
      hits.push(hit);
    }
  }
  return hits;
}

export interface FindAllGroup {
  slug: string;
  modelName: string;
  /** Each hit with its position in the whole list, for stable ids and keyboard order. */
  items: { n: number; hit: FindAllHit }[];
}

/** Groups hits by model, in order of first appearance. */
export function groupHits(hits: readonly FindAllHit[]): FindAllGroup[] {
  const groups: FindAllGroup[] = [];
  const bySlug: Record<string, FindAllGroup> = Object.create(null);
  hits.forEach((hit, n) => {
    let group = bySlug[hit.slug];
    if (!group) {
      group = { slug: hit.slug, modelName: hit.modelName, items: [] };
      bySlug[hit.slug] = group;
      groups.push(group);
    }
    group.items.push({ n, hit });
  });
  return groups;
}
