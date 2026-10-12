import { describe, expect, it } from 'vitest';
import { docsFromFiles } from './content';
import type { Block, Inline } from './markdown';

function topic(
  id: string,
  extra: {
    title?: string;
    category?: string;
    summary?: string;
    keywords?: string[];
    contexts?: string[];
    order?: number;
    body?: string;
  } = {},
): [string, string] {
  const e = {
    title: id,
    category: 'build',
    summary: `About ${id}.`,
    keywords: [] as string[],
    contexts: [] as string[],
    order: 10,
    body: 'Text.',
    ...extra,
  };
  return [
    `content/${e.category}/${id}.md`,
    `---\nid: ${id}\ntitle: ${e.title}\ncategory: ${e.category}\nsummary: ${e.summary}\nkeywords: [${e.keywords.join(', ')}]\ncontexts: [${e.contexts.join(', ')}]\norder: ${e.order}\n---\n\n${e.body}\n`,
  ];
}

const build = (...topics: [string, string][]) =>
  docsFromFiles(Object.fromEntries(topics));

/** The topic ids and the plain text of an inline list, to compare in tests. */
function shape(nodes: readonly Inline[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text;
      if (n.type === 'topic') return `{${n.id}:${n.label ?? ''}${n.auto ? ':auto' : ''}}`;
      if (n.type === 'code') return `\`${n.text}\``;
      return shape(n.children);
    })
    .join('');
}

function paragraphs(blocks: readonly Block[]): string[] {
  return blocks.flatMap((b) =>
    b.type === 'paragraph'
      ? [shape(b.children)]
      : b.type === 'heading'
        ? [`# ${shape(b.children)}`]
        : b.type === 'callout' || b.type === 'quote'
          ? paragraphs(b.children)
          : b.type === 'list'
            ? b.items.map((i) => shape(i.content))
            : b.type === 'table'
              ? b.rows.flatMap((r) => r.map(shape))
              : [],
  );
}

describe('organising', () => {
  const index = build(
    topic('b-two', { title: 'Beta', order: 20 }),
    topic('b-one', { title: 'Zeta', order: 10 }),
    topic('b-three', { title: 'Alpha', order: 20 }),
    topic('s-one', { category: 'start', order: 5 }),
  );

  it('sorts a category by order, then title', () => {
    expect(index.byCategory('build').map((t) => t.id)).toEqual([
      'b-one',
      'b-three',
      'b-two',
    ]);
  });

  it('lists categories in display order, empty ones too', () => {
    const groups = index.categories();
    expect(groups.map((g) => g.id)).toEqual([
      'start',
      'pages',
      'model',
      'build',
      'behaviour',
      'teamwork',
      'assistant',
      'kits',
      'reference',
      'tutorials',
    ]);
    expect(groups[0]!.title).toBe('Getting started');
    expect(groups[1]!.topics).toEqual([]);
  });

  it('finds topics by id', () => {
    expect(index.get('b-one')?.title).toBe('Zeta');
    expect(index.get('nope')).toBeUndefined();
  });

  it('gives the first topic that lists a context, and falls back to the parent', () => {
    const idx = build(
      topic('second', { order: 20, contexts: ['build.classes'] }),
      topic('first', { order: 10, contexts: ['build.classes'] }),
      topic('overview', { contexts: ['build'] }),
    );
    expect(idx.topicForContext('build.classes')?.id).toBe('first');
    expect(idx.topicForContext('build.rules')).toBeUndefined();
    expect(idx.resolveContext('build.rules')?.id).toBe('overview');
    expect(idx.resolveContext('models')).toBeUndefined();
  });
});

describe('search', () => {
  const index = build(
    topic('classes', {
      title: 'Classes',
      summary: 'Kinds of objects.',
      keywords: ['class', 'object type'],
      body: 'A class has attributes and a shape.',
    }),
    topic('shapes', {
      title: 'Shapes',
      summary: 'How a class looks.',
      keywords: ['shape', 'drawing'],
      body: 'Draw with layers. A palette entry shows the shape.',
    }),
    topic('palette', {
      title: 'Palette',
      summary: 'Pick what to place.',
      keywords: ['toolbox'],
      body: 'The palette lists classes and shows shapes and more shapes.',
    }),
  );

  it('ranks title above keyword above summary above body', () => {
    const ids = index.search('class').map((h) => h.topic.id);
    // classes: title word, shapes: summary only, palette: body only
    expect(ids).toEqual(['classes', 'shapes', 'palette']);
    const byKeyword = build(
      topic('x-title', { title: 'Layers' }),
      topic('x-keyword', { keywords: ['layers'] }),
      topic('x-summary', { summary: 'About layers.' }),
      topic('x-body', { body: 'Layers matter.' }),
    ).search('layers');
    expect(byKeyword.map((h) => h.topic.id)).toEqual([
      'x-title',
      'x-keyword',
      'x-summary',
      'x-body',
    ]);
  });

  it('is case-insensitive and needs every word', () => {
    expect(index.search('CLASSES').map((h) => h.topic.id)[0]).toBe('classes');
    expect(index.search('palette toolbox').map((h) => h.topic.id)).toEqual([
      'palette',
    ]);
    expect(index.search('palette zebra')).toEqual([]);
    expect(index.search('   ')).toEqual([]);
  });

  it('puts an exact title first', () => {
    expect(index.search('shapes')[0]!.topic.id).toBe('shapes');
  });

  it('gives a snippet around a body match, or the summary otherwise', () => {
    const body = index.search('layers')[0]!;
    expect(body.topic.id).toBe('shapes');
    expect(body.snippet).toContain('Draw with layers');
    const summary = index.search('looks')[0]!;
    expect(summary.snippet).toBe('How a class looks.');
  });
});

describe('keyword links', () => {
  const files = [
    topic('classes', {
      title: 'Classes',
      keywords: ['class', 'abstract class'],
    }),
    topic('shapes', { title: 'Shapes', keywords: ['shape'] }),
    topic('attributes', {
      title: 'Attributes',
      keywords: ['attribute'],
      body: [
        'Every attribute belongs to a class. A class can be an Abstract Class too.',
        '',
        'The class again, and a shape.',
        '',
        '## About the shape',
        '',
        'In heading: shape. Code: `class` and a [link to shape](https://example.com).',
        '',
        '```',
        'class',
        '```',
        '',
        '- list mentions attribute and a shape',
        '',
        '| a | b |',
        '| - | - |',
        '| table class | x |',
        '',
        '> **Tip** Callout with **shape** bold and a class.',
      ].join('\n'),
    }),
  ];
  const index = build(...files);

  it('links the first mention only, case-insensitive', () => {
    const text = paragraphs(index.document('attributes'));
    // "attribute" is the topic's own word: never linked to itself.
    expect(text[0]).toBe(
      'Every attribute belongs to a {classes:class:auto}. A class can be an Abstract Class too.',
    );
  });

  it('does not link in headings, code, existing links or fenced code', () => {
    const idx = build(
      topic('shapes', { keywords: ['shape'] }),
      topic('t', {
        body: [
          '## The shape',
          '',
          'Code `shape` and [a shape](https://example.com) and **bold shape**.',
          '',
          '```',
          'shape',
          '```',
          '',
          'Finally a shape.',
        ].join('\n'),
      }),
    );
    expect(paragraphs(idx.document('t'))).toEqual([
      '# The shape',
      'Code `shape` and a shape and bold {shapes:shape:auto}.',
      'Finally a shape.',
    ]);
  });

  it('links a topic once, so later mentions stay text', () => {
    const text = paragraphs(index.document('attributes'));
    expect(text[1]).toBe('The class again, and a {shapes:shape:auto}.');
    // shapes is already linked above, so the list and table stay plain.
    expect(text).toContain('list mentions attribute and a shape');
    expect(text).toContain('table class');
  });

  it('prefers the longest term', () => {
    const idx = build(...files.slice(0, 2), topic('t', { body: 'An abstract class here.' }));
    expect(paragraphs(idx.document('t'))[0]).toBe(
      'An {classes:abstract class:auto} here.',
    );
    const idx2 = build(
      topic('plain', { keywords: ['class'] }),
      topic('abstract', { keywords: ['abstract class'] }),
      topic('t', { body: 'An abstract class and a class.' }),
    );
    expect(paragraphs(idx2.document('t'))[0]).toBe(
      'An {abstract:abstract class:auto} and a {plain:class:auto}.',
    );
  });

  it('links in lists and tables when it has not linked the topic yet', () => {
    const idx = build(
      topic('classes', { keywords: ['class'] }),
      topic('t', { body: '- one class\n\n| a |\n| - |\n| b |' }),
      topic('u', { body: '| a |\n| - |\n| a class |' }),
    );
    expect(paragraphs(idx.document('t'))[0]).toBe('one {classes:class:auto}');
    expect(paragraphs(idx.document('u'))[0]).toBe('a {classes:class:auto}');
  });

  it('leaves bold text in callouts alone but links the rest', () => {
    const idx = build(
      topic('shapes', { keywords: ['shape'] }),
      topic('t', { body: '> **Tip** A **shape** and a shape.' }),
    );
    expect(paragraphs(idx.document('t'))[0]).toBe(
      'A shape and a {shapes:shape:auto}.',
    );
  });

  it('keeps explicit links as written and counts them as the first mention', () => {
    const idx = build(
      topic('classes', { keywords: ['class'] }),
      topic('t', { body: 'A class, see [[classes|the classes]] and a class.' }),
    );
    expect(paragraphs(idx.document('t'))[0]).toBe(
      'A class, see {classes:the classes} and a class.',
    );
  });

  it('only matches whole words', () => {
    const idx = build(
      topic('classes', { keywords: ['class'] }),
      topic('t', { body: 'Classroom and subclass and classy.' }),
    );
    expect(paragraphs(idx.document('t'))[0]).toBe(
      'Classroom and subclass and classy.',
    );
  });

  it('never links a topic to itself, also through a word it shares', () => {
    const idx = build(
      topic('classes', { keywords: ['class'], body: 'A class is a class. See [[#more]].\n\n## More\n\nx' }),
    );
    expect(idx.outgoing('classes')).toEqual([]);
    expect(paragraphs(idx.document('classes'))[0]).toBe(
      'A class is a class. See {classes:}.',
    );
  });

  it('provides backlinks and related topics', () => {
    const idx = build(
      topic('classes', { keywords: ['class'] }),
      topic('shapes', { keywords: ['shape'], body: 'Used by a class. See [[palette]].' }),
      topic('palette', { body: 'Nothing.' }),
    );
    expect(idx.backlinks('classes').map((t) => t.id)).toEqual(['shapes']);
    expect(idx.backlinks('palette').map((t) => t.id)).toEqual(['shapes']);
    expect(idx.backlinks('shapes')).toEqual([]);
    expect(idx.related('classes').map((t) => t.id)).toEqual(['shapes']);
    expect(idx.related('shapes').map((t) => t.id)).toEqual(['classes', 'palette']);
  });
});

describe('problems', () => {
  const kinds = (idx: ReturnType<typeof build>, strictContexts = false) =>
    idx.problems({ strictContexts }).map((p) => p.kind);

  it('is empty for a clean set', () => {
    const idx = build(
      topic('a', { contexts: ['build.classes'], body: 'See [[b#section]].' }),
      topic('b', { body: '## Section\n\nx' }),
    );
    expect(idx.problems()).toEqual([]);
  });

  it('finds broken links and anchors, also self anchors', () => {
    const idx = build(
      topic('a', { body: '[[nope]] [[b#missing]] [[#gone]] [[b#section]]' }),
      topic('b', { body: '## Section\n\nx' }),
    );
    const found = idx.problems();
    expect(found.map((p) => p.kind).sort()).toEqual([
      'broken-anchor',
      'broken-anchor',
      'broken-link',
    ]);
    expect(found.find((p) => p.kind === 'broken-link')!.message).toContain(
      'content/build/a.md',
    );
  });

  it('finds duplicate ids, keeping the first file', () => {
    const [, text] = topic('a');
    const idx = docsFromFiles({
      'content/build/a.md': text,
      'content/start/a.md': text,
    });
    expect(kinds(idx)).toEqual(['duplicate-id']);
    expect(idx.topics).toHaveLength(1);
  });

  it('finds unknown categories, missing summaries and wrong file names', () => {
    const [, bad] = topic('bad', { category: 'weird', summary: '' });
    const [, named] = topic('named');
    const idx = docsFromFiles({
      'content/weird/bad.md': bad,
      'content/build/other-name.md': named,
    });
    expect(kinds(idx).sort()).toEqual([
      'missing-summary',
      'path-mismatch',
      'unknown-category',
    ]);
  });

  it('reports unreadable files without stopping', () => {
    const idx = docsFromFiles({
      ...Object.fromEntries([topic('ok')]),
      'content/build/broken.md': 'no front matter',
    });
    const found = idx.problems();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'parse', path: 'content/build/broken.md' });
    expect(idx.get('ok')).toBeDefined();
  });

  it('finds a keyword used by two topics', () => {
    const idx = build(
      topic('a', { keywords: ['Layer', 'one'] }),
      topic('b', { keywords: ['layer'] }),
    );
    const found = idx.problems().filter((p) => p.kind === 'keyword-conflict');
    expect(found).toHaveLength(1);
    expect(found[0]!.topic).toBe('b');
    // The same keyword twice in one topic is not a conflict.
    expect(
      kinds(build(topic('c', { keywords: ['x1', 'X1'] }))).includes('keyword-conflict'),
    ).toBe(false);
  });

  it('finds a keyword that is another topic title', () => {
    const idx = build(
      topic('a', { title: 'Layers' }),
      topic('b', { keywords: ['layers'] }),
    );
    expect(kinds(idx)).toEqual(['keyword-conflict']);
  });

  it('finds unknown contexts', () => {
    expect(kinds(build(topic('a', { contexts: ['made.up'] })))).toEqual([
      'unknown-context',
    ]);
  });

  it('lists missing contexts apart, and reports them only when strict', () => {
    const idx = build(topic('a', { contexts: ['start'] }));
    expect(idx.missingContexts()).not.toContain('start');
    expect(idx.missingContexts()).toContain('models');
    expect(kinds(idx)).toEqual([]);
    expect(kinds(idx, true)).toContain('missing-context');
    expect(
      idx.problems({ strictContexts: true }).filter((p) => p.kind === 'missing-context'),
    ).toHaveLength(idx.missingContexts().length);
  });
});
