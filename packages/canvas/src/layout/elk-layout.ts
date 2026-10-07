import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import {
  inDrawingOrder,
  type ConnectorId,
  type ElementId,
  type Model,
  type Point,
} from '@metakit-app/core';

export type { ElkNode } from 'elkjs/lib/elk-api';

export interface LayoutOptions {
  /** The way the flow reads: left to right (default) or top to bottom. */
  direction?: 'right' | 'down';
  /** Gap between neighbouring shapes in pixels (default 40). */
  spacing?: number;
  /** Lay out only `selection` (and what its containers hold); everything else stays put. */
  selectionOnly?: boolean;
  selection?: readonly ElementId[];
  /**
   * Elements that must not move. They, and what they contain, are left out of the layout; the
   * rest is placed where the group's top-left corner was.
   */
  keepFixed?: readonly ElementId[];
  /** Give up after this many milliseconds (default 15 000). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface LayoutResult {
  moves: { id: ElementId; x: number; y: number }[];
  /** Only containers: ELK sizes them to hold their children. */
  resizes: { id: ElementId; w: number; h: number }[];
  bends: { id: ConnectorId; bends: Point[] }[];
}

/** Room above the children of a container for its title bar. */
const CONTAINER_PADDING = { top: 34, left: 12, bottom: 12, right: 12 };
const DEFAULT_SPACING = 40;

export interface ElkGraph {
  root: ElkNode;
  /** Where the laid-out group started, so the result can be put back there. */
  anchor: Point;
  /** The nodes the graph holds, with their parent in the graph. */
  nodeIds: Set<ElementId>;
  /** The connectors in the graph. */
  edgeIds: Set<ConnectorId>;
  /** Absolute origin of the container that holds each edge (the nearest common container). */
  edgeParent: Map<ConnectorId, ElementId | null>;
}

/**
 * Builds the ELK graph for a model: elements are nodes with their sizes, containers hold their
 * children as nested nodes, connectors are edges stored in the nearest container of both ends.
 * Plain data only, so it can be sent to a worker.
 */
export function buildElkGraph(
  model: Model,
  options: LayoutOptions = {},
): ElkGraph | null {
  const elements = inDrawingOrder(model.elements);
  const fixed = new Set<ElementId>(options.keepFixed ?? []);
  const childrenOf = new Map<ElementId | null, ElementId[]>();
  for (const el of elements) {
    const parent =
      el.parent && model.elements[el.parent] ? el.parent : (null as null);
    const list = childrenOf.get(parent) ?? [];
    list.push(el.id);
    childrenOf.set(parent, list);
  }

  // Elements that start a laid-out tree: the selection's outermost members, or the top level.
  let roots: ElementId[];
  if (options.selectionOnly && (options.selection?.length ?? 0) > 0) {
    const picked = new Set(
      options.selection!.filter((id) => model.elements[id]),
    );
    roots = [...picked].filter((id) => {
      for (let p = model.elements[id]!.parent, n = 0; p && n < 1000; n++) {
        if (picked.has(p)) return false;
        p = model.elements[p]?.parent;
      }
      return true;
    });
  } else {
    roots = childrenOf.get(null) ?? [];
  }
  roots = roots.filter((id) => !fixed.has(id));
  if (roots.length === 0) return null;

  const nodeIds = new Set<ElementId>();
  const chain = new Map<ElementId, ElementId[]>();
  const makeNode = (id: ElementId, path: ElementId[]): ElkNode => {
    const el = model.elements[id]!;
    nodeIds.add(id);
    chain.set(id, path);
    const kids = (childrenOf.get(id) ?? []).filter(
      (k) => !fixed.has(k) && !nodeIds.has(k),
    );
    const node: ElkNode = { id, width: el.w, height: el.h };
    if (kids.length > 0) {
      node.children = kids.map((k) => makeNode(k, [...path, id]));
      node.layoutOptions = {
        'elk.padding': `[top=${CONTAINER_PADDING.top},left=${CONTAINER_PADDING.left},bottom=${CONTAINER_PADDING.bottom},right=${CONTAINER_PADDING.right}]`,
      };
      // A container must be allowed to grow to hold its children.
      delete node.width;
      delete node.height;
    }
    return node;
  };
  const rootNodes = roots.map((id) => makeNode(id, []));

  const spacing = options.spacing ?? DEFAULT_SPACING;
  const size = nodeIds.size;
  const root: ElkNode = {
    id: 'root',
    children: rootNodes,
    edges: [],
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': options.direction === 'down' ? 'DOWN' : 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': String(spacing),
      'elk.spacing.edgeNode': String(Math.round(spacing / 2)),
      'elk.spacing.edgeEdge': String(Math.round(spacing / 4)),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing + 20),
      'elk.layered.spacing.edgeNodeBetweenLayers': String(
        Math.round(spacing / 2),
      ),
      'elk.layered.spacing.edgeEdgeBetweenLayers': String(
        Math.round(spacing / 4),
      ),
      // Quality costs time; a large model gets a cheaper search so it stays interactive.
      'elk.layered.thoroughness': size > 300 ? '1' : size > 100 ? '3' : '7',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.separateConnectedComponents': 'true',
    },
  };

  const byId = new Map<ElementId | 'root', ElkNode>([['root', root]]);
  const index = (n: ElkNode) => {
    byId.set(n.id as ElementId, n);
    n.children?.forEach(index);
  };
  rootNodes.forEach(index);

  const edgeIds = new Set<ConnectorId>();
  const edgeParent = new Map<ConnectorId, ElementId | null>();
  for (const cn of inDrawingOrder(model.connectors)) {
    if (cn.from === cn.to) continue;
    const a = chain.get(cn.from);
    const b = chain.get(cn.to);
    if (!a || !b) continue;
    const pathA = [...a, cn.from];
    const pathB = [...b, cn.to];
    // An edge between a container and something inside it cannot be routed by ELK.
    if (pathA.includes(cn.to) || pathB.includes(cn.from)) continue;
    let common: ElementId | null = null;
    for (let i = 0; i < Math.min(a.length, b.length) && a[i] === b[i]; i++)
      common = a[i]!;
    const edge: ElkExtendedEdge = {
      id: cn.id,
      sources: [cn.from],
      targets: [cn.to],
    };
    const holder = byId.get(common ?? 'root')!;
    (holder.edges ??= []).push(edge);
    edgeIds.add(cn.id);
    edgeParent.set(cn.id, common);
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const id of roots) {
    minX = Math.min(minX, model.elements[id]!.x);
    minY = Math.min(minY, model.elements[id]!.y);
  }
  return { root, anchor: { x: minX, y: minY }, nodeIds, edgeIds, edgeParent };
}

/**
 * Reads ELK's answer back as model coordinates. ELK positions are relative to the parent node, so
 * the offsets are added up; the whole result is shifted so the group keeps its top-left corner.
 */
export function readElkResult(
  model: Model,
  graph: ElkGraph,
  laidOut: ElkNode,
): LayoutResult {
  const result: LayoutResult = { moves: [], resizes: [], bends: [] };
  const origin = new Map<ElementId | null, Point>();
  origin.set(null, { x: 0, y: 0 });

  let minX = Infinity;
  let minY = Infinity;
  for (const n of laidOut.children ?? []) {
    minX = Math.min(minX, n.x ?? 0);
    minY = Math.min(minY, n.y ?? 0);
  }
  if (minX === Infinity) return result;
  const shift = { x: graph.anchor.x - minX, y: graph.anchor.y - minY };

  const visit = (n: ElkNode, base: Point) => {
    const id = n.id as ElementId;
    const x = Math.round(base.x + (n.x ?? 0));
    const y = Math.round(base.y + (n.y ?? 0));
    result.moves.push({ id, x, y });
    origin.set(id, { x, y });
    if (n.children?.length) {
      const el = model.elements[id]!;
      const w = Math.max(1, Math.round(n.width ?? el.w));
      const h = Math.max(1, Math.round(n.height ?? el.h));
      result.resizes.push({ id, w, h });
      for (const c of n.children) visit(c, { x, y });
    }
  };
  for (const n of laidOut.children ?? []) visit(n, shift);

  const readEdges = (n: ElkNode, holder: ElementId | null) => {
    const base = origin.get(holder) ?? shift;
    for (const e of n.edges ?? []) {
      const points = (e.sections ?? []).flatMap((s) => s.bendPoints ?? []);
      result.bends.push({
        id: e.id as ConnectorId,
        bends: points.map((p) => ({
          x: Math.round(base.x + p.x),
          y: Math.round(base.y + p.y),
        })),
      });
    }
    for (const c of n.children ?? []) readEdges(c, c.id as ElementId);
  };
  // Edges of the top level are relative to the shifted origin of the whole graph.
  origin.set(null, shift);
  readEdges(laidOut, null);
  return result;
}

/** Where ELK runs: a Web Worker in the app, in-process in tests. */
export interface LayoutEngine {
  run(
    graph: ElkNode,
    control: { signal?: AbortSignal; timeoutMs: number },
  ): Promise<ElkNode>;
  dispose(): void;
}

export class LayoutError extends Error {
  constructor(
    readonly reason: 'cancelled' | 'timeout' | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'LayoutError';
  }
}

/** Lays out a model with the given engine. Returns an empty result when there is nothing to do. */
export async function layoutModel(
  engine: LayoutEngine,
  model: Model,
  options: LayoutOptions = {},
): Promise<LayoutResult> {
  const graph = buildElkGraph(model, options);
  if (!graph) return { moves: [], resizes: [], bends: [] };
  const laidOut = await engine.run(graph.root, {
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 15_000,
  });
  return readElkResult(model, graph, laidOut);
}
