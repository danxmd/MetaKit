import {
  isFormula,
  type AttributeDef,
  type Json,
  type NodeShape,
  type Part,
  type ShapeDef,
  type ShapeId,
} from '@metakit-app/core';
import {
  addPart,
  buildColourFormula,
  completeNames,
  compileNode,
  defaultPart,
  duplicatePart,
  getPart,
  getPartProp,
  groupParts,
  hitTestParts,
  importSvg,
  isPrefix,
  makeScope,
  movePart,
  parseColourFormula,
  removePart,
  reorderPart,
  resizePart,
  resolvePartBoxes,
  samePath,
  sampleValuesFor,
  setLet,
  setPartProp,
  starterShape,
  switchToFixed,
  switchToFormula,
  ungroupPart,
  type ColourFormula,
  type ColourMapping,
  type Completion,
  type Compiled,
  type EditablePartType,
  type PartBox,
  type PartPath,
  type ReorderMove,
  type SvgImportMode,
  type SvgImportResult,
} from '@metakit-app/shapes';

export const PREVIEW_SCALES = [0.5, 1, 2] as const;
const MAX_HISTORY = 200;

/** What changed, for views that redraw. */
export type EditorEvent = 'shape' | 'selection' | 'samples';

export interface ShapeEditorOptions {
  shape: NodeShape;
  /** Effective attributes of the class the shape is previewed for; may be empty. */
  attributes?: readonly AttributeDef[];
  className?: string;
  shapes?: (id: ShapeId) => ShapeDef | undefined;
}

export interface Preview {
  scale: number;
  /** Size in pixels at this scale. */
  width: number;
  height: number;
  compiled: Compiled;
}

const COLOUR_FALLBACK = '#868E96';
const PREVIEW_FILL = '#E7F5FF';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * The state of the shape editor without any screen: the draft, the selection, undo, sample values
 * and the previews. Every edit is a call here, so the editor can be tested and driven from code.
 */
export class ShapeEditorModel {
  private shapeValue: NodeShape;
  private selected: PartPath[] = [];
  private undoStack: NodeShape[] = [];
  private redoStack: NodeShape[] = [];
  private gesture: 'off' | 'armed' | 'pushed' = 'off';
  private readonly shapeListeners = new Set<(shape: NodeShape) => void>();
  private readonly listeners = new Set<(event: EditorEvent) => void>();
  private sampleValues: Record<string, Json>;
  private previewCache = new Map<
    number,
    { shape: NodeShape; samples: Record<string, Json>; preview: Preview }
  >();

  readonly previewScales = PREVIEW_SCALES;
  attributes: readonly AttributeDef[];
  className: string;
  private readonly lookup: (id: ShapeId) => ShapeDef | undefined;

  constructor(options: ShapeEditorOptions) {
    this.shapeValue = options.shape;
    this.attributes = options.attributes ?? [];
    this.className = options.className ?? '';
    this.lookup = options.shapes ?? (() => undefined);
    this.sampleValues = sampleValuesFor(this.attributes);
  }

  // State ------------------------------------------------------------------------------------

  /** The shape being edited. */
  get draft(): NodeShape {
    return this.shapeValue;
  }

  /** The part that was selected last, or null. */
  get selection(): PartPath | null {
    return this.selected[this.selected.length - 1] ?? null;
  }

  /** Every selected part; the last is the one the properties panel shows. */
  get selectedPaths(): readonly PartPath[] {
    return this.selected;
  }

  get selectedPart(): Part | undefined {
    const s = this.selection;
    return s ? getPart(this.shapeValue, s) : undefined;
  }

  get samples(): Record<string, Json> {
    return this.sampleValues;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Called with the new shape after every edit, undo and redo, so the host can store it. */
  onChange(fn: (shape: NodeShape) => void): () => void {
    this.shapeListeners.add(fn);
    return () => this.shapeListeners.delete(fn);
  }

  /** Called for every change of the shape, the selection or the sample values. */
  subscribe(fn: (event: EditorEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(event: EditorEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  /** Replaces the draft with an edited shape, remembering the old one for undo. */
  private commit(next: NodeShape, selection?: readonly PartPath[]): void {
    if (next !== this.shapeValue) {
      if (this.gesture !== 'pushed') {
        this.undoStack.push(this.shapeValue);
        if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
        if (this.gesture === 'armed') this.gesture = 'pushed';
      }
      this.redoStack = [];
      this.shapeValue = next;
    }
    if (selection !== undefined) this.selected = [...selection];
    else this.dropStaleSelection();
  }

  private dropStaleSelection(): void {
    this.selected = this.selected.filter(
      (p) => getPart(this.shapeValue, p) !== undefined,
    );
  }

  private afterEdit(): void {
    this.emit('shape');
    // During a drag the host is told once at the end, not on every pixel.
    if (this.gesture !== 'off') this.gesturePending = true;
    else this.notifyShape();
  }

  private gesturePending = false;

  private notifyShape(): void {
    this.gesturePending = false;
    for (const fn of this.shapeListeners) fn(this.shapeValue);
  }

  /** Runs one edit; the shape listeners and views hear about it once. */
  private edit(next: NodeShape, selection?: readonly PartPath[]): boolean {
    const changed = next !== this.shapeValue;
    this.commit(next, selection);
    if (changed) this.afterEdit();
    else if (selection !== undefined) this.emit('selection');
    return changed;
  }

  /**
   * Marks the start of a drag: all edits until `endGesture` become one undo step. Views follow
   * every move through `subscribe`, while `onChange` listeners hear the final shape once.
   */
  beginGesture(): void {
    this.gesture = 'armed';
  }

  endGesture(): void {
    this.gesture = 'off';
    if (this.gesturePending) this.notifyShape();
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.shapeValue);
    this.shapeValue = prev;
    this.dropStaleSelection();
    this.afterEdit();
    this.emit('selection');
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.shapeValue);
    this.shapeValue = next;
    this.dropStaleSelection();
    this.afterEdit();
    this.emit('selection');
  }

  // Selection --------------------------------------------------------------------------------

  select(path: PartPath | null): void {
    this.selected = path && getPart(this.shapeValue, path) ? [path] : [];
    this.emit('selection');
  }

  /** Adds a part to the selection, or removes it when it is already in it. */
  toggleSelect(path: PartPath): void {
    if (!getPart(this.shapeValue, path)) return;
    const at = this.selected.findIndex((p) => samePath(p, path));
    if (at >= 0) this.selected = this.selected.filter((_, i) => i !== at);
    else this.selected = [...this.selected, path];
    this.emit('selection');
  }

  isSelected(path: PartPath): boolean {
    return this.selected.some((p) => samePath(p, path));
  }

  /** Part boxes at the shape's own size, for handles and hit testing. */
  boxes(): PartBox[] {
    return resolvePartBoxes(
      this.shapeValue,
      this.shapeValue.size.width,
      this.shapeValue.size.height,
    );
  }

  boxOf(path: PartPath): PartBox | undefined {
    return this.boxes().find((b) => samePath(b.path, path));
  }

  /** Selects the topmost part at a point in shape pixels; selects nothing on empty space. */
  selectAt(x: number, y: number): PartPath | null {
    const hit = hitTestParts(this.boxes(), x, y);
    this.select(hit);
    return hit;
  }

  // Edits ------------------------------------------------------------------------------------

  /** Adds a part; into the selected group when a group is selected. Returns its path. */
  addPart(type: EditablePartType): PartPath {
    return this.addCustomPart(defaultPart(type));
  }

  addCustomPart(part: Part): PartPath {
    const sel = this.selectedPart;
    const parent =
      sel?.type === 'group' && this.selection ? this.selection : [];
    const r = addPart(this.shapeValue, part, parent);
    this.edit(r.shape, [r.path]);
    return r.path;
  }

  removeSelected(): void {
    let next = this.shapeValue;
    // Deepest and last first, so earlier paths stay valid.
    const order = [...this.selected].sort(
      (a, b) => b.length - a.length || b[b.length - 1]! - a[a.length - 1]!,
    );
    for (const p of order) next = removePart(next, p);
    this.edit(next, []);
  }

  remove(path: PartPath): void {
    this.edit(
      removePart(this.shapeValue, path),
      this.selected.filter((p) => !isPrefix(path, p)),
    );
  }

  moveSelected(dx: number, dy: number): void {
    let next = this.shapeValue;
    for (const p of this.selected) next = movePart(next, p, dx, dy);
    this.edit(next);
  }

  resizeSelected(change: {
    dw?: number;
    dh?: number;
    dx?: number;
    dy?: number;
  }): void {
    const p = this.selection;
    if (p) this.edit(resizePart(this.shapeValue, p, change));
  }

  reorder(path: PartPath, move: ReorderMove): PartPath {
    const r = reorderPart(this.shapeValue, path, move);
    const wasSelected = this.isSelected(path);
    this.edit(r.shape, wasSelected ? [r.path] : undefined);
    return r.path;
  }

  groupSelected(): PartPath | null {
    const r = groupParts(this.shapeValue, this.selected);
    if (r.shape === this.shapeValue) return null;
    this.edit(r.shape, [r.path]);
    return r.path;
  }

  ungroupSelected(): void {
    const p = this.selection;
    if (!p) return;
    const r = ungroupPart(this.shapeValue, p);
    this.edit(r.shape, r.paths);
  }

  duplicateSelected(): PartPath | null {
    const p = this.selection;
    if (!p) return null;
    const r = duplicatePart(this.shapeValue, p);
    this.edit(r.shape, [r.path]);
    return r.path;
  }

  /** Sets a property of a part (the selected one by default); `undefined` clears it. */
  setProp(prop: string, value: unknown, path?: PartPath): void {
    const p = path ?? this.selection;
    if (p) this.edit(setPartProp(this.shapeValue, p, prop, value));
  }

  getProp(prop: string, path?: PartPath): unknown {
    const p = path ?? this.selection;
    const part = p ? getPart(this.shapeValue, p) : undefined;
    return part ? getPartProp(part, prop) : undefined;
  }

  isFormulaProp(prop: string, path?: PartPath): boolean {
    return isFormula(this.getProp(prop, path));
  }

  /** The *fx* switch: a fixed value becomes the formula that gives it. */
  toFormula(prop: string, fallback?: unknown, path?: PartPath): void {
    const p = path ?? this.selection;
    if (p) this.edit(switchToFormula(this.shapeValue, p, prop, fallback));
  }

  /** The *fx* switch off: a literal formula becomes its value, anything else `fallback`. */
  toFixed(prop: string, fallback: unknown, path?: PartPath): void {
    const p = path ?? this.selection;
    if (p) this.edit(switchToFixed(this.shapeValue, p, prop, fallback));
  }

  /** The fixed visible flag of the layer list: hidden parts are stored as `visible: false`. */
  setVisible(path: PartPath, visible: boolean): void {
    this.setProp('visible', visible ? undefined : false, path);
  }

  isVisibleFixed(path: PartPath): boolean {
    return this.getProp('visible', path) !== false;
  }

  setLet(name: string, formula: string | undefined): void {
    this.edit(setLet(this.shapeValue, name, formula));
  }

  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.edit({
      ...this.shapeValue,
      size: { ...this.shapeValue.size, width: w, height: h },
    });
  }

  setName(name: string): void {
    const { name: _old, ...rest } = this.shapeValue;
    void _old;
    this.edit(name.trim() === '' ? (rest as NodeShape) : { ...rest, name });
  }

  // Colour by attribute ----------------------------------------------------------------------

  /** Writes the value-to-colour formula into a property such as `fill` or `stroke`. */
  applyColourMap(
    path: PartPath,
    prop: string,
    attribute: string,
    mapping: readonly ColourMapping[],
    fallback = COLOUR_FALLBACK,
  ): void {
    this.setProp(prop, buildColourFormula(attribute, mapping, fallback), path);
  }

  /** The mapping stored in a property, when it was written by the helper; else null. */
  colourMapOf(path: PartPath, prop: string): ColourFormula | null {
    const v = this.getProp(prop, path);
    return typeof v === 'string' ? parseColourFormula(v) : null;
  }

  /** Attributes the helper can map: choices and booleans. */
  mappableAttributes(): AttributeDef[] {
    return this.attributes.filter(
      (a) => a.type === 'choice' || a.type === 'boolean',
    );
  }

  /** The values to give colours to for an attribute: its options, or true and false. */
  valuesOf(attribute: string): (string | boolean)[] {
    const def = this.attributes.find((a) => a.key === attribute);
    if (!def) return [];
    if (def.type === 'boolean') return [true, false];
    if (def.type === 'choice')
      return def.options.map((o) => (typeof o === 'string' ? o : o.value));
    return [];
  }

  // Import and gallery -----------------------------------------------------------------------

  /**
   * Adds the parts of an SVG file (or the file as one image). An empty shape also takes the size
   * of the drawing. Returns what was converted and what was skipped, for the screen to show.
   */
  importSvg(text: string, mode: SvgImportMode): SvgImportResult {
    const result = importSvg(text, mode);
    if (result.parts.length === 0) return result;
    let next: NodeShape = this.shapeValue;
    if (next.parts.length === 0)
      next = {
        ...next,
        size: {
          ...next.size,
          width: result.size.width,
          height: result.size.height,
        },
      };
    const start = next.parts.length;
    next = { ...next, parts: [...next.parts, ...result.parts] };
    this.edit(
      next,
      result.parts.map((_, i) => [start + i]),
    );
    return result;
  }

  /**
   * Adds a copy of a starter shape. An empty draft becomes the starter (size, outline, names and
   * parts); otherwise its parts are added as one group so nothing already drawn is lost.
   */
  addFromGallery(starterId: string): boolean {
    const starter = starterShape(starterId);
    if (!starter || starter.kind !== 'node') return false;
    const copy = clone(starter);
    let next: NodeShape;
    let selection: PartPath[];
    if (this.shapeValue.parts.length === 0) {
      next = {
        ...this.shapeValue,
        size: copy.size,
        ...(copy.outline === undefined ? {} : { outline: copy.outline }),
        ...(copy.let === undefined ? {} : { let: copy.let }),
        parts: copy.parts,
        ...(copy.variants === undefined ? {} : { variants: copy.variants }),
      };
      selection = [];
    } else {
      const lets = { ...copy.let, ...this.shapeValue.let };
      next = {
        ...this.shapeValue,
        ...(Object.keys(lets).length === 0 ? {} : { let: lets }),
        parts: [
          ...this.shapeValue.parts,
          {
            type: 'group',
            x: 0,
            y: 0,
            width: '100%',
            height: '100%',
            parts: copy.parts,
          },
        ],
      };
      selection = [[this.shapeValue.parts.length]];
    }
    this.edit(next, selection);
    return true;
  }

  // Samples and previews ---------------------------------------------------------------------

  setSample(attributeId: string, value: Json): void {
    this.sampleValues = { ...this.sampleValues, [attributeId]: value };
    this.emit('samples');
  }

  /** Replaces the attributes the shape is previewed for, keeping the values already typed in. */
  setAttributes(attributes: readonly AttributeDef[], className?: string): void {
    this.attributes = attributes;
    if (className !== undefined) this.className = className;
    const fresh = sampleValuesFor(attributes);
    this.sampleValues = Object.fromEntries(
      attributes.map((a) => [
        a.id,
        a.id in this.sampleValues ? this.sampleValues[a.id]! : fresh[a.id]!,
      ]),
    );
    this.emit('samples');
  }

  /** The draft drawn at `scale` times its own size with the sample values. */
  compilePreview(scale: number): Preview {
    const hit = this.previewCache.get(scale);
    if (
      hit &&
      hit.shape === this.shapeValue &&
      hit.samples === this.sampleValues
    )
      return hit.preview;
    const width = Math.max(1, Math.round(this.shapeValue.size.width * scale));
    const height = Math.max(1, Math.round(this.shapeValue.size.height * scale));
    const firstText = this.attributes.find(
      (a) =>
        a.type === 'text' &&
        typeof this.sampleValues[a.id] === 'string' &&
        this.sampleValues[a.id] !== '',
    );
    const label =
      firstText !== undefined
        ? (this.sampleValues[firstText.id] as string)
        : this.className;
    const scope = makeScope(
      this.attributes,
      this.sampleValues,
      {
        label,
        className: this.className,
        w: width,
        h: height,
        fill: PREVIEW_FILL,
      },
      firstText?.key,
    );
    const compiled = compileNode(this.shapeValue, {
      w: width,
      h: height,
      scope,
      shapes: this.lookup,
    });
    const preview: Preview = { scale, width, height, compiled };
    this.previewCache.set(scale, {
      shape: this.shapeValue,
      samples: this.sampleValues,
      preview,
    });
    return preview;
  }

  // Completion -------------------------------------------------------------------------------

  complete(prefix: string): Completion[] {
    return completeNames(prefix, {
      attributes: this.attributes.map((a) => a.key),
      lets: Object.keys(this.shapeValue.let ?? {}),
    });
  }
}
