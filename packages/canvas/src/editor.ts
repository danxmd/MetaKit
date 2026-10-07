import {
  CommandError,
  childrenIndex,
  containerAt,
  descendantsOf,
  isContainerClass,
  outermostOf,
  type ClassId,
  type ConnectorId,
  type ElementId,
  type Model,
  type ModelCommand,
  type ModelStore,
  type Point,
  type RelationDef,
  type RelationId,
  type ToolLibrary,
} from '@metakit-app/core';
import { isTyping, type CanvasView } from './canvas-view';
import {
  distanceToPolyline,
  inflate,
  nearestSegment,
  rectOf,
  union,
  type Rect,
} from './geometry';
import { CURSORS, hitHandle, resizeRect, type HandleName } from './handles';
import type { ActiveState } from './renderer';
import { edgePoint } from './route';
import type { ConnectorItem, ElementItem } from './scene';
import {
  align,
  distribute,
  type AlignMode,
  type DistributeAxis,
} from './tools/arrange';
import {
  copySelection,
  parseClipboard,
  planPaste,
  serializeClipboard,
  type ClipboardData,
} from './tools/clipboard';
import { allowedRelations, refusalReason } from './tools/relations';
import { snapMove, snapValue } from './tools/snap';

export interface Selection {
  elements: ReadonlySet<ElementId>;
  connectors: ReadonlySet<ConnectorId>;
}

export type EditorTool =
  | { type: 'select' }
  | { type: 'place'; class: ClassId }
  | { type: 'connect'; relation?: RelationId };

export interface EditorHost {
  onSelectionChange?(selection: Selection): void;
  onToolChange?(tool: EditorTool): void;
  /** A short message for the user, such as why a connector was refused. */
  onMessage?(text: string): void;
  /** Called when several relations fit; return the one to use, or null to cancel. */
  chooseRelation?(
    options: RelationDef[],
    screen: Point,
  ): Promise<RelationDef | null> | RelationDef | null;
  /** The user double-clicked an element to edit its text. */
  onEditText?(id: ElementId): void;
}

export interface EditorOptions {
  store: ModelStore;
  tool: ToolLibrary;
  view: CanvasView;
  host?: EditorHost;
  /** Relations offered in the current view; others are not used for new connectors. */
  allowedRelations?: () => ReadonlySet<string> | undefined;
}

/** Pointer moves under this many screen pixels are clicks, not drags. */
const DRAG_THRESHOLD = 3;
const MIN_SIZE = 20;
const EDGE_PX = 6;
const HIT_PX = 6;
const SNAP_PX = 6;
const PASTE_STEP = 20;

type Mode =
  | { kind: 'idle' }
  | {
      kind: 'move';
      start: Point;
      screen: Point;
      ids: ElementId[];
      rects: Map<ElementId, Rect>;
      /** What the moved containers hold; it follows them in the preview and is moved by the command. */
      followers: Map<ElementId, Rect>;
      started: boolean;
      /** A click on an item that was already selected collapses the selection on release. */
      collapseTo: ElementId | null;
    }
  | {
      kind: 'resize';
      id: ElementId;
      handle: HandleName;
      start: Point;
      rect: Rect;
    }
  | { kind: 'band'; screen: Point; additive: boolean; base: Selection }
  | { kind: 'link'; from: ElementId; relation?: RelationId; start: Point }
  | {
      kind: 'bend';
      id: ConnectorId;
      index: number;
      bends: Point[];
      /** True when this drag created the bend point, which then needs a first move to count. */
      inserted: boolean;
      screen: Point;
      moved: boolean;
    }
  | { kind: 'end'; id: ConnectorId; end: 'from' | 'to' };

const emptySelection = (): Selection => ({
  elements: new Set(),
  connectors: new Set(),
});

/** What was last copied in this page, so that paste also works across models without system permissions. */
let memoryClipboard: { data: ClipboardData; pastes: number } | null = null;

/**
 * Turns pointer and keyboard input on a `CanvasView` into commands on a model store. Gestures show
 * a preview on the active layer and execute one command (or one batch) on release, so one undo
 * reverses a gesture. Nothing writes to the store while a gesture is in progress.
 */
export class Editor {
  private selectionState: Selection = emptySelection();
  private mode: Mode = { kind: 'idle' };
  private currentTool: EditorTool = { type: 'select' };
  private readonly cleanups: (() => void)[] = [];
  private readonly store: ModelStore;
  private tool: ToolLibrary;
  private readonly view: CanvasView;
  private readonly host: EditorHost;

  constructor(private readonly options: EditorOptions) {
    this.store = options.store;
    this.tool = options.tool;
    this.view = options.view;
    this.host = options.host ?? {};
    this.install();
    this.cleanups.push(this.view.scene.onChange(() => this.pruneSelection()));
  }

  get selection(): Selection {
    return this.selectionState;
  }

  get activeTool(): EditorTool {
    return this.currentTool;
  }

  private get model(): Model {
    return this.store.state as Model;
  }

  private get scale(): number {
    return this.view.view.s;
  }

  // Tool and selection --------------------------------------------------------------------

  /** Takes a changed tool library (hot reload); the next action follows its rules. */
  useToolLibrary(tool: ToolLibrary): void {
    this.tool = tool;
  }

  setTool(tool: EditorTool): void {
    this.currentTool = tool;
    this.cancelGesture();
    this.view.surface.style.cursor = tool.type === 'select' ? '' : 'crosshair';
    this.host.onToolChange?.(tool);
  }

  select(
    elements: Iterable<ElementId> = [],
    connectors: Iterable<ConnectorId> = [],
  ): void {
    this.setSelection({
      elements: new Set(elements),
      connectors: new Set(connectors),
    });
  }

  clearSelection(): void {
    this.select();
  }

  selectAll(): void {
    this.select(
      this.view.scene.elements.keys(),
      this.view.scene.connectors.keys(),
    );
  }

  private setSelection(selection: Selection): void {
    this.selectionState = selection;
    this.publishActive({});
    this.host.onSelectionChange?.(selection);
  }

  private pruneSelection(): void {
    const { elements, connectors } = this.selectionState;
    const scene = this.view.scene;
    const keptE = [...elements].filter((id) => scene.elements.has(id));
    const keptC = [...connectors].filter((id) => scene.connectors.has(id));
    if (keptE.length !== elements.size || keptC.length !== connectors.size) {
      this.select(keptE, keptC);
    }
  }

  /** Pushes the selection and the given gesture previews to the active layer. */
  private publishActive(extra: Partial<ActiveState>): void {
    const { elements, connectors } = this.selectionState;
    this.view.setActive({
      selectedElements: elements,
      selectedConnectors: connectors,
      handles: elements.size === 1 && connectors.size === 0,
      previews: new Map(),
      routes: new Map(),
      band: null,
      guides: { x: [], y: [] },
      link: null,
      target: null,
      ...extra,
    });
  }

  // Commands --------------------------------------------------------------------------------

  /** Runs commands as one undo step. Returns the result values, or null if nothing was done. */
  run(commands: ModelCommand[]): unknown[] | null {
    if (commands.length === 0) return null;
    try {
      const result =
        commands.length === 1
          ? this.store.execute(commands[0]!)
          : this.store.execute({ type: 'batch', commands });
      if (!result.ok) {
        this.host.onMessage?.(result.reason);
        return null;
      }
      return commands.length === 1
        ? [result.value]
        : Array.isArray(result.value)
          ? result.value
          : [];
    } catch (error) {
      if (error instanceof CommandError) {
        this.host.onMessage?.(error.message);
        return null;
      }
      throw error;
    }
  }

  private gridSize(): number {
    const g = this.tool.settings.grid;
    return g.snap ? g.size : 0;
  }

  /** Creates an element of a class centred at a world point, and selects it. */
  placeAt(cls: ClassId, at: Point): ElementId | null {
    const grid = this.gridSize();
    const x = snapValue(at.x - 60, grid);
    const y = snapValue(at.y - 30, grid);
    // The element's centre decides its container; its default size is the one the command uses.
    const parent = containerAt(
      this.model,
      this.tool,
      this.model.manifest.modelType,
      { x: x + 60, y: y + 30 },
      [],
      cls,
    );
    const values = this.run([
      {
        type: 'createElement',
        class: cls,
        x,
        y,
        ...(parent ? { parent } : {}),
      },
    ]);
    const id = values?.[0] as ElementId | undefined;
    if (id) this.select([id]);
    return id ?? null;
  }

  deleteSelection(): void {
    const { elements, connectors } = this.selectionState;
    const commands: ModelCommand[] = [];
    // Connectors that stay attached to a deleted element go with it, so only free ones are listed.
    for (const id of connectors) {
      const c = this.model.connectors[id];
      if (c && !elements.has(c.from) && !elements.has(c.to))
        commands.push({ type: 'delete', id });
    }
    for (const id of elements) commands.push({ type: 'delete', id });
    this.run(commands);
  }

  /** Moves the selected elements by a world offset (used by arrow keys and tests). */
  nudge(dx: number, dy: number): void {
    this.run(
      // Containers carry their contents, so contents that are selected too stay out of the list.
      outermostOf(this.model, this.selectionState.elements).flatMap((id) => {
        const e = this.model.elements[id];
        return e
          ? [{ type: 'move' as const, id, x: e.x + dx, y: e.y + dy }]
          : [];
      }),
    );
  }

  align(mode: AlignMode): void {
    this.run(
      align(this.selectedPlaced(), mode).map((m) => ({
        type: 'move' as const,
        id: m.id as ElementId,
        x: m.x,
        y: m.y,
      })),
    );
  }

  distribute(axis: DistributeAxis): void {
    this.run(
      distribute(this.selectedPlaced(), axis).map((m) => ({
        type: 'move' as const,
        id: m.id as ElementId,
        x: m.x,
        y: m.y,
      })),
    );
  }

  private selectedPlaced() {
    return [...this.selectionState.elements].flatMap((id) => {
      const e = this.model.elements[id];
      return e ? [{ id, rect: rectOf(e.x, e.y, e.w, e.h) }] : [];
    });
  }

  undo(): void {
    this.store.undo();
  }

  redo(): void {
    this.store.redo();
  }

  // Clipboard ---------------------------------------------------------------------------------

  /** The clipboard text for the selection, or null when no element is selected. */
  copy(): string | null {
    if (this.selectionState.elements.size === 0) return null;
    const data = copySelection(
      this.tool,
      this.model,
      this.selectionState.elements,
    );
    memoryClipboard = { data, pastes: 0 };
    return serializeClipboard(data);
  }

  cut(): string | null {
    const text = this.copy();
    if (text) this.deleteSelection();
    return text;
  }

  /** Pastes clipboard text, or what was last copied in this page when `text` is not given. */
  paste(text?: string): boolean {
    let data = text === undefined ? null : parseClipboard(text);
    let pastes = 0;
    if (!data && memoryClipboard) {
      data = memoryClipboard.data;
      pastes = memoryClipboard.pastes += 1;
    } else if (
      data &&
      memoryClipboard &&
      memoryClipboard.data.elements.length > 0
    ) {
      const sameCopy = serializeClipboard(memoryClipboard.data) === text;
      pastes = sameCopy ? (memoryClipboard.pastes += 1) : 1;
    } else if (data) {
      pastes = 1;
    }
    if (!data) return false;
    const modelType = this.tool.modelTypes[this.model.manifest.modelType];
    if (!modelType) return false;
    const offset = { x: PASTE_STEP * pastes, y: PASTE_STEP * pastes };
    const plan = planPaste(this.tool, modelType, data, offset);
    if (plan.skipped.elements + plan.skipped.connectors > 0) {
      const n = plan.skipped.elements;
      this.host.onMessage?.(
        `${n} item${n === 1 ? '' : 's'} could not be pasted because this model type does not allow them.`,
      );
    }
    if (plan.commands.length === 0) return false;
    if (this.run(plan.commands)) {
      this.select(plan.elements, plan.connectors);
      return true;
    }
    return false;
  }

  // Pointer input -----------------------------------------------------------------------------

  private install(): void {
    const surface = this.view.surface;
    surface.tabIndex = 0;
    surface.style.outline = 'none';
    const on = (
      target: EventTarget,
      type: string,
      handler: (e: never) => void,
    ) => {
      target.addEventListener(type, handler as EventListener);
      this.cleanups.push(() =>
        target.removeEventListener(type, handler as EventListener),
      );
    };
    on(surface, 'pointerdown', (e: PointerEvent) => this.pointerDown(e));
    on(surface, 'pointermove', (e: PointerEvent) => this.pointerMove(e));
    on(surface, 'pointerup', (e: PointerEvent) => this.pointerUp(e));
    on(surface, 'pointercancel', () => this.cancelGesture());
    on(surface, 'dblclick', (e: MouseEvent) => this.doubleClick(e));
    on(window, 'keydown', (e: KeyboardEvent) => this.keyDown(e));
    on(document, 'copy', (e: ClipboardEvent) => this.clipboardEvent('copy', e));
    on(document, 'cut', (e: ClipboardEvent) => this.clipboardEvent('cut', e));
    on(document, 'paste', (e: ClipboardEvent) =>
      this.clipboardEvent('paste', e),
    );
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
  }

  private cancelGesture(): void {
    if (this.mode.kind !== 'idle') {
      this.mode = { kind: 'idle' };
      this.publishActive({});
    }
  }

  private hitTolerance(): number {
    return HIT_PX / this.scale;
  }

  private onlyRelations(): ReadonlySet<string> | undefined {
    return this.options.allowedRelations?.();
  }

  private pointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.view.surface.focus({ preventScroll: true });
    this.view.surface.setPointerCapture(e.pointerId);
    const world = this.view.toWorld(e);
    const screen = this.view.toScreen(e);
    const scene = this.view.scene;

    if (this.currentTool.type === 'place') {
      this.placeAt(this.currentTool.class, world);
      this.setTool({ type: 'select' });
      return;
    }
    if (this.currentTool.type === 'connect') {
      const from = scene.elementAt(world);
      if (from) {
        const relation = this.currentTool.relation;
        this.mode = {
          kind: 'link',
          from: from.id,
          ...(relation ? { relation } : {}),
          start: world,
        };
      }
      return;
    }

    const { elements, connectors } = this.selectionState;
    // 1. Resize handles of a single selected element.
    if (elements.size === 1 && connectors.size === 0) {
      const id = [...elements][0]!;
      const item = scene.elements.get(id);
      if (item) {
        const rect = rectOf(item.x, item.y, item.w, item.h);
        const handle = hitHandle(rect, world, this.scale);
        if (handle) {
          this.mode = { kind: 'resize', id, handle, start: world, rect };
          return;
        }
        // 3. The edge of a selected element starts a connector.
        if (this.onEdge(rect, world)) {
          this.mode = { kind: 'link', from: id, start: world };
          return;
        }
      }
    }
    // 2. Handles and body of a single selected connector.
    if (connectors.size === 1 && elements.size === 0) {
      const id = [...connectors][0]!;
      const item = scene.connectors.get(id);
      if (item && this.startConnectorGesture(item, world, screen)) return;
    }

    // 4. An element.
    const hit = scene.elementAt(world);
    if (hit) {
      const selected = elements.has(hit.id);
      let collapseTo: ElementId | null = null;
      if (e.shiftKey) {
        const next = new Set(elements);
        if (selected) next.delete(hit.id);
        else next.add(hit.id);
        this.setSelection({ elements: next, connectors: new Set(connectors) });
        if (selected) return;
      } else if (!selected) {
        this.setSelection({
          elements: new Set([hit.id]),
          connectors: new Set(),
        });
      } else if (elements.size + connectors.size > 1) {
        collapseTo = hit.id;
      }
      // A container carries its contents, so only the outermost selected elements are moved.
      const ids = outermostOf(this.model, this.selectionState.elements);
      const rects = new Map<ElementId, Rect>();
      for (const id of ids) {
        const it = scene.elements.get(id);
        if (it) rects.set(id, rectOf(it.x, it.y, it.w, it.h));
      }
      const followers = this.followersOf(ids);
      this.mode = {
        kind: 'move',
        start: world,
        screen,
        ids,
        rects,
        followers,
        started: false,
        collapseTo,
      };
      return;
    }

    // 5. A connector.
    const c = scene.connectorAt(world, this.hitTolerance());
    if (c) {
      if (e.shiftKey) {
        const next = new Set(connectors);
        if (next.has(c.id)) next.delete(c.id);
        else next.add(c.id);
        this.setSelection({ elements: new Set(elements), connectors: next });
      } else {
        this.setSelection({ elements: new Set(), connectors: new Set([c.id]) });
      }
      return;
    }

    // 6. Empty space: rubber band.
    this.mode = {
      kind: 'band',
      screen,
      additive: e.shiftKey,
      base: { elements: new Set(elements), connectors: new Set(connectors) },
    };
    if (!e.shiftKey) this.setSelection(emptySelection());
  }

  private onEdge(rect: Rect, p: Point): boolean {
    const pad = EDGE_PX / this.scale;
    const outer = inflate(rect, pad);
    const inner = inflate(rect, -pad);
    const inOuter =
      p.x >= outer.minX &&
      p.x <= outer.maxX &&
      p.y >= outer.minY &&
      p.y <= outer.maxY;
    const inInner =
      inner.minX < inner.maxX &&
      inner.minY < inner.maxY &&
      p.x > inner.minX &&
      p.x < inner.maxX &&
      p.y > inner.minY &&
      p.y < inner.maxY;
    return inOuter && !inInner;
  }

  /** Starts dragging an end, a bend point or the body of the selected connector. */
  private startConnectorGesture(
    item: ConnectorItem,
    world: Point,
    screen: Point,
  ): boolean {
    const reach = (HIT_PX + 2) / this.scale;
    const first = item.route[0]!;
    const last = item.route[item.route.length - 1]!;
    if (Math.hypot(world.x - first.x, world.y - first.y) <= reach) {
      this.mode = { kind: 'end', id: item.id, end: 'from' };
      return true;
    }
    if (Math.hypot(world.x - last.x, world.y - last.y) <= reach) {
      this.mode = { kind: 'end', id: item.id, end: 'to' };
      return true;
    }
    const bendIndex = item.bends.findIndex(
      (b) => Math.hypot(world.x - b.x, world.y - b.y) <= reach,
    );
    if (bendIndex >= 0) {
      this.mode = {
        kind: 'bend',
        id: item.id,
        index: bendIndex,
        bends: item.bends.map((b) => ({ ...b })),
        inserted: false,
        screen,
        moved: false,
      };
      return true;
    }
    if (distanceToPolyline(world, item.route) <= this.hitTolerance()) {
      // Dragging the line itself pulls a new bend point out of it.
      const segment = nearestSegment(world, item.route);
      const index =
        item.bends.length === 0 ? 0 : Math.min(segment, item.bends.length);
      const bends = item.bends.map((b) => ({ ...b }));
      bends.splice(index, 0, { ...world });
      this.mode = {
        kind: 'bend',
        id: item.id,
        index,
        bends,
        inserted: true,
        screen,
        moved: false,
      };
      return true;
    }
    return false;
  }

  private pointerMove(e: PointerEvent): void {
    const world = this.view.toWorld(e);
    const screen = this.view.toScreen(e);
    const mode = this.mode;
    switch (mode.kind) {
      case 'idle':
        this.updateCursor(world);
        return;
      case 'move':
        this.moveGesture(mode, world, screen, e.altKey);
        return;
      case 'resize':
        this.resizeGesture(mode, world, e.altKey);
        return;
      case 'band': {
        const band = {
          minX: Math.min(mode.screen.x, screen.x),
          minY: Math.min(mode.screen.y, screen.y),
          maxX: Math.max(mode.screen.x, screen.x),
          maxY: Math.max(mode.screen.y, screen.y),
        };
        this.publishActive({
          selectedElements: this.selectionState.elements,
          selectedConnectors: this.selectionState.connectors,
          handles: false,
          band,
        });
        return;
      }
      case 'link':
        this.linkGesture(mode, world);
        return;
      case 'bend':
        this.bendGesture(mode, world, screen);
        return;
      case 'end':
        this.endGesture(mode, world);
        return;
    }
  }

  private updateCursor(world: Point): void {
    if (this.currentTool.type !== 'select') return;
    const surface = this.view.surface;
    const { elements, connectors } = this.selectionState;
    if (elements.size === 1 && connectors.size === 0) {
      const item = this.view.scene.elements.get([...elements][0]!);
      if (item) {
        const rect = rectOf(item.x, item.y, item.w, item.h);
        const handle = hitHandle(rect, world, this.scale);
        if (handle) {
          surface.style.cursor = CURSORS[handle];
          return;
        }
        if (this.onEdge(rect, world)) {
          surface.style.cursor = 'crosshair';
          return;
        }
      }
    }
    surface.style.cursor = this.view.scene.elementAt(world) ? 'move' : '';
  }

  private moveGesture(
    mode: Extract<Mode, { kind: 'move' }>,
    world: Point,
    screen: Point,
    noSnap: boolean,
  ): void {
    if (
      !mode.started &&
      Math.hypot(screen.x - mode.screen.x, screen.y - mode.screen.y) <
        DRAG_THRESHOLD
    )
      return;
    mode.started = true;
    const delta = this.snappedDelta(mode, world, noSnap);
    const previews = new Map<ElementId, Rect>();
    for (const rects of [mode.rects, mode.followers])
      for (const [id, r] of rects)
        previews.set(id, {
          minX: r.minX + delta.dx,
          minY: r.minY + delta.dy,
          maxX: r.maxX + delta.dx,
          maxY: r.maxY + delta.dy,
        });
    this.publishActive({
      selectedElements: this.selectionState.elements,
      selectedConnectors: this.selectionState.connectors,
      handles: false,
      previews,
      guides: delta.guides,
      target: this.dropTarget(mode, delta),
    });
  }

  /** The rectangles of everything inside the given elements, found in one pass over the model. */
  private followersOf(ids: readonly ElementId[]): Map<ElementId, Rect> {
    const found = new Map<ElementId, Rect>();
    const scene = this.view.scene;
    const containers = ids.filter((id) => {
      const cls = scene.elements.get(id)?.cls;
      return cls !== undefined && isContainerClass(this.tool, cls);
    });
    if (containers.length === 0) return found;
    const index = childrenIndex(this.model);
    for (const id of containers)
      for (const d of descendantsOf(this.model, id, index)) {
        const it = scene.elements.get(d);
        if (it) found.set(d, rectOf(it.x, it.y, it.w, it.h));
      }
    return found;
  }

  /** The container the first dragged element would land in, for the highlight and the drop. */
  private dropTarget(
    mode: Extract<Mode, { kind: 'move' }>,
    delta: { dx: number; dy: number },
  ): ElementId | null {
    const id = mode.ids[0];
    const r = id ? mode.rects.get(id) : undefined;
    const cls = id ? this.model.elements[id]?.class : undefined;
    if (!r || !id || !cls) return null;
    return containerAt(
      this.model,
      this.tool,
      this.model.manifest.modelType,
      {
        x: (r.minX + r.maxX) / 2 + delta.dx,
        y: (r.minY + r.maxY) / 2 + delta.dy,
      },
      [id],
      cls,
    );
  }

  private snappedDelta(
    mode: Extract<Mode, { kind: 'move' }>,
    world: Point,
    noSnap: boolean,
  ) {
    let dx = world.x - mode.start.x;
    let dy = world.y - mode.start.y;
    let guides: { x: number[]; y: number[] } = { x: [], y: [] };
    if (!noSnap) {
      const rects = [...mode.rects.values()];
      const moving = rects.reduce((a, b) => union(a, b));
      const shifted = {
        minX: moving.minX + dx,
        minY: moving.minY + dy,
        maxX: moving.maxX + dx,
        maxY: moving.maxY + dy,
      };
      const threshold = SNAP_PX / this.scale;
      const near = this.view.scene
        .search(inflate(shifted, threshold * 4 + 20))
        .filter(
          (b) =>
            b.kind === 'element' &&
            !mode.rects.has(b.id as ElementId) &&
            !mode.followers.has(b.id as ElementId),
        );
      const snap = snapMove(shifted, near, {
        grid: this.gridSize(),
        threshold,
      });
      dx += snap.dx;
      dy += snap.dy;
      guides = snap.guides;
    }
    return { dx, dy, guides };
  }

  private resizeGesture(
    mode: Extract<Mode, { kind: 'resize' }>,
    world: Point,
    noSnap: boolean,
  ): void {
    const rect = this.resizedRect(mode, world, noSnap);
    this.publishActive({
      selectedElements: this.selectionState.elements,
      selectedConnectors: this.selectionState.connectors,
      handles: true,
      previews: new Map([[mode.id, rect]]),
    });
  }

  private resizedRect(
    mode: Extract<Mode, { kind: 'resize' }>,
    world: Point,
    noSnap: boolean,
  ): Rect {
    const grid = noSnap ? 0 : this.gridSize();
    let dx = world.x - mode.start.x;
    let dy = world.y - mode.start.y;
    if (grid > 0) {
      // Snap the edge that moves, not the offset.
      const moved = resizeRect(mode.rect, mode.handle, dx, dy, MIN_SIZE);
      if (mode.handle.includes('w'))
        dx += snapValue(moved.minX, grid) - moved.minX;
      if (mode.handle.includes('e'))
        dx += snapValue(moved.maxX, grid) - moved.maxX;
      if (mode.handle.includes('n'))
        dy += snapValue(moved.minY, grid) - moved.minY;
      if (mode.handle.includes('s'))
        dy += snapValue(moved.maxY, grid) - moved.maxY;
    }
    return resizeRect(mode.rect, mode.handle, dx, dy, MIN_SIZE);
  }

  private linkTarget(
    from: ElementItem,
    world: Point,
    relation?: RelationId,
  ): {
    target: ElementItem | undefined;
    options: RelationDef[];
    reason: string;
  } {
    const target = this.view.scene.elementAt(world);
    if (!target) return { target, options: [], reason: '' };
    const modelType = this.tool.modelTypes[this.model.manifest.modelType];
    if (!modelType || target.id === from.id)
      return {
        target,
        options: [],
        reason: 'A connector needs two different elements.',
      };
    let options = allowedRelations(
      this.tool,
      modelType,
      from.cls,
      target.cls,
      this.onlyRelations(),
    );
    const wanted = relation ? this.tool.relations[relation] : undefined;
    if (wanted) options = options.filter((r) => r.id === relation);
    return {
      target,
      options,
      reason:
        options.length === 0
          ? refusalReason(this.tool, from.cls, target.cls, wanted)
          : '',
    };
  }

  private linkGesture(
    mode: Extract<Mode, { kind: 'link' }>,
    world: Point,
  ): void {
    const from = this.view.scene.elements.get(mode.from);
    if (!from) return;
    const { target, options } = this.linkTarget(from, world, mode.relation);
    const origin = edgePoint(from, world);
    this.publishActive({
      selectedElements: this.selectionState.elements,
      selectedConnectors: this.selectionState.connectors,
      handles: false,
      link: { from: origin, to: world, ok: options.length > 0 },
      target: target && target.id !== from.id ? target.id : null,
    });
  }

  private bendGesture(
    mode: Extract<Mode, { kind: 'bend' }>,
    world: Point,
    screen: Point,
  ): void {
    if (
      !mode.moved &&
      Math.hypot(screen.x - mode.screen.x, screen.y - mode.screen.y) <
        DRAG_THRESHOLD
    )
      return;
    mode.moved = true;
    const grid = this.gridSize();
    mode.bends[mode.index] = {
      x: snapValue(world.x, grid),
      y: snapValue(world.y, grid),
    };
    const item = this.view.scene.connectors.get(mode.id);
    if (!item) return;
    this.publishActive({
      selectedElements: this.selectionState.elements,
      selectedConnectors: this.selectionState.connectors,
      handles: false,
      routes: new Map([
        [mode.id, this.view.scene.routeWithBends(item, mode.bends)],
      ]),
    });
  }

  private endGesture(mode: Extract<Mode, { kind: 'end' }>, world: Point): void {
    const item = this.view.scene.connectors.get(mode.id);
    if (!item) return;
    const fixedId = mode.end === 'from' ? item.to : item.from;
    const fixed = this.view.scene.elements.get(fixedId);
    if (!fixed) return;
    const target = this.view.scene.elementAt(world);
    const ok = target ? this.endAllowed(item, mode.end, target) : false;
    const fixedPoint = edgePoint(fixed, world);
    this.publishActive({
      selectedElements: this.selectionState.elements,
      selectedConnectors: this.selectionState.connectors,
      handles: false,
      link: { from: fixedPoint, to: world, ok },
      target: target && target.id !== fixedId ? target.id : null,
    });
  }

  private endAllowed(
    item: ConnectorItem,
    end: 'from' | 'to',
    target: ElementItem,
  ): boolean {
    const modelType = this.tool.modelTypes[this.model.manifest.modelType];
    const other = this.view.scene.elements.get(
      end === 'from' ? item.to : item.from,
    );
    if (!modelType || !other) return false;
    const [fromClass, toClass] =
      end === 'from' ? [target.cls, other.cls] : [other.cls, target.cls];
    return allowedRelations(this.tool, modelType, fromClass, toClass).some(
      (r) => r.id === item.relation,
    );
  }

  private async pointerUp(e: PointerEvent): Promise<void> {
    const mode = this.mode;
    this.mode = { kind: 'idle' };
    const world = this.view.toWorld(e);
    const screen = this.view.toScreen(e);
    switch (mode.kind) {
      case 'idle':
        return;
      case 'move': {
        if (!mode.started) {
          if (mode.collapseTo) this.select([mode.collapseTo]);
          this.publishActive({});
          return;
        }
        const delta = this.snappedDelta(mode, world, e.altKey);
        this.publishActive({});
        this.run(
          [...mode.rects].flatMap(([id, r]) =>
            delta.dx === 0 && delta.dy === 0
              ? []
              : [
                  {
                    type: 'move' as const,
                    id,
                    x: r.minX + delta.dx,
                    y: r.minY + delta.dy,
                    // Where it lands decides its container; the command works that out.
                    drop: true,
                  },
                ],
          ),
        );
        return;
      }
      case 'resize': {
        const rect = this.resizedRect(mode, world, e.altKey);
        this.publishActive({});
        if (
          rect.minX === mode.rect.minX &&
          rect.minY === mode.rect.minY &&
          rect.maxX === mode.rect.maxX &&
          rect.maxY === mode.rect.maxY
        )
          return;
        this.run([
          {
            type: 'resize',
            id: mode.id,
            x: rect.minX,
            y: rect.minY,
            w: rect.maxX - rect.minX,
            h: rect.maxY - rect.minY,
          },
        ]);
        return;
      }
      case 'band': {
        const band = rectOf(
          Math.min(mode.screen.x, screen.x),
          Math.min(mode.screen.y, screen.y),
          Math.abs(screen.x - mode.screen.x),
          Math.abs(screen.y - mode.screen.y),
        );
        if (
          band.maxX - band.minX < DRAG_THRESHOLD &&
          band.maxY - band.minY < DRAG_THRESHOLD
        ) {
          this.publishActive({});
          return;
        }
        const topLeft = this.screenToWorld({ x: band.minX, y: band.minY });
        const bottomRight = this.screenToWorld({ x: band.maxX, y: band.maxY });
        const area: Rect = {
          minX: topLeft.x,
          minY: topLeft.y,
          maxX: bottomRight.x,
          maxY: bottomRight.y,
        };
        const elements = new Set(mode.additive ? mode.base.elements : []);
        const connectors = new Set(mode.additive ? mode.base.connectors : []);
        for (const item of this.view.scene.itemsIn(area, true)) {
          if (item.kind === 'element') elements.add(item.id);
          else connectors.add(item.id);
        }
        this.setSelection({ elements, connectors });
        return;
      }
      case 'link': {
        this.publishActive({});
        const from = this.view.scene.elements.get(mode.from);
        if (!from) return;
        const { target, options, reason } = this.linkTarget(
          from,
          world,
          mode.relation,
        );
        if (!target) return;
        if (options.length === 0) {
          if (reason) this.host.onMessage?.(reason);
          return;
        }
        let relation: RelationDef | null = options[0]!;
        if (options.length > 1 && this.host.chooseRelation) {
          relation = await this.host.chooseRelation(options, screen);
        }
        if (!relation) return;
        const values = this.run([
          {
            type: 'createConnector',
            relation: relation.id,
            from: from.id,
            to: target.id,
          },
        ]);
        const id = values?.[0] as ConnectorId | undefined;
        if (id) this.select([], [id]);
        return;
      }
      case 'bend': {
        this.publishActive({});
        if (!mode.moved) return;
        this.run([{ type: 'setBends', id: mode.id, bends: mode.bends }]);
        return;
      }
      case 'end': {
        this.publishActive({});
        const item = this.view.scene.connectors.get(mode.id);
        const target = this.view.scene.elementAt(world);
        if (!item || !target) return;
        const current = mode.end === 'from' ? item.from : item.to;
        if (target.id === current) return;
        if (!this.endAllowed(item, mode.end, target)) {
          const other = this.view.scene.elements.get(
            mode.end === 'from' ? item.to : item.from,
          );
          const relation = this.tool.relations[item.relation];
          if (other)
            this.host.onMessage?.(
              refusalReason(
                this.tool,
                mode.end === 'from' ? target.cls : other.cls,
                mode.end === 'from' ? other.cls : target.cls,
                relation,
              ),
            );
          return;
        }
        this.run([{ type: 'reconnect', id: mode.id, [mode.end]: target.id }]);
        return;
      }
    }
  }

  private screenToWorld(p: Point): Point {
    const v = this.view.view;
    return { x: (p.x - v.ox) / v.s, y: (p.y - v.oy) / v.s };
  }

  private doubleClick(e: MouseEvent): void {
    if (this.currentTool.type !== 'select') return;
    const world = this.view.toWorld(e);
    const scene = this.view.scene;
    // A bend point of the selected connector is removed.
    const { connectors } = this.selectionState;
    if (connectors.size === 1) {
      const item = scene.connectors.get([...connectors][0]!);
      if (item) {
        const reach = (HIT_PX + 2) / this.scale;
        const index = item.bends.findIndex(
          (b) => Math.hypot(world.x - b.x, world.y - b.y) <= reach,
        );
        if (index >= 0) {
          this.run([
            {
              type: 'setBends',
              id: item.id,
              bends: item.bends.filter((_, i) => i !== index),
            },
          ]);
          return;
        }
      }
    }
    const element = scene.elementAt(world);
    if (element) {
      this.host.onEditText?.(element.id);
      return;
    }
    const connector = scene.connectorAt(world, this.hitTolerance());
    if (connector) {
      const segment = nearestSegment(world, connector.route);
      const index =
        connector.bends.length === 0
          ? 0
          : Math.min(segment, connector.bends.length);
      const bends = connector.bends.map((b) => ({ ...b }));
      bends.splice(index, 0, {
        x: snapValue(world.x, this.gridSize()),
        y: snapValue(world.y, this.gridSize()),
      });
      this.run([{ type: 'setBends', id: connector.id, bends }]);
      this.select([], [connector.id]);
    }
  }

  // Keyboard ----------------------------------------------------------------------------------

  /** Keys count only when nothing else (a field, a dialog) has the focus. */
  private keyboardIsOurs(target: EventTarget | null): boolean {
    if (isTyping(target)) return false;
    const active = document.activeElement;
    return (
      active === document.body ||
      active === this.view.surface ||
      active === null
    );
  }

  private keyDown(e: KeyboardEvent): void {
    // Undo and redo also work after clicking a button or a choice in the panel; only a field the
    // user types in keeps its own text undo.
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && (key === 'z' || key === 'y') && !isTyping(e.target)) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (!this.keyboardIsOurs(e.target)) return;
    if (mod && key === 'a') {
      e.preventDefault();
      this.selectAll();
    } else if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      this.deleteSelection();
    } else if (key === 'escape') {
      if (this.mode.kind !== 'idle') this.cancelGesture();
      else if (this.currentTool.type !== 'select')
        this.setTool({ type: 'select' });
      else this.clearSelection();
    } else if (key.startsWith('arrow') && !mod) {
      e.preventDefault();
      const step = (this.tool.settings.grid.size || 10) * (e.shiftKey ? 5 : 1);
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      this.nudge(dx, dy);
    }
  }

  private clipboardEvent(
    kind: 'copy' | 'cut' | 'paste',
    e: ClipboardEvent,
  ): void {
    if (!this.keyboardIsOurs(e.target)) return;
    if (kind === 'paste') {
      const text = e.clipboardData?.getData('text/plain');
      if (this.paste(text)) e.preventDefault();
      return;
    }
    const text = kind === 'copy' ? this.copy() : this.cut();
    if (text && e.clipboardData) {
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
    }
  }
}
