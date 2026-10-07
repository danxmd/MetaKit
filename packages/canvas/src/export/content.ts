import type { ConnectorId, ElementId } from '@metakit-app/core';
import { union, type Rect } from '../geometry';
import { pointAlong } from '../paint';
import type { ConnectorItem, ElementItem, Scene } from '../scene';

/** What to export when not the whole model. */
export interface ExportSelection {
  elements: ReadonlySet<ElementId>;
  connectors: ReadonlySet<ConnectorId>;
}

/** The items an export draws, in drawing order, and the area they cover. */
export interface ExportContent {
  /** Bottom to top, as on screen. */
  elements: ElementItem[];
  connectors: ConnectorItem[];
  /** World rectangle of the content including line ends, labels and padding. */
  bounds: Rect;
}

/** The route's box, widened for the stroke, the markers and the labels, which the route alone leaves out. */
function connectorBounds(c: ConnectorItem): Rect | null {
  if (c.route.length === 0) return null;
  let r: Rect = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const p of c.route)
    r = {
      minX: Math.min(r.minX, p.x),
      minY: Math.min(r.minY, p.y),
      maxX: Math.max(r.maxX, p.x),
      maxY: Math.max(r.maxY, p.y),
    };
  const look = c.look;
  const reach = Math.max(
    look.line.width / 2,
    look.start?.size ?? 0,
    look.end?.size ?? 0,
  );
  r = {
    minX: r.minX - reach,
    minY: r.minY - reach,
    maxX: r.maxX + reach,
    maxY: r.maxY + reach,
  };
  for (const label of look.labels) {
    const at = label.at === 'start' ? 0.08 : label.at === 'end' ? 0.92 : 0.5;
    const p = pointAlong(c.route, at);
    const halfW = (label.text.length * label.font.size * 0.55) / 2 + 3;
    const halfH = label.font.size * 0.7;
    const x = p.x + label.offset.x;
    const y = p.y + label.offset.y;
    r = union(r, {
      minX: x - halfW,
      minY: y - halfH,
      maxX: x + halfW,
      maxY: y + halfH,
    });
  }
  return r;
}

/** Picks the items to draw (all, or the selection) and measures them. Pure; no DOM. */
export function collectContent(
  scene: Scene,
  selection: ExportSelection | undefined,
  padding: number,
): ExportContent {
  const elements = [...scene.elements.values()]
    .filter((e) => !selection || selection.elements.has(e.id))
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
  const connectors = [...scene.connectors.values()]
    .filter((c) => !selection || selection.connectors.has(c.id))
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));

  let area: Rect | null = null;
  const add = (r: Rect) => {
    area = area ? union(area, r) : { ...r };
  };
  for (const e of elements)
    add({ minX: e.x, minY: e.y, maxX: e.x + e.w, maxY: e.y + e.h });
  for (const c of connectors) {
    const r = connectorBounds(c);
    if (r) add(r);
  }
  const base: Rect = area ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    elements,
    connectors,
    bounds: {
      minX: base.minX - padding,
      minY: base.minY - padding,
      maxX: base.maxX + padding,
      maxY: base.maxY + padding,
    },
  };
}

/** The image sources used by the content's elements, for preloading. */
export function imageSources(content: ExportContent): string[] {
  const out = new Set<string>();
  for (const e of content.elements)
    for (const op of e.compiled.compiled.ops)
      if (op.op === 'image') out.add(op.src);
  return [...out];
}
