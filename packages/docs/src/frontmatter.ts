import type { Topic } from './types';

/** A file that cannot be read as a topic. The message starts with the path. */
export class DocsFileError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'DocsFileError';
  }
}

const KEYS = new Set([
  'id',
  'title',
  'category',
  'summary',
  'keywords',
  'contexts',
  'order',
]);

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2) {
    const first = v[0];
    if ((first === '"' || first === "'") && v.endsWith(first)) {
      return v.slice(1, -1);
    }
  }
  return v;
}

/** Splits `a, "b, c", d` at commas outside quotes. */
function splitList(inner: string): string[] {
  const items: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      items.push(current);
      current = '';
    } else current += ch;
  }
  items.push(current);
  return items.map(unquote).filter((s) => s !== '');
}

/**
 * Reads one topic file: front matter between two `---` lines, then the Markdown body.
 * Throws DocsFileError (with the path) when the file cannot be used as a topic.
 */
export function parseTopicFile(path: string, source: string): Topic {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') {
    throw new DocsFileError(path, 'the file must start with a "---" line');
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === '---') {
      end = i;
      break;
    }
  }
  if (end < 0) {
    throw new DocsFileError(path, 'the front matter has no closing "---" line');
  }

  const values = new Map<string, string | string[]>();
  let listKey: string | null = null;
  for (let i = 1; i < end; i++) {
    const raw = lines[i]!;
    const lineNo = i + 1;
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const item = /^\s+-\s+(.*)$/.exec(raw);
    if (item && listKey) {
      const list = values.get(listKey);
      if (Array.isArray(list)) list.push(unquote(item[1]!));
      continue;
    }
    const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(raw);
    if (!match) {
      throw new DocsFileError(
        path,
        `front matter line ${lineNo} is not "key: value": ${raw.trim()}`,
      );
    }
    const key = match[1]!;
    const value = match[2]!.trim();
    if (!KEYS.has(key)) {
      throw new DocsFileError(
        path,
        `unknown front matter key "${key}" on line ${lineNo}`,
      );
    }
    if (values.has(key)) {
      throw new DocsFileError(
        path,
        `front matter key "${key}" appears twice (line ${lineNo})`,
      );
    }
    listKey = null;
    if (key === 'keywords' || key === 'contexts') {
      if (value === '') {
        values.set(key, []);
        listKey = key;
      } else if (value.startsWith('[')) {
        if (!value.endsWith(']')) {
          throw new DocsFileError(
            path,
            `"${key}" on line ${lineNo} is missing its closing "]"`,
          );
        }
        values.set(key, splitList(value.slice(1, -1)));
      } else {
        values.set(key, splitList(value));
      }
    } else {
      values.set(key, unquote(value));
    }
  }

  const text1 = (key: string): string => {
    const v = values.get(key);
    return typeof v === 'string' ? v : '';
  };
  const list = (key: string): string[] => {
    const v = values.get(key);
    return Array.isArray(v) ? v : [];
  };

  const id = text1('id');
  if (id === '') throw new DocsFileError(path, 'front matter needs an "id"');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new DocsFileError(
      path,
      `the id "${id}" may only use lower case letters, digits and "-"`,
    );
  }
  const title = text1('title');
  if (title === '') {
    throw new DocsFileError(path, 'front matter needs a "title"');
  }
  const orderText = text1('order');
  let order = 1000;
  if (orderText !== '') {
    order = Number(orderText);
    if (!Number.isFinite(order)) {
      throw new DocsFileError(
        path,
        `"order" must be a number, not "${orderText}"`,
      );
    }
  }

  return {
    id,
    title,
    category: text1('category'),
    summary: text1('summary'),
    keywords: list('keywords'),
    contexts: list('contexts'),
    order,
    body: lines
      .slice(end + 1)
      .join('\n')
      .replace(/^\n+/, ''),
    path,
  };
}
