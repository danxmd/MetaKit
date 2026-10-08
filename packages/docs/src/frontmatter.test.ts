import { describe, expect, it } from 'vitest';
import { DocsFileError, parseTopicFile } from './frontmatter';

const file = (front: string, body = 'Body text.') =>
  `---\n${front}\n---\n\n${body}\n`;

describe('front matter', () => {
  it('reads every key', () => {
    const topic = parseTopicFile(
      'content/build/classes.md',
      file(
        [
          'id: classes',
          'title: Classes',
          'category: build',
          'summary: One kind of object.',
          'keywords: [class, "abstract class", \'a, b\']',
          'contexts: [build.classes, build]',
          'order: 10',
        ].join('\n'),
        '## Heading\n\nText.',
      ),
    );
    expect(topic).toEqual({
      id: 'classes',
      title: 'Classes',
      category: 'build',
      summary: 'One kind of object.',
      keywords: ['class', 'abstract class', 'a, b'],
      contexts: ['build.classes', 'build'],
      order: 10,
      body: '## Heading\n\nText.\n',
      path: 'content/build/classes.md',
    });
  });

  it('reads dash lists and Windows line ends', () => {
    const topic = parseTopicFile(
      'x.md',
      '---\r\nid: a\r\ntitle: A\r\nkeywords:\r\n  - one\r\n  - two\r\n---\r\ntext',
    );
    expect(topic.keywords).toEqual(['one', 'two']);
    expect(topic.body).toBe('text');
  });

  it('allows empty lists and a missing order and summary', () => {
    const topic = parseTopicFile('x.md', file('id: a\ntitle: A\nkeywords: []'));
    expect(topic.keywords).toEqual([]);
    expect(topic.contexts).toEqual([]);
    expect(topic.order).toBe(1000);
    expect(topic.summary).toBe('');
  });

  it.each([
    ['no front matter', 'just text', 'must start with'],
    ['unclosed', '---\nid: a\ntitle: A\n', 'closing'],
    ['no id', file('title: A'), 'needs an "id"'],
    ['no title', file('id: a'), 'needs a "title"'],
    ['bad id', file('id: Not Valid\ntitle: A'), 'lower case'],
    ['unknown key', file('id: a\ntitle: A\nkeyword: [x]'), 'unknown front matter key "keyword"'],
    ['duplicate key', file('id: a\nid: b\ntitle: A'), 'twice'],
    ['bad line', file('id: a\ntitle: A\nwhat'), 'not "key: value"'],
    ['open list', file('id: a\ntitle: A\nkeywords: [x, y'), 'closing "]"'],
    ['bad order', file('id: a\ntitle: A\norder: soon'), 'must be a number'],
  ])('reports %s with the file path', (_name, source, message) => {
    let error: unknown;
    try {
      parseTopicFile('content/x/y.md', source);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DocsFileError);
    expect((error as Error).message).toContain('content/x/y.md');
    expect((error as Error).message).toContain(message);
  });
});
