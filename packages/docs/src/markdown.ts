/**
 * A small Markdown reader for the documentation. It produces a typed tree and never HTML, so the
 * UI renders every node itself and no raw markup can reach the page. It never throws: input it
 * does not understand stays plain text.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | {
      type: 'topic';
      /** The target topic. Empty only inside parseInline: the index fills in the current topic. */
      id: string;
      anchor: string | null;
      /** The text the author gave; null shows the topic's title. */
      label: string | null;
      /** True when added by keyword linking rather than written as [[...]]. */
      auto: boolean;
    };

export type CalloutKind = 'tip' | 'note' | 'warning';

export interface ListItem {
  content: Inline[];
  sub: ListBlock | null;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export type Block =
  | { type: 'heading'; level: 2 | 3 | 4; id: string; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | ListBlock
  | { type: 'table'; header: Inline[][]; rows: Inline[][][] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'callout'; kind: CalloutKind; children: Block[] }
  | { type: 'quote'; children: Block[] }
  | { type: 'rule' };

// Inline -----------------------------------------------------------------------------------------

const ESCAPABLE = /[\\`*_[\]()#|<>~!+.-]/;
const isWordChar = (ch: string | undefined): boolean =>
  ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/** Only these schemes become links; anything else (javascript:, data:) stays text. */
export function safeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href.trim());
}

function parseTopicTarget(inner: string): Inline | null {
  const bar = inner.indexOf('|');
  const target = (bar < 0 ? inner : inner.slice(0, bar)).trim();
  const label = bar < 0 ? null : inner.slice(bar + 1).trim();
  const hash = target.indexOf('#');
  const id = (hash < 0 ? target : target.slice(0, hash)).trim();
  const anchor = hash < 0 ? '' : target.slice(hash + 1).trim();
  if (id === '' && anchor === '') return null;
  if (!/^[a-z0-9-]*$/i.test(id) || !/^[a-z0-9_-]*$/i.test(anchor)) return null;
  return {
    type: 'topic',
    id,
    anchor: anchor === '' ? null : anchor,
    label: label === '' ? null : label,
    auto: false,
  };
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf !== '') {
      out.push({ type: 'text', text: buf });
      buf = '';
    }
  };
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i]!;

    if (c === '\\' && i + 1 < n && ESCAPABLE.test(src[i + 1]!)) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    if (c === '`') {
      let run = 1;
      while (src[i + run] === '`') run++;
      const fence = '`'.repeat(run);
      const close = src.indexOf(fence, i + run);
      if (close > i + run) {
        flush();
        out.push({
          type: 'code',
          text: src.slice(i + run, close).replace(/^ (.+) $/, '$1'),
        });
        i = close + run;
        continue;
      }
      buf += fence;
      i += run;
      continue;
    }

    if (c === '[' && src[i + 1] === '[') {
      const close = src.indexOf(']]', i + 2);
      if (close > i + 2) {
        const node = parseTopicTarget(src.slice(i + 2, close));
        if (node) {
          flush();
          out.push(node);
          i = close + 2;
          continue;
        }
      }
    }

    if (c === '[') {
      // Find the matching ] (one level of nested brackets is enough for link text).
      let depth = 0;
      let close = -1;
      for (let j = i; j < n; j++) {
        const d = src[j];
        if (d === '\\') j++;
        else if (d === '[') depth++;
        else if (d === ']') {
          depth--;
          if (depth === 0) {
            close = j;
            break;
          }
        }
      }
      if (close > i + 1 && src[close + 1] === '(') {
        const end = src.indexOf(')', close + 2);
        if (end > close + 2) {
          const href = src.slice(close + 2, end).trim();
          const children = parseInline(src.slice(i + 1, close));
          if (safeHref(href)) {
            flush();
            out.push({ type: 'link', href, children });
          } else {
            // Not a safe address: keep the words, drop the link.
            flush();
            out.push(...children);
          }
          i = end + 1;
          continue;
        }
      }
    }

    if (c === '*' && src[i + 1] === '*') {
      const close = src.indexOf('**', i + 2);
      if (close > i + 2) {
        flush();
        out.push({
          type: 'strong',
          children: parseInline(src.slice(i + 2, close)),
        });
        i = close + 2;
        continue;
      }
    }

    if (c === '*' || c === '_') {
      const prev = src[i - 1];
      const opensWord = c === '*' || !isWordChar(prev);
      if (opensWord && src[i + 1] !== undefined && !/\s/.test(src[i + 1]!)) {
        let close = -1;
        for (let j = i + 1; j < n; j++) {
          if (src[j] === '\\') {
            j++;
            continue;
          }
          if (src[j] !== c) continue;
          if (c === '*' && src[j + 1] === '*') {
            j++;
            continue;
          }
          if (/\s/.test(src[j - 1]!)) continue;
          if (c === '_' && isWordChar(src[j + 1])) continue;
          close = j;
          break;
        }
        if (close > i + 1) {
          flush();
          out.push({
            type: 'em',
            children: parseInline(src.slice(i + 1, close)),
          });
          i = close + 1;
          continue;
        }
      }
    }

    buf += c;
    i++;
  }
  flush();
  return out;
}

/** The words of some inline nodes, without any markup. */
export function inlineText(nodes: readonly Inline[]): string {
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'code') text += node.text;
    else if (node.type === 'topic') text += node.label ?? node.id;
    else text += inlineText(node.children);
  }
  return text;
}

// Blocks -----------------------------------------------------------------------------------------

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const QUOTE = /^\s{0,3}>/;

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'section' : slug;
}

function indentOf(line: string): number {
  let width = 0;
  for (const ch of line) {
    if (ch === ' ') width++;
    else if (ch === '\t') width += 4;
    else break;
  }
  return width;
}

function splitRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells: string[] = [];
  let cell = '';
  let inCode = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\\' && text[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (ch === '`') {
      inCode = !inCode;
      cell += ch;
    } else if (ch === '|' && !inCode) {
      cells.push(cell.trim());
      cell = '';
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

const CALLOUT = /^\s*\*\*(Tip|Note|Warning)(?::)?\*\*\s*:?\s*/i;

function startsBlock(line: string, next: string | undefined): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    QUOTE.test(line) ||
    RULE.test(line) ||
    LIST_ITEM.test(line) ||
    (line.includes('|') &&
      next !== undefined &&
      next.includes('-') &&
      TABLE_SEPARATOR.test(next))
  );
}

interface ListResult {
  block: ListBlock;
  next: number;
}

function parseList(lines: string[], start: number): ListResult {
  const first = LIST_ITEM.exec(lines[start]!)!;
  const baseIndent = indentOf(first[1]!);
  const ordered = /\d/.test(first[2]![0]!);
  const items: { text: string; subLines: string[] }[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      // A blank line continues the list only when the next line is another item of it.
      let j = i + 1;
      while (j < lines.length && lines[j]!.trim() === '') j++;
      const m = j < lines.length ? LIST_ITEM.exec(lines[j]!) : null;
      if (m && indentOf(m[1]!) >= baseIndent) {
        i = j;
        continue;
      }
      break;
    }
    const m = LIST_ITEM.exec(line);
    const indent = indentOf(line);
    if (m && indent <= baseIndent + 1) {
      const isOrdered = /\d/.test(m[2]![0]!);
      if (isOrdered !== ordered && indent <= baseIndent) break;
      items.push({ text: m[3]!.trim(), subLines: [] });
      i++;
      continue;
    }
    const current = items[items.length - 1];
    if (!current) break;
    if (m && indent > baseIndent) {
      current.subLines.push(line);
      i++;
      continue;
    }
    if (indent <= baseIndent && startsBlock(line, lines[i + 1])) break;
    // A wrapped line of the item text, or of the item's sub list.
    if (current.subLines.length > 0) current.subLines.push(line);
    else current.text += ' ' + line.trim();
    i++;
  }
  const result: ListItem[] = items.map((item) => ({
    content: parseInline(item.text),
    sub:
      item.subLines.length > 0 && LIST_ITEM.test(item.subLines[0]!)
        ? parseList(item.subLines, 0).block
        : null,
  }));
  return { block: { type: 'list', ordered, items: result }, next: i };
}

export function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  const slugs = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1]!;
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const close = lines[i]!.trim();
        if (
          /^(`{3,}|~{3,})$/.test(close) &&
          close[0] === marker[0] &&
          close.length >= marker.length
        ) {
          break;
        }
        body.push(lines[i]!);
        i++;
      }
      i++; // the closing fence; a missing one runs to the end of the file
      blocks.push({ type: 'code', lang: fence[2] ?? '', text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = Math.min(4, Math.max(2, heading[1]!.length)) as 2 | 3 | 4;
      const children = parseInline(heading[2]!);
      const base = slugify(inlineText(children));
      const seen = slugs.get(base) ?? 0;
      slugs.set(base, seen + 1);
      blocks.push({
        type: 'heading',
        level,
        id: seen === 0 ? base : `${base}-${seen + 1}`,
        children,
      });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) {
        inner.push(lines[i]!.replace(/^\s{0,3}> ?/, ''));
        i++;
      }
      const label = CALLOUT.exec(inner[0] ?? '');
      if (label) {
        inner[0] = inner[0]!.replace(CALLOUT, '');
        blocks.push({
          type: 'callout',
          kind: label[1]!.toLowerCase() as CalloutKind,
          children: parseBlocks(inner),
        });
      } else {
        blocks.push({ type: 'quote', children: parseBlocks(inner) });
      }
      continue;
    }

    const next = lines[i + 1];
    if (
      line.includes('|') &&
      next !== undefined &&
      next.includes('-') &&
      TABLE_SEPARATOR.test(next)
    ) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (
        i < lines.length &&
        lines[i]!.trim() !== '' &&
        lines[i]!.includes('|')
      ) {
        rows.push(splitRow(lines[i]!));
        i++;
      }
      const width = header.length;
      const fit = (cells: string[]): Inline[][] =>
        Array.from({ length: width }, (_, k) => parseInline(cells[k] ?? ''));
      blocks.push({
        type: 'table',
        header: fit(header),
        rows: rows.map(fit),
      });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const result = parseList(lines, i);
      blocks.push(result.block);
      i = Math.max(result.next, i + 1);
      continue;
    }

    const para: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !startsBlock(lines[i]!, lines[i + 1])
    ) {
      para.push(lines[i]!.trim());
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) });
  }
  return blocks;
}

export function parseMarkdown(source: string): Block[] {
  try {
    return parseBlocks(source.replace(/\r\n?/g, '\n').split('\n'));
  } catch {
    // A parser bug must not take the Help panel down; show the text as it is.
    return [{ type: 'paragraph', children: [{ type: 'text', text: source }] }];
  }
}

/** The plain words of a document, for search. */
export function blocksText(blocks: readonly Block[]): string {
  const parts: string[] = [];
  const list = (l: ListBlock) => {
    for (const item of l.items) {
      parts.push(inlineText(item.content));
      if (item.sub) list(item.sub);
    }
  };
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        parts.push(inlineText(block.children));
        break;
      case 'list':
        list(block);
        break;
      case 'table':
        for (const cell of block.header) parts.push(inlineText(cell));
        for (const row of block.rows)
          for (const cell of row) parts.push(inlineText(cell));
        break;
      case 'code':
        parts.push(block.text);
        break;
      case 'callout':
      case 'quote':
        parts.push(blocksText(block.children));
        break;
      case 'rule':
        break;
    }
  }
  return parts.join('\n');
}
