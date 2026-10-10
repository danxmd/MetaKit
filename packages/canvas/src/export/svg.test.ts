import { describe, expect, it } from 'vitest';
import type {
  ConnectorId,
  ElementId,
  Model,
  NodeShape,
  RelationShape,
  Kit,
} from '@metakit-app/core';
import { Scene } from '../scene';
import { BPMN, bpmnStore } from '../testing';
import { exportSvg, escapeXml, polylineData } from './svg';

const taskShape: NodeShape = {
  id: 'shp_task' as never,
  kind: 'node',
  size: { width: 100, height: 50 },
  outline: 'rect',
  parts: [
    {
      type: 'rect',
      width: '100%',
      height: '100%',
      radius: 8,
      fill: {
        type: 'linear',
        angle: 90,
        stops: [
          { at: 0, color: '#ffffff' },
          { at: 1, color: '#aabbcc' },
        ],
      },
      stroke: '#123456',
      strokeWidth: 2,
      dash: [4, 2],
      shadow: { blur: 6, x: 1, y: 3, color: 'rgba(0,0,0,0.4)' },
    },
    {
      type: 'text',
      text: '= Name',
      align: 'center',
      valign: 'middle',
      width: '100%',
      height: '100%',
    },
  ],
};

const flowShape: RelationShape = {
  id: 'shp_flow' as never,
  kind: 'relation',
  line: {
    stroke: '#445566',
    strokeWidth: 2,
    dash: [6, 3],
    routing: 'orthogonal',
    corners: 6,
  },
  startMarker: { type: 'diamond', size: 8 },
  endMarker: { type: 'arrow', size: 10 },
  labels: [{ at: 'middle', text: 'go', background: '#ffffff' }],
};

function setup() {
  const base = bpmnStore();
  const kit: Kit = {
    ...base.kit,
    shapes: { ...base.kit.shapes, shp_task: taskShape, shp_flow: flowShape },
  };
  const store = base.store;
  const scene = new Scene(store.state as Model, kit);
  scene.attach(store);
  const create = (x: number, y: number, name: string) =>
    (
      store.execute({
        type: 'createElement',
        class: BPMN.task as never,
        x,
        y,
        w: 100,
        h: 50,
        attrs: { [BPMN.name]: name },
      }) as unknown as { value: ElementId }
    ).value;
  const connect = (from: ElementId, to: ElementId) =>
    (
      store.execute({
        type: 'createConnector',
        relation: BPMN.flow as never,
        from,
        to,
        bends: [],
      }) as unknown as { value: ConnectorId }
    ).value;
  return { scene, create, connect };
}

/** A tiny well-formedness check: tags nest and close, attributes are quoted, no stray `<` or `&`. */
function assertWellFormed(xml: string): void {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const stack: string[] = [];
  const re =
    /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/g;
  let pos = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (m.index !== pos) throw new Error(`Unparsable at ${pos}`);
    pos = re.lastIndex;
    if (m[5] !== undefined) {
      if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(m[5]))
        throw new Error(`Bare & in text: ${m[5]}`);
      continue;
    }
    if (m[1]) {
      if (stack.pop() !== m[2]) throw new Error(`Mismatched </${m[2]}>`);
    } else if (!m[4]) stack.push(m[2]!);
  }
  if (pos !== body.length) throw new Error('Trailing content');
  expect(stack).toEqual([]);
}

const count = (xml: string, tag: string) =>
  (xml.match(new RegExp(`<${tag}[ >/]`, 'g')) ?? []).length;

describe('exportSvg', () => {
  it('draws a small model from its draw lists', () => {
    const { scene, create, connect } = setup();
    const a = create(0, 0, 'A');
    const b = create(300, 100, 'B');
    connect(a, b);
    const svg = exportSvg(scene, { title: 'Order process' });
    assertWellFormed(svg);
    expect(svg).toMatch(/^<\?xml/);
    expect(svg).toContain('<title>Order process</title>');
    // Two rounded task boxes: each is a fill element plus a stroke element because of the shadow.
    expect(count(svg, 'rect')).toBe(4 + 1 /* label background */);
    expect(count(svg, 'text')).toBe(3);
    // The connector is one path; its diamond and arrow markers are a polygon each.
    expect(count(svg, 'path')).toBe(1);
    expect(count(svg, 'polygon')).toBe(2);
    expect(svg).toContain('stroke-dasharray="6 3"');
    expect(svg).toContain('stroke-dasharray="4 2"');
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('<feDropShadow');
    expect(svg).toContain('<text');
    expect(svg).toContain('>A</text>');
    // Rounded corners become arcs.
    expect(svg).toMatch(/d="M[^"]*A6 6 0 0 [01] /);
  });

  it('draws connectors below elements, as on screen', () => {
    const { scene, create, connect } = setup();
    connect(create(0, 0, 'A'), create(300, 0, 'B'));
    const svg = exportSvg(scene);
    expect(svg.indexOf('<path')).toBeLessThan(svg.indexOf('translate(0 0)'));
  });

  it('escapes markup in labels', () => {
    const { scene, create } = setup();
    create(0, 0, 'a < b & "c"');
    const svg = exportSvg(scene);
    assertWellFormed(svg);
    expect(svg).toContain('a &lt; b &amp; &quot;c&quot;</text>');
    expect(svg).not.toContain('a < b');
    expect(escapeXml("<&>'\u0001")).toBe("&lt;&amp;&gt;'");
  });

  it('fits the viewBox to the content plus padding', () => {
    const { scene, create } = setup();
    create(10, 20, 'A');
    const svg = exportSvg(scene, { padding: 5 });
    expect(svg).toContain('viewBox="5 15 110 60"');
    expect(svg).toContain('width="110" height="60"');
    expect(exportSvg(scene, { padding: 0 })).toContain(
      'viewBox="10 20 100 50"',
    );
  });

  it('draws only the selection when given', () => {
    const { scene, create, connect } = setup();
    const a = create(0, 0, 'A');
    const b = create(1000, 0, 'B');
    connect(a, b);
    const all = exportSvg(scene, { padding: 0 });
    const one = exportSvg(scene, {
      padding: 0,
      selection: { elements: new Set([a]), connectors: new Set() },
    });
    assertWellFormed(one);
    expect(one).toContain('>A</text>');
    expect(one).not.toContain('>B</text>');
    expect(count(one, 'path')).toBe(0);
    expect(one).toContain('viewBox="0 0 100 50"');
    expect(all).toContain('viewBox="0 0 1100 50"');
  });

  it('adds a background only when asked', () => {
    const { scene, create } = setup();
    create(0, 0, 'A');
    expect(exportSvg(scene)).not.toContain('fill="#fafafa"');
    expect(exportSvg(scene, { background: '#fafafa' })).toContain(
      'fill="#fafafa"',
    );
  });

  it('is deterministic', () => {
    const { scene, create, connect } = setup();
    connect(create(0, 0, 'A'), create(300, 100, 'B'));
    expect(exportSvg(scene)).toBe(exportSvg(scene));
  });

  it('gives an empty model a valid, tiny document', () => {
    const { scene } = setup();
    const svg = exportSvg(scene, { padding: 0 });
    assertWellFormed(svg);
    expect(svg).toContain('viewBox="0 0 0 0"');
  });
});

describe('polylineData', () => {
  const route = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];
  it('writes straight lines when there are no corners', () => {
    expect(polylineData(route, { routing: 'orthogonal', corners: 0 })).toBe(
      'M0 0L100 0L100 100',
    );
  });
  it('rounds a right-angle corner with an arc of the given radius', () => {
    // Turning right (clockwise on a y-down screen) is sweep flag 1.
    expect(polylineData(route, { routing: 'orthogonal', corners: 10 })).toBe(
      'M0 0L90 0A10 10 0 0 1 100 10L100 100',
    );
    expect(
      polylineData([route[0]!, { x: 100, y: 0 }, { x: 100, y: -100 }], {
        routing: 'orthogonal',
        corners: 10,
      }),
    ).toBe('M0 0L90 0A10 10 0 0 0 100 -10L100 -100');
  });
  it('smooths with quadratic curves', () => {
    expect(polylineData(route, { routing: 'curved', corners: 0 })).toBe(
      'M0 0Q100 0 100 50L100 100',
    );
  });
});
