import { DOC_CONTEXTS, isDocContext } from './contexts';
import { DocsFileError, parseTopicFile } from './frontmatter';
import {
  blocksText,
  parseMarkdown,
  type Block,
  type Inline,
  type ListBlock,
} from './markdown';
import { CATEGORIES, isCategoryId, type Topic } from './types';

export type ProblemKind =
  | 'parse'
  | 'duplicate-id'
  | 'path-mismatch'
  | 'unknown-category'
  | 'missing-summary'
  | 'broken-link'
  | 'broken-anchor'
  | 'keyword-conflict'
  | 'unknown-context'
  | 'missing-context';

export interface Problem {
  kind: ProblemKind;
  /** The topic id, when the problem belongs to one. */
  topic: string | null;
  path: string;
  message: string;
}

export interface SearchHit {
  topic: Topic;
  score: number;
  snippet: string;
}

export interface CategoryGroup {
  id: string;
  title: string;
  topics: Topic[];
}

export interface ProblemOptions {
  /** Report known contexts without a topic as problems. Off while the content is written. */
  strictContexts?: boolean;
}

// Transforming ASTs -----------------------------------------------------------------------------

interface InlineSite {
  heading: boolean;
  callout: boolean;
}

/** Applies `fn` to every list of inline nodes of the document, in reading order. */
function transformBlocks(
  blocks: readonly Block[],
  fn: (nodes: Inline[], site: InlineSite) => Inline[],
  inCallout = false,
): Block[] {
  const list = (l: ListBlock): ListBlock => ({
    ...l,
    items: l.items.map((item) => ({
      content: fn(item.content, { heading: false, callout: inCallout }),
      sub: item.sub ? list(item.sub) : null,
    })),
  });
  const plain: InlineSite = { heading: false, callout: inCallout };
  return blocks.map((block): Block => {
    switch (block.type) {
      case 'heading':
        return {
          ...block,
          children: fn(block.children, { heading: true, callout: inCallout }),
        };
      case 'paragraph':
        return { ...block, children: fn(block.children, plain) };
      case 'list':
        return list(block);
      case 'table':
        return {
          ...block,
          header: block.header.map((c) => fn(c, plain)),
          rows: block.rows.map((row) => row.map((c) => fn(c, plain))),
        };
      case 'callout':
        return {
          ...block,
          children: transformBlocks(block.children, fn, true),
        };
      case 'quote':
        return {
          ...block,
          children: transformBlocks(block.children, fn, inCallout),
        };
      case 'code':
      case 'rule':
        return block;
    }
  });
}

/** Calls `visit` for every inline node, including nested ones. */
function eachInline(blocks: readonly Block[], visit: (n: Inline) => void) {
  const walk = (nodes: Inline[]): Inline[] => {
    for (const node of nodes) {
      visit(node);
      if (node.type === 'strong' || node.type === 'em' || node.type === 'link')
        walk(node.children);
    }
    return nodes;
  };
  transformBlocks(blocks, walk);
}

function headingIds(blocks: readonly Block[]): Set<string> {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type === 'heading') ids.add(block.id);
    else if (block.type === 'callout' || block.type === 'quote')
      for (const id of headingIds(block.children)) ids.add(id);
  }
  return ids;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The index -------------------------------------------------------------------------------------

interface SearchRecord {
  titleL: string;
  keywordsL: string[];
  summaryL: string;
  body: string;
  bodyL: string;
}

export class DocsIndex {
  /** Every topic, sorted by category, then order, then title. */
  readonly topics: readonly Topic[];
  private readonly byId = new Map<string, Topic>();
  private readonly fileProblems: Problem[] = [];
  private readonly raw = new Map<string, Block[]>();
  private readonly linkedCache = new Map<string, Block[]>();
  private readonly records = new Map<string, SearchRecord>();
  private termOwners: Map<string, string[]> | null = null;
  private termOrder: string[] = [];
  private backlinkMap: Map<string, string[]> | null = null;
  private readonly categoryRank = new Map<string, number>(
    CATEGORIES.map((c, i) => [c.id, i]),
  );

  private constructor(topics: Topic[], problems: Problem[]) {
    this.fileProblems = problems;
    const sorted = [...topics].sort((a, b) => this.compare(a, b));
    this.topics = sorted;
    for (const topic of sorted) this.byId.set(topic.id, topic);
    for (const topic of sorted) {
      const ast = transformBlocks(parseMarkdown(topic.body), (nodes) =>
        resolveSelf(nodes, topic.id),
      );
      this.raw.set(topic.id, ast);
      const plain = blocksText(ast);
      this.records.set(topic.id, {
        titleL: topic.title.toLowerCase(),
        keywordsL: topic.keywords.map((k) => k.toLowerCase()),
        summaryL: topic.summary.toLowerCase(),
        body: plain,
        bodyL: plain.toLowerCase(),
      });
    }
  }

  /** Builds an index from raw files, keyed by path. A file that cannot be read becomes a problem. */
  static fromFiles(files: Readonly<Record<string, string>>): DocsIndex {
    const topics: Topic[] = [];
    const problems: Problem[] = [];
    const firstPath = new Map<string, string>();
    for (const path of Object.keys(files).sort()) {
      let topic: Topic;
      try {
        topic = parseTopicFile(path, files[path]!);
      } catch (error) {
        const message =
          error instanceof DocsFileError
            ? error.message
            : `${path}: ${String(error)}`;
        problems.push({ kind: 'parse', topic: null, path, message });
        continue;
      }
      const earlier = firstPath.get(topic.id);
      if (earlier !== undefined) {
        problems.push({
          kind: 'duplicate-id',
          topic: topic.id,
          path,
          message: `${path}: the id "${topic.id}" is already used by ${earlier}`,
        });
        continue;
      }
      firstPath.set(topic.id, path);
      topics.push(topic);
    }
    return new DocsIndex(topics, problems);
  }

  private compare(a: Topic, b: Topic): number {
    const rank = (t: Topic) => this.categoryRank.get(t.category) ?? 999;
    return (
      rank(a) - rank(b) ||
      a.order - b.order ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
    );
  }

  get(id: string): Topic | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** All categories in display order, including empty ones. */
  categories(): CategoryGroup[] {
    return CATEGORIES.map((c) => ({
      id: c.id,
      title: c.title,
      topics: this.byCategory(c.id),
    }));
  }

  /** Sorted by order, then title. */
  byCategory(category: string): Topic[] {
    return this.topics.filter((t) => t.category === category);
  }

  /** The first topic that lists the context. */
  topicForContext(context: string): Topic | undefined {
    return this.topics.find((t) => t.contexts.includes(context));
  }

  /**
   * The topic for a context, or for its parent when it has none: `build.classes` falls back to
   * `build`. Undefined means the caller shows the category overview.
   */
  resolveContext(context: string): Topic | undefined {
    let ctx = context;
    for (;;) {
      const found = this.topicForContext(ctx);
      if (found) return found;
      const dot = ctx.lastIndexOf('.');
      if (dot < 0) return undefined;
      ctx = ctx.slice(0, dot);
    }
  }

  /** The topic as the reader shows it: explicit links as written, plus keyword links. */
  document(id: string): Block[] {
    const cached = this.linkedCache.get(id);
    if (cached) return cached;
    const raw = this.raw.get(id);
    if (!raw) return [];
    const linked = this.linkKeywords(raw, id);
    this.linkedCache.set(id, linked);
    return linked;
  }

  /** The topic's headings and text before keyword linking. */
  rawDocument(id: string): Block[] {
    return this.raw.get(id) ?? [];
  }

  // Search ----------------------------------------------------------------------------------------

  search(query: string): SearchHit[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const whole = tokens.join(' ');
    const hits: SearchHit[] = [];
    for (const topic of this.topics) {
      const r = this.records.get(topic.id)!;
      let score = 0;
      let bodyToken: string | null = null;
      let ok = true;
      for (const token of tokens) {
        const s = scoreToken(r, token);
        if (s === 0) {
          ok = false;
          break;
        }
        score += s;
        if (s === 5 && bodyToken === null) bodyToken = token;
      }
      if (!ok) continue;
      if (r.titleL === whole) score += 40;
      else if (r.titleL.startsWith(whole)) score += 20;
      hits.push({
        topic,
        score,
        snippet: snippet(r, topic, bodyToken),
      });
    }
    return hits.sort((a, b) => b.score - a.score || this.compare(a.topic, b.topic));
  }

  // Links -----------------------------------------------------------------------------------------

  /** Topics that link to this one, explicitly or through a keyword. */
  backlinks(id: string): Topic[] {
    if (!this.backlinkMap) {
      const map = new Map<string, string[]>();
      for (const topic of this.topics) {
        for (const target of this.outgoing(topic.id)) {
          const list = map.get(target) ?? [];
          list.push(topic.id);
          map.set(target, list);
        }
      }
      this.backlinkMap = map;
    }
    return (this.backlinkMap.get(id) ?? [])
      .map((t) => this.byId.get(t))
      .filter((t): t is Topic => t !== undefined);
  }

  /** Ids of the topics this one links to, in reading order, without itself. */
  outgoing(id: string): string[] {
    const ids: string[] = [];
    eachInline(this.document(id), (node) => {
      if (
        node.type === 'topic' &&
        node.id !== id &&
        this.byId.has(node.id) &&
        !ids.includes(node.id)
      )
        ids.push(node.id);
    });
    return ids;
  }

  /** Links out first, then topics linking here; no duplicates. */
  related(id: string): Topic[] {
    const ids = [...this.outgoing(id), ...this.backlinks(id).map((t) => t.id)];
    return [...new Set(ids)]
      .map((t) => this.byId.get(t))
      .filter((t): t is Topic => t !== undefined && t.id !== id);
  }

  private buildTerms(): Map<string, string[]> {
    if (this.termOwners) return this.termOwners;
    const owners = new Map<string, string[]>();
    for (const topic of this.topics) {
      const own = new Set<string>();
      for (const term of [topic.title, ...topic.keywords]) {
        const t = term.trim().toLowerCase().replace(/\s+/g, ' ');
        if (t.length >= 2) own.add(t);
      }
      for (const t of own) {
        const list = owners.get(t) ?? [];
        list.push(topic.id);
        owners.set(t, list);
      }
    }
    this.termOwners = owners;
    this.termOrder = [...owners.keys()].sort(
      (a, b) => b.length - a.length || a.localeCompare(b),
    );
    return owners;
  }

  /**
   * Turns the first mention of each other topic's title or keywords into a topic link. Text in
   * code, headings, existing links and bold text inside callouts is left alone, and so is a
   * topic that the text already links to with [[...]]. Longest terms win ("abstract class"
   * before "class").
   */
  linkKeywords(ast: readonly Block[], currentId: string): Block[] {
    const owners = this.buildTerms();
    const terms = this.termOrder.filter((t) => {
      const list = owners.get(t)!;
      return !list.includes(currentId);
    });
    if (terms.length === 0) return [...ast];
    const regex = new RegExp(
      `(?<![\\p{L}\\p{N}_])(${terms
        .map((t) => escapeRegExp(t).replace(/ /g, '\\s+'))
        .join('|')})(?![\\p{L}\\p{N}_])`,
      'giu',
    );

    const seen = new Set<string>([currentId]);
    eachInline(ast, (node) => {
      if (node.type === 'topic') seen.add(node.id);
    });

    const splitText = (text: string): Inline[] => {
      const out: Inline[] = [];
      let last = 0;
      regex.lastIndex = 0;
      for (let m = regex.exec(text); m; m = regex.exec(text)) {
        const key = m[1]!.toLowerCase().replace(/\s+/g, ' ');
        const target = owners.get(key)![0]!;
        if (seen.has(target)) continue;
        seen.add(target);
        if (m.index > last)
          out.push({ type: 'text', text: text.slice(last, m.index) });
        out.push({
          type: 'topic',
          id: target,
          anchor: null,
          label: m[1]!,
          auto: true,
        });
        last = m.index + m[0].length;
      }
      if (last === 0) return [{ type: 'text', text }];
      if (last < text.length)
        out.push({ type: 'text', text: text.slice(last) });
      return out;
    };

    const link = (nodes: Inline[], site: InlineSite): Inline[] => {
      if (site.heading) return nodes;
      const out: Inline[] = [];
      for (const node of nodes) {
        if (node.type === 'text') out.push(...splitText(node.text));
        else if (node.type === 'em') out.push({ ...node, children: link(node.children, site) });
        else if (node.type === 'strong')
          out.push(
            site.callout
              ? node
              : { ...node, children: link(node.children, site) },
          );
        else out.push(node);
      }
      return out;
    };
    return transformBlocks(ast, link);
  }

  // Checks ----------------------------------------------------------------------------------------

  /** Known contexts that no topic lists. */
  missingContexts(): string[] {
    return DOC_CONTEXTS.filter((c) => !this.topicForContext(c));
  }

  problems(options: ProblemOptions = {}): Problem[] {
    const problems: Problem[] = [...this.fileProblems];
    const add = (kind: ProblemKind, topic: Topic, message: string) =>
      problems.push({
        kind,
        topic: topic.id,
        path: topic.path,
        message: `${topic.path}: ${message}`,
      });

    for (const topic of this.topics) {
      if (!isCategoryId(topic.category)) {
        add(
          'unknown-category',
          topic,
          topic.category === ''
            ? 'the category is missing'
            : `unknown category "${topic.category}"`,
        );
      }
      if (topic.summary.trim() === '') {
        add('missing-summary', topic, 'the summary is missing');
      }
      // Only the file name is checked: the folder is for authors, the category decides the tree.
      const m = /(?:^|\/)([^/]+)\.md$/.exec(topic.path);
      if (m && m[1] !== topic.id)
        add(
          'path-mismatch',
          topic,
          `the file name "${m[1]}.md" must match the id "${topic.id}"`,
        );
      for (const context of topic.contexts) {
        if (!isDocContext(context))
          add(
            'unknown-context',
            topic,
            `unknown context "${context}" (known contexts are in packages/docs/src/contexts.ts)`,
          );
      }
      eachInline(this.rawDocument(topic.id), (node) => {
        if (node.type !== 'topic') return;
        const target = this.byId.get(node.id);
        if (!target) {
          add('broken-link', topic, `[[${node.id}]] points at no topic`);
        } else if (
          node.anchor !== null &&
          !headingIds(this.rawDocument(target.id)).has(node.anchor)
        ) {
          add(
            'broken-anchor',
            topic,
            `[[${node.id}#${node.anchor}]]: "${target.title}" has no such heading`,
          );
        }
      });
    }

    // The same word for two topics makes automatic links ambiguous.
    const claimed = new Map<string, { topic: Topic; what: string }>();
    for (const topic of this.topics) {
      const mine = new Set<string>();
      for (const [term, what] of [
        [topic.title, 'title'],
        ...topic.keywords.map((k) => [k, 'keyword'] as const),
      ] as const) {
        const t = term.trim().toLowerCase().replace(/\s+/g, ' ');
        if (t.length < 2 || mine.has(t)) continue;
        mine.add(t);
        const other = claimed.get(t);
        // A title next to another topic's title is fine only when the ids differ, which they do.
        if (other && other.topic.id !== topic.id) {
          add(
            'keyword-conflict',
            topic,
            `the ${what} "${term}" is also the ${other.what} of "${other.topic.id}"; make it unique so links are clear`,
          );
        } else claimed.set(t, { topic, what });
      }
    }

    if (options.strictContexts) {
      for (const context of this.missingContexts()) {
        problems.push({
          kind: 'missing-context',
          topic: null,
          path: '',
          message: `no topic lists the context "${context}"`,
        });
      }
    }
    return problems;
  }
}

function resolveSelf(nodes: Inline[], topicId: string): Inline[] {
  return nodes.map((node): Inline => {
    if (node.type === 'topic' && node.id === '') return { ...node, id: topicId };
    if (node.type === 'strong' || node.type === 'em' || node.type === 'link')
      return { ...node, children: resolveSelf(node.children, topicId) };
    return node;
  });
}

function scoreToken(r: SearchRecord, token: string): number {
  let best = 0;
  if (r.titleL === token) best = 100;
  else if (r.titleL.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(token)))
    best = 80;
  else if (r.titleL.includes(token)) best = 60;
  for (const k of r.keywordsL) {
    if (k === token) best = Math.max(best, 55);
    else if (k.startsWith(token)) best = Math.max(best, 40);
    else if (k.includes(token)) best = Math.max(best, 30);
  }
  if (r.summaryL.includes(token)) best = Math.max(best, 15);
  if (best === 0 && r.bodyL.includes(token)) best = 5;
  return best;
}

function snippet(r: SearchRecord, topic: Topic, bodyToken: string | null): string {
  if (bodyToken !== null) {
    const at = r.bodyL.indexOf(bodyToken);
    if (at >= 0) {
      const from = Math.max(0, at - 40);
      const to = Math.min(r.body.length, at + bodyToken.length + 100);
      const text = r.body.slice(from, to).replace(/\s+/g, ' ').trim();
      return `${from > 0 ? '… ' : ''}${text}${to < r.body.length ? ' …' : ''}`;
    }
  }
  return topic.summary;
}
