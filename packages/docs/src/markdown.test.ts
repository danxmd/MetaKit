import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  blocksText,
  inlineText,
  parseInline,
  parseMarkdown,
  slugify,
  type Block,
} from './markdown';

const first = (src: string): Block => parseMarkdown(src)[0]!;

describe('inline', () => {
  it('reads bold, italic and code', () => {
    expect(parseInline('a **b** *c* _d_ `e`')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'strong', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'em', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'em', children: [{ type: 'text', text: 'd' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'e' },
    ]);
  });

  it('keeps markers inside code literal', () => {
    expect(parseInline('`**x** [[a]]`')).toEqual([
      { type: 'code', text: '**x** [[a]]' },
    ]);
  });

  it('does not treat snake_case or spaced stars as emphasis', () => {
    expect(inlineText(parseInline('my_var_name and 2 * 3 * 4'))).toBe(
      'my_var_name and 2 * 3 * 4',
    );
    expect(parseInline('my_var_name')).toEqual([
      { type: 'text', text: 'my_var_name' },
    ]);
  });

  it('reads external links and drops unsafe ones', () => {
    expect(parseInline('[site](https://example.com/a?b=1)')).toEqual([
      {
        type: 'link',
        href: 'https://example.com/a?b=1',
        children: [{ type: 'text', text: 'site' }],
      },
    ]);
    const unsafe = parseInline('[click](javascript:alert(1))');
    expect(unsafe.some((n) => n.type === 'link')).toBe(false);
    expect(inlineText(unsafe)).toContain('click');
  });

  it('reads topic links with label and anchor', () => {
    expect(parseInline('[[classes]]')).toEqual([
      { type: 'topic', id: 'classes', anchor: null, label: null, auto: false },
    ]);
    expect(parseInline('[[classes|the classes]]')[0]).toMatchObject({
      id: 'classes',
      label: 'the classes',
    });
    expect(parseInline('[[classes#abstract-classes|more]]')[0]).toMatchObject({
      id: 'classes',
      anchor: 'abstract-classes',
      label: 'more',
    });
    expect(parseInline('[[#own-heading]]')[0]).toMatchObject({
      id: '',
      anchor: 'own-heading',
    });
  });

  it('handles escapes and unmatched markers', () => {
    expect(inlineText(parseInline('\\*not bold\\* and **open'))).toBe(
      '*not bold* and **open',
    );
    expect(inlineText(parseInline('a [[ b c ]] d and ` tick'))).toBe(
      'a [[ b c ]] d and ` tick',
    );
  });

  it('nests emphasis in bold and links', () => {
    const [node] = parseInline('**a *b* c**');
    expect(node).toMatchObject({ type: 'strong' });
    expect(inlineText([node!])).toBe('a b c');
  });
});

describe('blocks', () => {
  it('reads headings with unique anchors', () => {
    const blocks = parseMarkdown('## Same\n\n### Same\n\n#### Other *one*');
    expect(blocks.map((b) => (b.type === 'heading' ? b.id : ''))).toEqual([
      'same',
      'same-2',
      'other-one',
    ]);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(blocks[2]).toMatchObject({ level: 4 });
  });

  it('treats # as level 2 and deeper levels as level 4', () => {
    expect(first('# Top')).toMatchObject({ type: 'heading', level: 2 });
    expect(first('###### Deep')).toMatchObject({ type: 'heading', level: 4 });
  });

  it('joins wrapped lines of a paragraph', () => {
    const block = first('one\ntwo\n   three\n\nnext');
    expect(block).toMatchObject({ type: 'paragraph' });
    expect(inlineText((block as Extract<Block, { type: "paragraph" }>).children)).toBe(
      'one two three',
    );
    expect(parseMarkdown('one\ntwo\n\nnext')).toHaveLength(2);
  });

  it('reads bullet and numbered lists', () => {
    const bullets = first('- a\n- b\n- c') as Extract<Block, { type: 'list' }>;
    expect(bullets.ordered).toBe(false);
    expect(bullets.items.map((i) => inlineText(i.content))).toEqual([
      'a',
      'b',
      'c',
    ]);
    const numbers = first('1. a\n2. b') as Extract<Block, { type: 'list' }>;
    expect(numbers.ordered).toBe(true);
    expect(numbers.items).toHaveLength(2);
  });

  it('reads one level of nested lists and wrapped items', () => {
    const list = first(
      '- a\n  wrapped\n  - a1\n  - a2\n- b\n  1. b1\n  2. b2',
    ) as Extract<Block, { type: 'list' }>;
    expect(list.items).toHaveLength(2);
    expect(inlineText(list.items[0]!.content)).toBe('a wrapped');
    expect(list.items[0]!.sub!.items.map((i) => inlineText(i.content))).toEqual(
      ['a1', 'a2'],
    );
    expect(list.items[1]!.sub!.ordered).toBe(true);
  });

  it('starts a new list when the kind changes', () => {
    const blocks = parseMarkdown('- a\n1. b');
    expect(blocks.map((b) => b.type)).toEqual(['list', 'list']);
  });

  it('keeps a list together over a blank line', () => {
    const list = first('- a\n\n- b') as Extract<Block, { type: 'list' }>;
    expect(list.items).toHaveLength(2);
  });

  it('reads tables with a header row', () => {
    const table = first(
      '| Name | Meaning |\n| --- | :-: |\n| `a|b` | one \\| two |\n| x |',
    ) as Extract<Block, { type: 'table' }>;
    expect(table.header.map(inlineText)).toEqual(['Name', 'Meaning']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]!.map(inlineText)).toEqual(['a|b', 'one | two']);
    // Short rows are padded so the UI never meets a hole.
    expect(table.rows[1]!.map(inlineText)).toEqual(['x', '']);
  });

  it('does not take a line with a pipe for a table without a separator', () => {
    expect(first('a | b\nc | d')).toMatchObject({ type: 'paragraph' });
  });

  it('reads fenced code and keeps its text', () => {
    const code = first('```ts\nconst a = 1;\n\n## not a heading\n```\nafter');
    expect(code).toEqual({
      type: 'code',
      lang: 'ts',
      text: 'const a = 1;\n\n## not a heading',
    });
    expect(parseMarkdown('```\nopen').at(0)).toMatchObject({ type: 'code' });
    expect(parseMarkdown('~~~\nx\n~~~')[0]).toMatchObject({ text: 'x' });
  });

  it('reads callouts and plain quotes', () => {
    for (const kind of ['Tip', 'Note', 'Warning'] as const) {
      const block = first(`> **${kind}** Be careful.\n> More.`);
      expect(block).toMatchObject({
        type: 'callout',
        kind: kind.toLowerCase(),
      });
      expect(blocksText([block])).toContain('Be careful. More.');
      expect(blocksText([block])).not.toContain(kind);
    }
    expect(first('> **Tip:** with colon')).toMatchObject({ type: 'callout' });
    expect(first('> just a quote')).toMatchObject({ type: 'quote' });
    const withList = first('> **Note**\n> - a\n> - b') as Extract<
      Block,
      { type: 'callout' }
    >;
    expect(withList.children.map((c) => c.type)).toEqual(['list']);
  });

  it('reads rules', () => {
    expect(parseMarkdown('a\n\n---\n\nb').map((b) => b.type)).toEqual([
      'paragraph',
      'rule',
      'paragraph',
    ]);
  });

  it('lets a list or heading interrupt a paragraph', () => {
    expect(parseMarkdown('text\n- item').map((b) => b.type)).toEqual([
      'paragraph',
      'list',
    ]);
    expect(parseMarkdown('text\n## Head').map((b) => b.type)).toEqual([
      'paragraph',
      'heading',
    ]);
  });

  it('slugs', () => {
    expect(slugify('Hello, World! (1)')).toBe('hello-world-1');
    expect(slugify('!!!')).toBe('section');
  });

  it('never throws, whatever the input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (text) => {
        parseMarkdown(text);
      }),
    );
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            '**',
            '*',
            '_',
            '`',
            '[[',
            ']]',
            '[',
            ']',
            '(',
            ')',
            '|',
            '>',
            '-',
            '1.',
            '#',
            '```',
            '\n',
            '  ',
            'a',
            ' ',
          ),
          { maxLength: 60 },
        ),
        (parts) => {
          parseMarkdown(parts.join(''));
        },
      ),
    );
  });

  it('never produces raw HTML nodes', () => {
    const blocks = parseMarkdown('<script>alert(1)</script> **x** <b>y</b>');
    const text = blocksText(blocks);
    expect(text).toContain('<script>');
    expect(JSON.stringify(blocks)).not.toContain('"html"');
  });
});
