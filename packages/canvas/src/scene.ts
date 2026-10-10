import RBush from 'rbush';
import {
  effectiveAttributes,
  effectiveRelationAttributes,
  inDrawingOrder,
  type AttributeDef,
  type ChangeEvent,
  type ClassDef,
  type NodeShape,
  type RelationShape,
  type ShapeDef,
  type ShapeId,
  type ClassId,
  type ConnectorId,
  type ElementId,
  type Model,
  type ModelCalculator,
  type ModelCommand,
  type Point,
  type RelationId,
  type Kit,
} from '@metakit-app/core';
import {
  contains,
  distanceToPolyline,
  rectOf,
  union,
  type Rect,
} from './geometry';
import { routeBounds, routeConnector } from './route';
import { fillFor } from './shapes';
import {
  PLACEHOLDER_SHAPE,
  CompileCache,
  compileRelation,
  defaultRelationShape,
  makeScope,
  starterFor,
  valuesByKey,
  type CachedCompile,
  type CompiledRelation,
  type OutlineKind,
} from '@metakit-app/shapes';
import type { Scope, Value } from '@metakit-app/formula';

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
  /** Fill used when the element is small enough to be drawn as a plain batched shape. */
  fill: string;
  outline: OutlineKind;
  compiled: CachedCompile;
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
  /** How the line looks: stroke, markers and labels, from the relation class's shape. */
  look: CompiledRelation;
  rank: number;
}

export type Item = ElementItem | ConnectorItem;

/** What the spatial index stores. The rectangle is mutated in place when its item changes. */
export interface IndexBox extends Rect {
  id: ElementId | ConnectorId;
  kind: 'element' | 'connector';
}

export interface SceneOptions {
  /** Language for class labels used as fallback text. */
  language?: string;
  cache?: CompileCache;
  /**
   * Gives shapes the values of formula attributes and the helpers (`objects()`, `parent`, ...),
   * and redraws the items it reports as changed.
   */
  calculator?: ModelCalculator;
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
  readonly cache: CompileCache;
  private readonly boxes = new Map<string, IndexBox>();
  private readonly adjacency = new Map<ElementId, Set<ConnectorId>>();
  private readonly listeners = new Set<(change: SceneChange) => void>();
  private ranksDirty = true;
  private readonly language: string;
  private readonly classCache = new Map<
    ClassId,
    {
      def: ClassDef;
      textAttrs: string[];
      defs: AttributeDef[];
      shape: NodeShape;
    }
  >();
  private readonly relationCache = new Map<
    RelationId,
    { defs: AttributeDef[]; shape: RelationShape; dynamic: boolean }
  >();
  /** Relation looks that do not depend on the connector's values are compiled once per shape. */
  private readonly staticLooks = new WeakMap<RelationShape, CompiledRelation>();
  private model: Model;
  private calculator: ModelCalculator | undefined;
  private stopCalculator: (() => void) | undefined;
  /**
   * Items whose shapes read a helper result or a value behind a reference. The calculator cannot
   * say which of them a change affects, so each of them is checked again after every change; the
   * compile cache then redraws only those whose recorded reads really differ.
   */
  private readonly volatile = new Set<string>();

  constructor(
    model: Model,
    public kit: Kit,
    options: SceneOptions = {},
  ) {
    this.model = model;
    this.language = options.language ?? 'en';
    this.cache = options.cache ?? new CompileCache();
    this.calculator = options.calculator;
    this.listen();
    this.rebuild(model);
  }

  /** Takes another calculator (or none) and draws everything again with it. */
  setCalculator(calculator: ModelCalculator | undefined): void {
    this.stopCalculator?.();
    this.calculator = calculator;
    this.listen();
    this.rebuild(this.model);
  }

  /** Stops listening to the calculator. Call it when the scene is no longer used. */
  destroy(): void {
    this.stopCalculator?.();
    this.stopCalculator = undefined;
  }

  private listen(): void {
    this.stopCalculator = this.calculator?.onChange((ids) =>
      this.recalculated(ids),
    );
  }

  /** Draws again the items whose calculated values changed, and those that read helper results. */
  private recalculated(ids: ReadonlySet<string>): void {
    const todo = new Set<string>([...ids, ...this.volatile]);
    const touched = new Set<string>();
    const connectors = new Set<ConnectorId>();
    for (const id of todo) {
      if (id in this.model.elements) {
        this.putElement(this.model, id as ElementId);
        touched.add(id);
        for (const c of this.adjacency.get(id as ElementId) ?? [])
          connectors.add(c);
      } else if (id in this.model.connectors) connectors.add(id as ConnectorId);
    }
    for (const id of connectors) {
      this.putConnector(this.model, id);
      touched.add(id);
    }
    if (touched.size === 0) return;
    this.assignRanks();
    this.emit({ ids: touched, structural: false });
  }

  /** Takes a changed Kit (hot reload) and redraws everything that depends on it. */
  setKit(kit: Kit): void {
    this.kit = kit;
    this.rebuild(this.model);
  }

  /** The shape a class draws with: its own when it has one, else a starter chosen by kind and key. */
  private nodeShapeFor(def: ClassDef): NodeShape {
    const own = def.shape ? this.kit.shapes?.[def.shape] : undefined;
    return own?.kind === 'node' ? own : starterFor(def);
  }

  private shapeLookup = (id: ShapeId): ShapeDef | undefined =>
    this.kit.shapes?.[id];

  /** Throws away everything and reads the whole model; used on open and after a Kit change. */
  rebuild(model: Model): void {
    this.model = model;
    this.ready = false;
    this.elements.clear();
    this.connectors.clear();
    this.boxes.clear();
    this.adjacency.clear();
    this.index.clear();
    this.classCache.clear();
    this.relationCache.clear();
    this.volatile.clear();
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
      const def = this.kit.classes[id];
      if (!def) return undefined;
      let defs: AttributeDef[] = [];
      try {
        defs = effectiveAttributes(this.kit, id);
      } catch {
        // A broken class chain still draws, with the class name as the label.
      }
      info = {
        def,
        defs,
        textAttrs: defs.filter((a) => a.type === 'text').map((a) => a.id),
        shape: this.nodeShapeFor(def),
      };
      this.classCache.set(id, info);
    }
    return info;
  }

  private relationInfo(id: RelationId) {
    let info = this.relationCache.get(id);
    if (!info) {
      const def = this.kit.relations[id];
      let defs: AttributeDef[] = [];
      try {
        if (def) defs = effectiveRelationAttributes(this.kit, id);
      } catch {
        // A broken relation chain still draws with its own shape.
      }
      const own = def?.shape ? this.kit.shapes?.[def.shape] : undefined;
      const shape =
        own?.kind === 'relation'
          ? own
          : defaultRelationShape('shp_starter_default');
      info = { defs, shape, dynamic: JSON.stringify(shape).includes('"=') };
      this.relationCache.set(id, info);
    }
    return info;
  }

  /** What `makeScope` needs from a calculator scope: computed values and the model helpers. */
  private hostOf(calc: Scope) {
    return {
      computed: (key: string) => calc.get(key),
      host: {
        ...(calc.call ? { call: calc.call.bind(calc) } : {}),
        ...(calc.member ? { member: calc.member.bind(calc) } : {}),
        special: (name: string) => calc.get(name),
      },
    };
  }

  private resolveRef = (id: string): Record<string, Value> | undefined => {
    const e = this.model.elements[id as ElementId];
    if (!e) return undefined;
    return valuesByKey(this.classInfo(e.class)?.defs ?? [], e.attrs);
  };

  private scopeFor(
    data: {
      id: string;
      class: ClassId;
      attrs: Record<string, never> | Record<string, unknown>;
    },
    w: number,
    h: number,
  ) {
    const info = this.classInfo(data.class);
    const attrs = data.attrs as Record<string, never>;
    const label = info
      ? this.labelFor(data.class, attrs)
      : `Unknown class ${data.class}`;
    const labelKey = info?.defs.find((a) => a.id === info.textAttrs[0])?.key;
    const calc = this.calculator?.scope(data.id);
    return {
      info,
      label,
      scope: makeScope(
        info?.defs ?? [],
        attrs,
        {
          label,
          className: info
            ? (info.def.labels[this.language] ?? info.def.key)
            : 'Unknown class',
          w,
          h,
          fill: info ? fillFor(info.def) : '#e9ecef',
          resolve: this.resolveRef,
          language: this.language,
          ...(calc ? this.hostOf(calc) : {}),
        },
        labelKey,
      ),
    };
  }

  /** The compiled list for an element shown at another size, as in a resize preview. Not kept. */
  compiledAt(item: ElementItem, w: number, h: number): CachedCompile {
    const data = this.model.elements[item.id];
    if (!data) return item.compiled;
    const { info, scope } = this.scopeFor(data, w, h);
    return this.cache.get(
      undefined,
      info?.shape ?? PLACEHOLDER_SHAPE,
      w,
      h,
      scope,
      this.shapeLookup,
    );
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
    const existing = this.elements.get(id);
    if (!existing || existing.pos !== data.pos) this.ranksDirty = true;
    const { info, label, scope } = this.scopeFor(data, data.w, data.h);
    const compiled = this.cache.get(
      existing?.compiled,
      info?.shape ?? PLACEHOLDER_SHAPE,
      data.w,
      data.h,
      scope,
      this.shapeLookup,
    );
    const first = compiled.compiled.ops.find(
      (o) =>
        (o.op === 'rect' || o.op === 'ellipse' || o.op === 'polygon') &&
        typeof o.style.fill === 'string',
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
      fill:
        first && 'style' in first && typeof first.style.fill === 'string'
          ? first.style.fill
          : info
            ? fillFor(info.def)
            : '#e9ecef',
      outline: compiled.compiled.outline,
      compiled,
      rank: existing?.rank ?? 0,
    };
    this.elements.set(id, item);
    this.track(id, compiled.compiled.reads);
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
    const look = this.lookFor(data);
    const route =
      from && to
        ? routeConnector(from, to, data.bends, look.line.routing)
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
      look,
      rank: existing?.rank ?? 0,
    };
    this.connectors.set(id, item);
    this.track(id, look.reads);
    this.setBox(id, 'connector', routeBounds(route));
  }

  /** Remembers whether an item's shape reads helper results or values behind references. */
  private track(id: string, reads: readonly string[]): void {
    if (reads.some((r) => r.includes('\u0000'))) this.volatile.add(id);
    else this.volatile.delete(id);
  }

  private lookFor(data: {
    id: string;
    relation: RelationId;
    attrs: Record<string, unknown>;
  }): CompiledRelation {
    const info = this.relationInfo(data.relation);
    if (!info.dynamic) {
      let look = this.staticLooks.get(info.shape);
      if (!look) {
        look = compileRelation(info.shape, { get: () => undefined });
        this.staticLooks.set(info.shape, look);
      }
      return look;
    }
    const def = this.kit.relations[data.relation];
    const calc = this.calculator?.scope(data.id);
    return compileRelation(
      info.shape,
      makeScope(info.defs, data.attrs as Record<string, never>, {
        label: '',
        className: def?.key ?? '',
        w: 0,
        h: 0,
        fill: '',
        resolve: this.resolveRef,
        language: this.language,
        ...(calc ? this.hostOf(calc) : {}),
      }),
    );
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
    this.volatile.delete(id);
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
    return routeConnector(
      box(a, from),
      box(b, to),
      bends,
      connector.look.line.routing,
    );
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
    return routeConnector(
      box(a, from),
      box(b, to),
      bends,
      connector.look.line.routing,
    );
  }
}
