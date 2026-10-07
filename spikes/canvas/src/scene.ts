import RBush from 'rbush';
import type { Connector, Model, NodeItem } from './model';
import {
  ROUTE_FLOATS,
  distanceToRoute,
  routeBetween,
  routeBounds,
} from './route';

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Box extends Rect {
  /** 0 = node, 1 = connector. */
  kind: 0 | 1;
  i: number;
}

/** The model plus everything derived from it: routes, adjacency and the spatial index. */
export class Scene {
  readonly nodes: NodeItem[];
  readonly connectors: Connector[];
  readonly routes: Float64Array;
  /** Connector indices touching each node. */
  readonly adjacency: number[][];
  readonly index = new RBush<Box>();
  private readonly nodeBoxes: Box[];
  private readonly connectorBoxes: Box[];

  constructor(model: Model) {
    this.nodes = model.nodes;
    this.connectors = model.connectors;
    this.routes = new Float64Array(this.connectors.length * ROUTE_FLOATS);
    this.adjacency = this.nodes.map(() => []);
    this.connectors.forEach((c, i) => {
      this.adjacency[c.from]!.push(i);
      this.adjacency[c.to]!.push(i);
      routeBetween(
        this.nodes[c.from]!,
        this.nodes[c.to]!,
        this.routes,
        i * ROUTE_FLOATS,
      );
    });
    this.nodeBoxes = this.nodes.map((n, i) => ({ ...nodeRect(n), kind: 0, i }));
    this.connectorBoxes = this.connectors.map((_, i) => ({
      ...routeBounds(this.routes, i * ROUTE_FLOATS),
      kind: 1,
      i,
    }));
    this.index.load([...this.nodeBoxes, ...this.connectorBoxes]);
  }

  search(rect: Rect): Box[] {
    return this.index.search(rect);
  }

  /** Topmost node under a point; later nodes draw on top. */
  nodeAt(x: number, y: number): number {
    let best = -1;
    for (const box of this.index.search({
      minX: x,
      minY: y,
      maxX: x,
      maxY: y,
    })) {
      if (box.kind === 0 && box.i > best) best = box.i;
    }
    return best;
  }

  connectorAt(x: number, y: number, tolerance: number): number {
    let best = -1;
    let bestDistance = tolerance;
    const rect = {
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance,
    };
    for (const box of this.index.search(rect)) {
      if (box.kind !== 1) continue;
      const d = distanceToRoute(this.routes, box.i * ROUTE_FLOATS, x, y);
      if (d <= bestDistance) {
        best = box.i;
        bestDistance = d;
      }
    }
    return best;
  }

  /** Commits a finished move: new positions, new routes, index updated for what changed. */
  moveNodes(ids: Iterable<number>, dx: number, dy: number): void {
    const touched = new Set<number>();
    for (const id of ids) {
      const node = this.nodes[id]!;
      node.x += dx;
      node.y += dy;
      this.index.remove(this.nodeBoxes[id]!);
      Object.assign(this.nodeBoxes[id]!, nodeRect(node));
      this.index.insert(this.nodeBoxes[id]!);
      for (const c of this.adjacency[id]!) touched.add(c);
    }
    for (const c of touched) {
      const connector = this.connectors[c]!;
      routeBetween(
        this.nodes[connector.from]!,
        this.nodes[connector.to]!,
        this.routes,
        c * ROUTE_FLOATS,
      );
      this.index.remove(this.connectorBoxes[c]!);
      Object.assign(
        this.connectorBoxes[c]!,
        routeBounds(this.routes, c * ROUTE_FLOATS),
      );
      this.index.insert(this.connectorBoxes[c]!);
    }
  }
}

export function nodeRect(n: NodeItem): Rect {
  return { minX: n.x, minY: n.y, maxX: n.x + n.w, maxY: n.y + n.h };
}
