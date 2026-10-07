import RBush from 'rbush';
import {
  effectiveAttributes,
  inDrawingOrder,
  type ChangeEvent,
  type ClassDef,
  type ClassId,
  type ConnectorId,
  type ElementId,
  type Model,
  type ModelCommand,
  type Point,
  type RelationId,
  type ToolLibrary,
} from '@metakit-app/core';
import { DrawListCache, type DrawList } from './drawlist';
import {
  contains,
  distanceToPolyline,
  rectOf,
  union,
  type Rect,
} from './geometry';
import { routeBounds, routeConnector } from './route';
import {
  builtinShape,
  fillFor,
  type ShapeChooser,
  type ShapeName,
} from './shapes';

export interface ElementItem {
  kind: 'element';
  id: ElementId;
  cls: ClassId;
  x: number;
  y: number;
  w: number;
  h: number;
  parent: ElementId | undefined;
  pos: string;
  label: string;
  fill: string;
  shape: ShapeName;
  draw: DrawList;
  /** Position in drawing order among elements; larger is on top. */
  rank: number;
}

export interface ConnectorItem {
  kind: 'connector';
  id: ConnectorId;
  relation: RelationId;
  from: ElementId;
  to: ElementId;
  bends: Point[];
  pos: string;
  route: Point[];
  rank: number;
}

export type Item = ElementItem | ConnectorItem;

/** What the spatial index stores. The rectangle is mutated in place when its item changes. */
export interface IndexBox extends Rect {
  id: ElementId | ConnectorId;
  kind: 'element' | 'connector';
}

export interface SceneOptions {
  shape?: ShapeChooser;
  /** Language for class labels used as fallback text. */
  language?: string;
  cache?: DrawListCache;
}

export interface SceneChange {
  /** Ids added, changed or removed. */
  ids: ReadonlySet<string>;
  /** True when items were added or removed, so that draw order and the explorer lists may differ. */
  structural: boolean;
}

const HIT_PADDING = 0;

/**
 * The model as the canvas sees it: element and connector items with cached draw lists and routes,
 * and the spatial index over them. It follows store change events (including undo and redo) and
 * touches only the items whose data changed, plus the connectors attached to moved elements.
 */
export class Scene {
  readonly elements = new Map<ElementId, ElementItem>();
  readonly connectors = new Map<ConnectorId, ConnectorItem>();
  readonly index = new RBush<IndexBox>();
  readonly cache: DrawListCache;
  private readonly boxes = new Map<string, IndexBox>();
  private readonly adjacency = new Map<ElementId, Set<ConnectorId>>();
  private readonly listeners = new Set<(change: SceneChange) => void>();
  private ranksDirty = true;
  private readonly chooseShape: ShapeChooser;
  private readonly language: string;
  private readonly classCache = new Map<
    ClassId,
    { def: ClassDef; textAttrs: string[] }
  >();
  private model: Model;

  constructor(
    model: Model,
    readonly tool: ToolLibrary,
    options: SceneOptions = {},
  ) {
    this.model = model;
    this.chooseShape = options.shape ?? builtinShape;
    this.language = options.language ?? 'en';
    this.cache = options.cache ?? new DrawListCache();
    this.rebuild(model);
  }

  /** Throws away everything and reads the whole model; used on open and after a tool change. */
  rebuild(model: Model): void {
    this.model = model;
    this.ready = false;
    this.elements.clear();
    this.connectors.clear();
    this.boxes.clear();
    this.adjacency.clear();
    this.index.clear();
    this.classCache.clear();
    for (const e of Object.values(model.elements)) this.putElement(model, e.id);
    for (const c of Object.values(model.connectors))
      this.putConnector(model, c.id);
    this.index.load([...this.boxes.values()]);
    this.ranksDirty = true;
    this.assignRanks();
    this.emit({ ids: new Set(this.boxes.keys()), structural: true });
  }

  onChange(listener: (change: SceneChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: SceneChange): void {
    for (const l of this.listeners) l(change);
  }

  /** Brings the scene up to date with one store change event. */
  apply(event: ChangeEvent<Model, ModelCommand>): void {
    const model = event.state;
    this.model = model;
    const elementIds = new Set<ElementId>();
    const connectorIds = new Set<ConnectorId>();
    for (const patch of event.patches) {
      const [root, id] = patch.path;
      if (root === 'elements' && id) elementIds.add(id as ElementId);
      else if (root === 'connectors' && id) connectorIds.add(id as ConnectorId);
    }
    if (elementIds.size === 0 && connectorIds.size === 0) return;

    let structural = false;
    for (const id of elementIds) {
      const existed = this.elements.has(id);
      const exists = id in model.elements;
      if (existed !== exists) structural = true;
      if (exists) this.putElement(model, id);
      else this.removeItem(id);
      for (const c of this.adjacency.get(id) ?? []) connectorIds.add(c);
    }
    for (const id of connectorIds) {
      const existed = this.connectors.has(id);
      const exists = id in model.connectors;
      if (existed !== exists) structural = true;
      if (exists) this.putConnector(model, id);
      else this.removeItem(id);
    }
    if (structural) this.ranksDirty = true;
    this.assignRanks();
    this.emit({
      ids: new Set<string>([...elementIds, ...connectorIds]),
      structural,
    });
  }

  /** Follows a store; returns the function that stops following. */
  attach(store: {
    subscribe(
      listener: (event: ChangeEvent<Model, ModelCommand>) => void,
    ): () => void;
  }): () => void {
    return store.subscribe((event) => this.apply(event));
  }

  private classInfo(id: ClassId) {
    let info = this.classCache.get(id);
    if (!info) {
      const def = this.tool.classes[id];
      if (!def) return undefined;
      let textAttrs: string[] = [];
      try {
        textAttrs = effectiveAttributes(this.tool, id)
          .filter((a) => a.type === 'text')
          .map((a) => a.id);
      } catch {
        // A broken class chain still draws, with the class name as the label.
      }
      info = { def, textAttrs };
      this.classCache.set(id, info);
    }
    return info;
  }

  /** The attribute whose value is the shape's label: the first text attribute of the class, if it has one. */
  labelAttribute(cls: ClassId): string | undefined {
    return this.classInfo(cls)?.textAttrs[0];
  }

  /** The text shown in the shape: the first filled-in text attribute, else the class name. */
  labelFor(cls: ClassId, attrs: Record<string, unknown>): string {
    const info = this.classInfo(cls);
    if (!info) return '';
    for (const id of info.textAttrs) {
      const v = attrs[id];
      if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return info.def.labels[this.language] ?? info.def.key;
  }

  private putElement(model: Model, id: ElementId): void {
    const data = model.elements[id];
    if (!data) return;
    const info = this.classInfo(data.class);
    const shape = info ? this.chooseShape(info.def) : 'rounded';
    const fill = info ? fillFor(info.def) : '#f1f3f5';
    const label = this.labelFor(data.class, data.attrs);
    const existing = this.elements.get(id);
    if (!existing || existing.pos !== data.pos) this.ranksDirty = true;
    const draw = this.cache.get(
      existing?.draw,
      shape,
      data.w,
      data.h,
      label,
      fill,
    );
    const item: ElementItem = {
      kind: 'element',
      id,
      cls: data.class,
      x: data.x,
      y: data.y,
      w: data.w,
      h: data.h,
      parent: data.parent,
      pos: data.pos,
      label,
      fill,
      shape,
      draw,
      rank: existing?.rank ?? 0,
    };
    this.elements.set(id, item);
    this.setBox(id, 'element', rectOf(item.x, item.y, item.w, item.h));
  }

  private putConnector(model: Model, id: ConnectorId): void {
    const data = model.connectors[id];
    if (!data) return;
    const from = this.elements.get(data.from);
    const to = this.elements.get(data.to);
    const existing = this.connectors.get(id);
    if (!existing || existing.pos !== data.pos) this.ranksDirty = true;
    if (existing) {
      this.adjacency.get(existing.from)?.delete(id);
      this.adjacency.get(existing.to)?.delete(id);
    }
    for (const end of [data.from, data.to]) {
      let set = this.adjacency.get(end);
      if (!set) this.adjacency.set(end, (set = new Set()));
      set.add(id);
    }
    // A connector whose end is missing is kept with a short route so that it can still be selected
    // and deleted; validation reports the dangling end.
    const route =
      from && to
        ? routeConnector(from, to, data.bends)
        : [...data.bends].length >= 2
          ? [...data.bends]
          : [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
            ];
    const item: ConnectorItem = {
      kind: 'connector',
      id,
      relation: data.relation,
      from: data.from,
      to: data.to,
      bends: data.bends.map((b) => ({ ...b })),
      pos: data.pos,
      route,
      rank: existing?.rank ?? 0,
    };
    this.connectors.set(id, item);
    this.setBox(id, 'connector', routeBounds(route));
  }

  private setBox(
    id: ElementId | ConnectorId,
    kind: IndexBox['kind'],
    rect: Rect,
  ): void {
    let box = this.boxes.get(id);
    if (box) {
      if (this.ready) this.index.remove(box);
      Object.assign(box, rect);
    } else {
      box = { ...rect, id, kind };
      this.boxes.set(id, box);
    }
    if (this.ready) this.index.insert(box);
  }

  /** False while `rebuild` collects boxes for one bulk load into the index. */
  private ready = false;

  private removeItem(id: string): void {
    const box = this.boxes.get(id);
    if (box) {
      this.index.remove(box);
      this.boxes.delete(id);
    }
    const element = this.elements.get(id as ElementId);
    if (element) {
      this.elements.delete(element.id);
      this.adjacency.delete(element.id);
      return;
    }
    const connector = this.connectors.get(id as ConnectorId);
    if (connector) {
      this.connectors.delete(connector.id);
      this.adjacency.get(connector.from)?.delete(connector.id);
      this.adjacency.get(connector.to)?.delete(connector.id);
    }
  }

  private assignRanks(): void {
    this.ready = true;
    if (!this.ranksDirty) return;
    this.ranksDirty = false;
    inDrawingOrder(this.model.elements).forEach((e, i) => {
      const item = this.elements.get(e.id);
      if (item) item.rank = i;
    });
    inDrawingOrder(this.model.connectors).forEach((c, i) => {
      const item = this.connectors.get(c.id);
      if (item) item.rank = i;
    });
  }

  /** Connector ids attached to an element. */
  connectorsOf(id: ElementId): ReadonlySet<ConnectorId> {
    return this.adjacency.get(id) ?? new Set();
  }

  /** Items whose box meets the rectangle, in no particular order. */
  search(rect: Rect): IndexBox[] {
    return this.index.search(rect);
  }

  /** The topmost element under a point. */
  elementAt(p: Point): ElementItem | undefined {
    let best: ElementItem | undefined;
    for (const box of this.index.search({
      minX: p.x - HIT_PADDING,
      minY: p.y - HIT_PADDING,
      maxX: p.x + HIT_PADDING,
      maxY: p.y + HIT_PADDING,
    })) {
      if (box.kind !== 'element') continue;
      const item = this.elements.get(box.id as ElementId);
      if (item && (!best || item.rank > best.rank)) best = item;
    }
    return best;
  }

  /** The connector nearest to a point within `tolerance` world units. */
  connectorAt(p: Point, tolerance: number): ConnectorItem | undefined {
    let best: ConnectorItem | undefined;
    let bestDistance = tolerance;
    for (const box of this.index.search({
      minX: p.x - tolerance,
      minY: p.y - tolerance,
      maxX: p.x + tolerance,
      maxY: p.y + tolerance,
    })) {
      if (box.kind !== 'connector') continue;
      const item = this.connectors.get(box.id as ConnectorId);
      if (!item) continue;
      const d = distanceToPolyline(p, item.route);
      if (
        d < bestDistance ||
        (d === bestDistance && best && item.rank > best.rank)
      ) {
        best = item;
        bestDistance = d;
      }
    }
    return best;
  }

  /**
   * Elements and connectors for a rubber band. `inside` asks for items that lie fully in the
   * rectangle; otherwise any overlap counts.
   */
  itemsIn(rect: Rect, inside = true): Item[] {
    const result: Item[] = [];
    for (const box of this.index.search(rect)) {
      if (inside && !contains(rect, box)) continue;
      const item =
        box.kind === 'element'
          ? this.elements.get(box.id as ElementId)
          : this.connectors.get(box.id as ConnectorId);
      if (item) result.push(item);
    }
    return result;
  }

  /** Bounds of the whole model, or null when it is empty. */
  bounds(): Rect | null {
    let result: Rect | null = null;
    for (const box of this.boxes.values()) {
      result = result ? union(result, box) : { ...box };
    }
    return result;
  }

  /** The route a connector would have with other bend points (used while a bend is dragged). */
  routeWithBends(
    connector: ConnectorItem,
    bends: readonly Point[],
    from?: Rect,
    to?: Rect,
  ): Point[] {
    const a = this.elements.get(connector.from);
    const b = this.elements.get(connector.to);
    if (!a || !b) return connector.route;
    const box = (e: ElementItem, r: Rect | undefined) =>
      r ? { x: r.minX, y: r.minY, w: r.maxX - r.minX, h: r.maxY - r.minY } : e;
    return routeConnector(box(a, from), box(b, to), bends);
  }

  /**
   * The connector's route with its ends shown in other rectangles, for drawing a drag preview.
   * When both ends move by the same amount the bend points move with them.
   */
  routeWithRects(
    connector: ConnectorItem,
    from?: Rect | undefined,
    to?: Rect | undefined,
  ): Point[] {
    const a = this.elements.get(connector.from);
    const b = this.elements.get(connector.to);
    if (!a || !b) return connector.route;
    const box = (e: ElementItem, r: Rect | undefined) =>
      r ? { x: r.minX, y: r.minY, w: r.maxX - r.minX, h: r.maxY - r.minY } : e;
    let bends = connector.bends;
    if (from && to) {
      const dx = from.minX - a.x;
      const dy = from.minY - a.y;
      if (to.minX - b.x === dx && to.minY - b.y === dy)
        bends = bends.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
    return routeConnector(box(a, from), box(b, to), bends);
  }
}
