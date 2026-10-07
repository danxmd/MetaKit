export type NodeKind = 0 | 1 | 2; // rectangle, ellipse, rounded box

export interface NodeItem {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: NodeKind;
  label: string;
}

export interface Connector {
  from: number;
  to: number;
}

export interface Model {
  nodes: NodeItem[];
  connectors: Connector[];
}

export interface GenerateOptions {
  nodes?: number;
  connectors?: number;
  seed?: number;
  /** Nodes per row. 100 columns gives a 20,000 x 6,000 unit world for 5,000 nodes. */
  columns?: number;
}

/** Small seeded generator so every machine benchmarks the same model. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL_W = 200;
const CELL_H = 120;
const NEIGHBOUR_RANGE = 3;

export function generateModel(options: GenerateOptions = {}): Model {
  const nodeCount = options.nodes ?? 5000;
  const connectorCount = options.connectors ?? 7000;
  const columns = options.columns ?? 100;
  const rand = mulberry32(options.seed ?? 1);
  const rows = Math.ceil(nodeCount / columns);

  const nodes: NodeItem[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const w = 100 + Math.floor(rand() * 41);
    const h = 50 + Math.floor(rand() * 21);
    nodes.push({
      x: col * CELL_W + Math.floor(rand() * 41) - 20,
      y: row * CELL_H + Math.floor(rand() * 21) - 10,
      w,
      h,
      kind: Math.floor(rand() * 3) as NodeKind,
      label: `Node ${i}`,
    });
  }

  // Connectors join near neighbours, as in real process models, so their length is realistic.
  const connectors: Connector[] = [];
  const used = new Set<number>();
  let attempts = 0;
  while (connectors.length < connectorCount && attempts < connectorCount * 20) {
    attempts += 1;
    const from = Math.floor(rand() * nodeCount);
    const dc = Math.floor(rand() * (2 * NEIGHBOUR_RANGE + 1)) - NEIGHBOUR_RANGE;
    const dr = Math.floor(rand() * (2 * NEIGHBOUR_RANGE + 1)) - NEIGHBOUR_RANGE;
    const col = (from % columns) + dc;
    const row = Math.floor(from / columns) + dr;
    if (col < 0 || col >= columns || row < 0 || row >= rows) continue;
    const to = row * columns + col;
    if (to >= nodeCount || to === from) continue;
    const key = Math.min(from, to) * nodeCount + Math.max(from, to);
    if (used.has(key)) continue;
    used.add(key);
    connectors.push({ from, to });
  }
  return { nodes, connectors };
}
