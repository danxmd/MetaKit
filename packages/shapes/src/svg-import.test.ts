import type { Part } from '@metakit-app/core';
import { describe, expect, it } from 'vitest';
import { fromBase64 } from './base64';
import { importSvg } from './svg-import';
import { parseXml, serializeXml } from './xml';

const svg = (body: string, attrs = 'viewBox="0 0 100 50"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

const parts = (body: string, attrs?: string): Part[] =>
  importSvg(svg(body, attrs), 'parts').parts;

describe('xml reader', () => {
  it('reads elements, attributes, entities, comments and CDATA', () => {
    const root = parseXml(
      `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "boom">]><!-- c --><a b="1 &amp; 2" c='&#65;'><b/>t &lt; <![CDATA[<raw>]]></a>`,
    );
    expect(root.attrs).toEqual({ b: '1 & 2', c: 'A' });
    expect(root.children).toHaveLength(3);
    expect(serializeXml(root)).toBe(
      '<a b="1 &amp; 2" c="A"><b/>t &lt; &lt;raw&gt;</a>',
    );
  });

  it('never expands entities the file defines', () => {
    const root = parseXml('<!DOCTYPE a [<!ENTITY x "boom">]><a t="&x;"/>');
    expect(root.attrs['t']).toBe('&x;');
  });

  it.each(['<a>', '<a></b>', '<a b=1/>', 'text', '', '<a/><b/>', '<a b="1/>'])(
    'rejects %j',
    (text) => {
      expect(() => parseXml(text)).toThrow();
    },
  );
});

describe('importSvg as parts', () => {
  it('converts a rect with rounded corners, fill, stroke and opacity', () => {
    const [p] = parts(
      '<rect x="10" y="5" width="40" height="20" rx="4" fill="#ff0000" stroke="blue" stroke-width="2" opacity="0.5"/>',
    );
    expect(p).toEqual({
      type: 'rect',
      x: 10,
      y: 5,
      width: 40,
      height: 20,
      radius: 4,
      fill: '#ff0000',
      stroke: 'blue',
      strokeWidth: 2,
      opacity: 0.5,
    });
  });

  it('takes the size from the viewBox and draws black by default', () => {
    const r = importSvg(svg('<rect width="10" height="10"/>'), 'parts');
    expect(r.size).toEqual({ width: 100, height: 50 });
    expect(r.parts[0]).toMatchObject({ fill: '#000000' });
    expect(r.parts[0]).not.toHaveProperty('stroke');
    expect(r.skipped).toEqual([]);
  });

  it('scales the viewBox to width and height when both are given', () => {
    const r = importSvg(
      svg(
        '<rect x="10" y="10" width="20" height="10"/>',
        'viewBox="0 0 100 50" width="200" height="100"',
      ),
      'parts',
    );
    expect(r.size).toEqual({ width: 200, height: 100 });
    expect(r.parts[0]).toMatchObject({ x: 20, y: 20, width: 40, height: 20 });
  });

  it('moves the origin of a viewBox that does not start at zero', () => {
    const r = importSvg(
      svg(
        '<rect x="10" y="20" width="5" height="5"/>',
        'viewBox="10 20 50 50"',
      ),
      'parts',
    );
    expect(r.parts[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('reads percentages against the viewBox', () => {
    const [p] = parts('<rect x="10%" y="50%" width="50%" height="20%"/>');
    expect(p).toMatchObject({ x: 10, y: 25, width: 50, height: 10 });
  });

  it('converts circle and ellipse', () => {
    const [c, e] = parts(
      '<circle cx="20" cy="20" r="10" fill="none" stroke="#000"/><ellipse cx="60" cy="25" rx="20" ry="10"/>',
    );
    expect(c).toMatchObject({
      type: 'ellipse',
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    expect(c).not.toHaveProperty('fill');
    expect(e).toMatchObject({
      type: 'ellipse',
      x: 40,
      y: 15,
      width: 40,
      height: 20,
    });
  });

  it('converts a line to a two point polygon without fill', () => {
    const [l] = parts('<line x1="10" y1="10" x2="40" y2="30" stroke="#333"/>');
    expect(l).toMatchObject({
      type: 'polygon',
      x: 10,
      y: 10,
      width: 30,
      height: 20,
      points: [
        [0, 0],
        [30, 20],
      ],
      stroke: '#333',
    });
    expect(l).not.toHaveProperty('fill');
  });

  it('converts a polygon with points relative to its box', () => {
    const [p] = parts('<polygon points="10,10 30,10 20,30" fill="#0f0"/>');
    expect(p).toMatchObject({
      type: 'polygon',
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      points: [
        [0, 0],
        [20, 0],
        [10, 20],
      ],
      fill: '#0f0',
    });
  });

  it('converts a polyline to an open path', () => {
    const [p] = parts(
      '<polyline points="0,0 10,10 20,0" fill="none" stroke="#000"/>',
    );
    expect(p).toMatchObject({
      type: 'path',
      d: 'M 0 0 L 10 10 L 20 0',
      viewBox: [0, 0, 100, 50],
    });
  });

  it('keeps a path with its data and the drawing viewBox', () => {
    const [p] = parts('<path d="M0 0 L10 10 Z" fill="#123456"/>');
    expect(p).toMatchObject({
      type: 'path',
      d: 'M0 0 L10 10 Z',
      viewBox: [0, 0, 100, 50],
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fill: '#123456',
    });
  });

  it('converts the first line of a text', () => {
    const [t] = parts(
      '<text x="50" y="30" font-size="10" text-anchor="middle" font-weight="bold" fill="#222">Hello <tspan>world</tspan>\n second</text>',
    );
    expect(t).toMatchObject({
      type: 'text',
      text: 'Hello world',
      align: 'center',
      wrap: false,
      height: 12.5,
      font: { size: 10, weight: 'bold', color: '#222' },
    });
    // The box is centred on x and starts one em above the baseline.
    const box = t as { x: number; y: number; width: number };
    expect(box.x + box.width / 2).toBeCloseTo(50);
    expect(box.y).toBe(20);
  });

  it('skips empty texts quietly', () => {
    const r = importSvg(svg('<text x="1" y="1">  </text>'), 'parts');
    expect(r.parts).toEqual([]);
  });

  it('reads the style attribute over attributes', () => {
    const [p] = parts(
      '<rect width="5" height="5" fill="red" style="fill:#00ff00; stroke: #111; stroke-width:3"/>',
    );
    expect(p).toMatchObject({
      fill: '#00ff00',
      stroke: '#111',
      strokeWidth: 3,
    });
  });

  it('keeps groups and lets children inherit style', () => {
    const [g] = parts(
      '<g fill="#abcdef" stroke="#000" opacity="0.5"><rect width="5" height="5"/><circle r="2" fill="none"/></g>',
    );
    expect(g).toMatchObject({ type: 'group', width: '100%' });
    const kids = (g as { parts: Part[] }).parts;
    expect(kids[0]).toMatchObject({
      fill: '#abcdef',
      stroke: '#000',
      opacity: 0.5,
    });
    expect(kids[1]).not.toHaveProperty('fill');
  });

  it('hides elements with display none', () => {
    expect(
      parts('<rect width="5" height="5" display="none"/>')[0],
    ).toMatchObject({
      visible: false,
    });
  });

  it('skips empty groups', () => {
    expect(parts('<g><title>x</title></g>')).toEqual([]);
  });
});

describe('transforms', () => {
  it('bakes translate and scale into the numbers', () => {
    const [p] = parts(
      '<rect x="1" y="1" width="10" height="5" stroke="#000" stroke-width="2" transform="translate(10 20) scale(2)"/>',
    );
    expect(p).toMatchObject({
      x: 12,
      y: 22,
      width: 20,
      height: 10,
      strokeWidth: 4,
    });
    expect(p).not.toHaveProperty('transform');
  });

  it('bakes the transform of a group into its children', () => {
    const [g] = parts(
      '<g transform="translate(5,5)"><rect width="10" height="10"/></g>',
    );
    expect((g as { parts: Part[] }).parts[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('turns a part with rotate about its own centre', () => {
    const [p] = parts(
      '<rect x="10" y="10" width="20" height="10" transform="rotate(90 20 15)"/>',
    );
    expect(p).toMatchObject({
      x: 10,
      y: 10,
      width: 20,
      height: 10,
      transform: { rotate: 90 },
    });
  });

  it('moves the centre when the turn is about the origin', () => {
    const [p] = parts(
      '<rect x="10" y="0" width="10" height="10" transform="rotate(90)"/>',
    );
    const r = p as { x: number; y: number; transform: { rotate: number } };
    // The centre (15, 5) turns to (-5, 15).
    expect(r.x + 5).toBeCloseTo(-5);
    expect(r.y + 5).toBeCloseTo(15);
    expect(r.transform.rotate).toBe(90);
  });

  it('applies the whole matrix to polygon points', () => {
    const [p] = parts(
      '<polygon points="0,0 10,0 10,10" transform="rotate(90)"/>',
    );
    expect(p).toMatchObject({
      type: 'polygon',
      x: -10,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it('refuses a skew on a rect and says so', () => {
    const r = importSvg(
      svg('<rect width="5" height="5" transform="skewX(30)"/>'),
      'parts',
    );
    expect(r.parts).toEqual([]);
    expect(r.skipped[0]).toMatch(/skew/);
  });

  it('refuses an unreadable transform', () => {
    const r = importSvg(
      svg('<rect width="5" height="5" transform="wobble(3)"/>'),
      'parts',
    );
    expect(r.parts).toEqual([]);
    expect(r.skipped[0]).toMatch(/transform/);
  });
});

describe('what is not imported', () => {
  it('names unsupported elements, gradients and filters', () => {
    const r = importSvg(
      svg(
        '<defs><linearGradient id="g"/><filter id="f"/></defs>' +
          '<rect width="5" height="5" fill="url(#g)"/><use href="#x"/><foreignObject/>',
      ),
      'parts',
    );
    expect(r.parts).toHaveLength(1);
    expect(r.parts[0]).not.toHaveProperty('fill');
    const all = r.skipped.join('\n');
    expect(all).toMatch(/linearGradient/);
    expect(all).toMatch(/filter/);
    expect(all).toMatch(/gradient or pattern fill/);
    expect(all).toMatch(/<use>/);
    expect(all).toMatch(/foreignObject/);
  });

  it('never imports a script and lists it', () => {
    const r = importSvg(
      svg(
        '<script>alert(1)</script><rect width="5" height="5" onclick="evil()"/>',
      ),
      'parts',
    );
    expect(r.parts).toHaveLength(1);
    expect(JSON.stringify(r.parts)).not.toMatch(/alert|evil/);
    expect(r.skipped.join('\n')).toMatch(/script/);
    expect(r.skipped.join('\n')).toMatch(/onclick/);
  });

  it('ignores external references', () => {
    const r = importSvg(
      svg(
        '<image href="https://example.com/a.png" width="5" height="5"/><a href="javascript:alert(1)"><rect width="5" height="5"/></a>',
      ),
      'parts',
    );
    expect(r.parts).toHaveLength(1);
    expect(r.parts[0]).toMatchObject({ type: 'group' });
    expect(r.skipped.join('\n')).toMatch(/external reference/);
  });

  it('keeps an embedded data image', () => {
    const [p] = parts(
      '<image href="data:image/png;base64,AAAA" x="1" y="2" width="5" height="5"/>',
    );
    expect(p).toMatchObject({
      type: 'image',
      src: 'data:image/png;base64,AAAA',
      x: 1,
      y: 2,
    });
  });

  it('gives no parts and a message for malformed files', () => {
    for (const bad of ['<svg><rect></svg>', 'not xml', '<html/>', '']) {
      const r = importSvg(bad, 'parts');
      expect(r.parts).toEqual([]);
      expect(r.skipped).toHaveLength(1);
      expect(r.skipped[0]).toMatch(/SVG/);
    }
    expect(importSvg('<svg><rect></svg>', 'image').parts).toEqual([]);
  });
});

describe('importSvg as an image', () => {
  const decode = (src: string) =>
    fromBase64(src.replace(/^data:image\/svg\+xml;base64,/, ''));

  it('wraps the file as one image part', () => {
    const r = importSvg(
      svg('<rect width="5" height="5" fill="#f00"/>', 'viewBox="0 0 40 20"'),
      'image',
    );
    expect(r.size).toEqual({ width: 40, height: 20 });
    expect(r.skipped).toEqual([]);
    expect(r.parts).toHaveLength(1);
    const p = r.parts[0] as {
      type: string;
      src: string;
      width: string;
      height: string;
    };
    expect(p).toMatchObject({ type: 'image', width: '100%', height: '100%' });
    expect(p.src.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(decode(p.src)).toContain('<rect width="5" height="5" fill="#f00"/>');
  });

  it('adds the namespace when the file lacks it', () => {
    const r = importSvg(
      '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>',
      'image',
    );
    expect(decode((r.parts[0] as { src: string }).src)).toContain(
      'xmlns="http://www.w3.org/2000/svg"',
    );
  });

  it('removes scripts, handlers and external references but still produces the image', () => {
    const r = importSvg(
      svg(
        '<script>alert("x")</script><rect width="5" height="5" onload="evil()" fill="url(http://evil/x)"/>' +
          '<image href="http://evil/a.png"/><use href="#ok"/><foreignObject><div>hi</div></foreignObject>',
      ),
      'image',
    );
    expect(r.parts).toHaveLength(1);
    const xml = decode((r.parts[0] as { src: string }).src);
    expect(xml).not.toMatch(
      /script|alert|onload|evil|foreignObject|http:\/\/evil/,
    );
    expect(xml).toContain('href="#ok"');
    const all = r.skipped.join('\n');
    expect(all).toMatch(/script/);
    expect(all).toMatch(/event handler/);
    expect(all).toMatch(/external reference/);
  });

  it('keeps non-ASCII text intact', () => {
    const r = importSvg(svg('<text x="1" y="9">Größe €</text>'), 'image');
    expect(decode((r.parts[0] as { src: string }).src)).toContain('Größe €');
  });
});
