/**
 * A small XML reader for SVG files. It has no DOM (the shapes package runs in Node) and never
 * expands entities that a file defines itself, so a hostile file cannot blow up its size.
 */
export interface XmlElement {
  /** The name as written, for example `svg:rect`. */
  raw: string;
  /** The name without an `svg:` prefix. */
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export type XmlNode = XmlElement | string;

export class XmlError extends Error {}

const MAX_ELEMENTS = 50_000;
const MAX_DEPTH = 200;

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[A-Za-z]+);/g,
    (whole, ref: string) => {
      if (ref[0] === '#') {
        const code =
          ref[1] === 'x'
            ? parseInt(ref.slice(2), 16)
            : parseInt(ref.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : whole;
      }
      return NAMED[ref] ?? whole;
    },
  );
}

const isSpace = (c: string | undefined) =>
  c === ' ' || c === '\n' || c === '\t' || c === '\r';

/** Parses one XML document and returns its root element; throws `XmlError` when it is malformed. */
export function parseXml(source: string): XmlElement {
  let i = 0;
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  let count = 0;

  const fail = (message: string): never => {
    throw new XmlError(message);
  };
  const addText = (text: string) => {
    const top = stack[stack.length - 1];
    if (top) top.children.push(text);
    else if (text.trim() !== '')
      fail('There is text outside the main element.');
  };

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt < 0) {
      addText(decode(source.slice(i)));
      i = source.length;
      break;
    }
    if (lt > i) addText(decode(source.slice(i, lt)));
    i = lt;
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      if (end < 0) fail('A comment is not closed.');
      i = end + 3;
    } else if (source.startsWith('<![CDATA[', i)) {
      const end = source.indexOf(']]>', i);
      if (end < 0) fail('A CDATA section is not closed.');
      addText(source.slice(i + 9, end));
      i = end + 3;
    } else if (source.startsWith('<?', i)) {
      const end = source.indexOf('?>', i);
      if (end < 0) fail('A processing instruction is not closed.');
      i = end + 2;
    } else if (source.startsWith('<!', i)) {
      // A DOCTYPE; its entity definitions are never read.
      let depth = 0;
      let j = i + 2;
      for (; j < source.length; j++) {
        const c = source[j];
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) break;
      }
      if (j >= source.length) fail('A declaration is not closed.');
      i = j + 1;
    } else if (source.startsWith('</', i)) {
      const end = source.indexOf('>', i);
      if (end < 0) fail('A closing tag is not finished.');
      const name = source.slice(i + 2, end).trim();
      const top = stack.pop();
      if (!top || top.raw !== name)
        fail(`The closing tag </${name}> does not match an opening tag.`);
      i = end + 1;
    } else {
      i = readOpenTag();
    }
  }
  if (stack.length > 0) fail('An element is not closed.');
  if (!root) fail('The file has no elements.');
  return root as unknown as XmlElement;

  function readOpenTag(): number {
    let j = i + 1;
    const nameStart = j;
    while (
      j < source.length &&
      !isSpace(source[j]) &&
      source[j] !== '>' &&
      source[j] !== '/'
    )
      j++;
    const raw = source.slice(nameStart, j);
    if (!/^[A-Za-z_][\w.:-]*$/.test(raw)) fail('An element has no valid name.');
    const attrs: Record<string, string> = {};
    for (;;) {
      while (isSpace(source[j])) j++;
      const c = source[j];
      if (c === undefined) return fail('A tag is not finished.');
      if (c === '>' || c === '/') break;
      const a0 = j;
      while (
        j < source.length &&
        !isSpace(source[j]) &&
        source[j] !== '=' &&
        source[j] !== '>' &&
        source[j] !== '/'
      )
        j++;
      const attr = source.slice(a0, j);
      if (attr === '') fail('An attribute has no name.');
      while (isSpace(source[j])) j++;
      if (source[j] !== '=') fail(`The attribute ${attr} has no value.`);
      j++;
      while (isSpace(source[j])) j++;
      const q = source[j];
      if (q !== '"' && q !== "'") fail(`The value of ${attr} is not quoted.`);
      const close = source.indexOf(q!, j + 1);
      if (close < 0) fail(`The value of ${attr} is not closed.`);
      attrs[attr] = decode(source.slice(j + 1, close));
      j = close + 1;
    }
    let selfClosing = false;
    if (source[j] === '/') {
      selfClosing = true;
      j++;
    }
    if (source[j] !== '>') fail('A tag is not finished.');
    j++;
    if (++count > MAX_ELEMENTS) fail('The file has too many elements.');
    const element: XmlElement = {
      raw,
      name: raw.startsWith('svg:') ? raw.slice(4) : raw,
      attrs,
      children: [],
    };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(element);
    else if (root) fail('The file has more than one main element.');
    else root = element;
    if (!selfClosing) {
      if (stack.length >= MAX_DEPTH) fail('Elements are nested too deeply.');
      stack.push(element);
    }
    return j;
  }
}

const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Writes an element tree back as XML. */
export function serializeXml(node: XmlNode): string {
  if (typeof node === 'string') return escapeText(node);
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join('');
  if (node.children.length === 0) return `<${node.raw}${attrs}/>`;
  return `<${node.raw}${attrs}>${node.children.map(serializeXml).join('')}</${node.raw}>`;
}

/** The text inside an element, with tags removed. */
export function textOf(node: XmlNode): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('');
}
