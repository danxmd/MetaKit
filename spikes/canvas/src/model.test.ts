import { describe, expect, it } from 'vitest';
import { generateModel } from './model';
import { ROUTE_FLOATS } from './route';
import { Scene } from './scene';

describe('generateModel', () => {
  it('produces the benchmark model size', () => {
    const model = generateModel();
    expect(model.nodes).toHaveLength(5000);
    expect(model.connectors).toHaveLength(7000);
    expect(new Set(model.nodes.map((n) => n.kind))).toEqual(new Set([0, 1, 2]));
    expect(model.nodes.every((n) => n.label.length > 0)).toBe(true);
  });

  it('is deterministic for a seed and differs between seeds', () => {
    const a = generateModel({ nodes: 200, connectors: 300, seed: 7 });
    expect(generateModel({ nodes: 200, connectors: 300, seed: 7 })).toEqual(a);
    expect(generateModel({ nodes: 200, connectors: 300, seed: 8 })).not.toEqual(
      a,
    );
  });

  it('only joins existing, distinct nodes, once per pair', () => {
    const model = generateModel();
    const pairs = new Set<string>();
    for (const c of model.connectors) {
      expect(model.nodes[c.from]).toBeDefined();
      expect(model.nodes[c.to]).toBeDefined();
      expect(c.from).not.toBe(c.to);
      pairs.add(`${Math.min(c.from, c.to)}-${Math.max(c.from, c.to)}`);
    }
    expect(pairs.size).toBe(model.connectors.length);
  });
});

describe('Scene', () => {
  const scene = new Scene(generateModel());

  it('returns only items intersecting the viewport (culling)', () => {
    const view = { minX: 2000, minY: 1000, maxX: 3000, maxY: 1600 };
    const hits = scene.search(view);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(500);
    for (const box of hits) {
      expect(box.maxX >= view.minX && box.minX <= view.maxX).toBe(true);
      expect(box.maxY >= view.minY && box.minY <= view.maxY).toBe(true);
    }
  });

  it('hits the node under a point and nothing in empty space', () => {
    const node = scene.nodes[1234]!;
    expect(
      scene.nodeAt(node.x + node.w / 2, node.y + node.h / 2),
    ).toBeGreaterThanOrEqual(0);
    expect(scene.nodeAt(-5000, -5000)).toBe(-1);
  });

  it('hits a connector near its route', () => {
    const offset = 10 * ROUTE_FLOATS;
    const x = (scene.routes[offset + 2]! + scene.routes[offset + 4]!) / 2;
    const y = (scene.routes[offset + 3]! + scene.routes[offset + 5]!) / 2;
    expect(scene.connectorAt(x, y, 4)).toBeGreaterThanOrEqual(0);
    expect(scene.connectorAt(-5000, -5000, 4)).toBe(-1);
  });

  it('keeps connectors attached to a moved node and updates the index', () => {
    const local = new Scene(
      generateModel({ nodes: 300, connectors: 400, seed: 3 }),
    );
    const id = 150;
    local.moveNodes([id], 500, 300);
    const moved = local.nodes[id]!;
    expect(local.nodeAt(moved.x + moved.w / 2, moved.y + moved.h / 2)).toBe(id);
    for (const c of local.adjacency[id]!) {
      const connector = local.connectors[c]!;
      const o = c * ROUTE_FLOATS;
      const start = [local.routes[o]!, local.routes[o + 1]!];
      const end = [local.routes[o + 6]!, local.routes[o + 7]!];
      const near = (
        p: number[],
        n: { x: number; y: number; w: number; h: number },
      ) =>
        p[0]! >= n.x - 1 &&
        p[0]! <= n.x + n.w + 1 &&
        p[1]! >= n.y - 1 &&
        p[1]! <= n.y + n.h + 1;
      expect(near(start, local.nodes[connector.from]!)).toBe(true);
      expect(near(end, local.nodes[connector.to]!)).toBe(true);
    }
  });
});
