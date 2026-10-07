import {
  idKind,
  isId,
  newId,
  type AttributeId,
  type ClassId,
  type ConnectorId,
  type ElementId,
  type RandomSource,
  type RelationId,
} from '../ids';
import { run } from '@metakit-app/formula';
import { deepEqual, type Json } from '../json';
import {
  effectiveAttributes,
  effectiveRelationAttributes,
} from '../meta/inherit';
import type { AttributeDef, ToolLibrary } from '../meta/types';
import {
  DocumentStore,
  type BatchCommand,
  type DocumentKind,
} from '../store/store';
import { positionBetween } from '../store/position';
import { CommandError, requireJson, type Tx } from '../store/tx';
import {
  FIT_PADDING,
  containerAt,
  descendantsOf,
  isContainerClass,
  isSwimlaneClass,
} from './containers';
import {
  DEFAULT_ELEMENT_SIZE,
  inDrawingOrder,
  type ConnectorData,
  type ElementData,
  type Model,
  type Point,
} from './types';

export type ModelCommand =
  | {
      type: 'createElement';
      class: ClassId;
      x: number;
      y: number;
      w?: number;
      h?: number;
      parent?: ElementId;
      attrs?: Record<AttributeId, Json>;
      /** Only for imports and tests; normally the id is generated. */
      id?: ElementId;
    }
  | {
      type: 'createConnector';
      relation: RelationId;
      from: ElementId;
      to: ElementId;
      bends?: Point[];
      attrs?: Record<AttributeId, Json>;
      id?: ConnectorId;
    }
  | {
      type: 'setAttribute';
      /** An element, a connector, or `'model'` for the model's own attributes. */
      target: ElementId | ConnectorId | 'model';
      attr: AttributeId;
      value: Json;
    }
  | {
      /** Drops a stored value whose attribute the class no longer defines ("Unknown attributes"). */
      type: 'removeAttributeValue';
      target: ElementId | ConnectorId | 'model';
      attr: string;
    }
  | {
      type: 'move';
      id: ElementId;
      x: number;
      y: number;
      /** A container to move into, `null` to move to the top level, absent to keep the container. */
      parent?: ElementId | null;
      /**
       * The element was dropped here: with no explicit `parent`, its new container is the deepest
       * container that holds its centre and accepts its class (none puts it at the top level).
       * Needs a tool library; without one the container is kept.
       */
      drop?: boolean;
    }
  | {
      type: 'resize';
      id: ElementId;
      w: number;
      h: number;
      x?: number;
      y?: number;
    }
  | {
      /** Grows a swimlane so that it holds all its children with `padding` around them; never shrinks it. */
      type: 'fitContainer';
      id: ElementId;
      /** Defaults to `FIT_PADDING` (10). */
      padding?: number;
    }
  | { type: 'setBends'; id: ConnectorId; bends: Point[] }
  | { type: 'reconnect'; id: ConnectorId; from?: ElementId; to?: ElementId }
  | { type: 'delete'; id: ElementId | ConnectorId }
  | {
      type: 'reorder';
      id: ElementId | ConnectorId;
      to:
        | 'front'
        | 'back'
        | { before: ElementId | ConnectorId }
        | { after: ElementId | ConnectorId };
    }
  | {
      type: 'updateManifest';
      name?: string;
      folder?: string | null;
      toolVersion?: string;
    };

export type ModelCommandOrBatch = ModelCommand | BatchCommand<ModelCommand>;

export interface ModelContext {
  /** The tool library this model uses. Without it, commands check structure only. */
  tool?: ToolLibrary;
  random?: RandomSource;
}

const finite = (n: unknown, what: string): number => {
  if (typeof n !== 'number' || !Number.isFinite(n))
    throw new CommandError(`${what} must be a number (it is ${String(n)}).`);
  return n;
};
const positive = (n: unknown, what: string): number => {
  const v = finite(n, what);
  if (v <= 0) throw new CommandError(`${what} must be above 0 (it is ${v}).`);
  return v;
};

function checkPoints(points: unknown, what: string): Point[] {
  if (!Array.isArray(points))
    throw new CommandError(`${what} must be a list of points.`);
  return points.map((p, i) => ({
    x: finite((p as Point)?.x, `${what}[${i}].x`),
    y: finite((p as Point)?.y, `${what}[${i}].y`),
  }));
}

function freshId<K extends 'element' | 'connector'>(
  kind: K,
  exists: (id: string) => boolean,
  random?: RandomSource,
) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = newId(kind, random);
    if (!exists(id)) return id;
  }
  throw new CommandError('Could not create a unique id');
}

function defaultsOf(attributes: AttributeDef[]): Record<string, Json> {
  const defaults: Record<string, Json> = {};
  for (const a of attributes) {
    if ('default' in a && a.default !== undefined)
      defaults[a.id] = a.default as Json;
  }
  return defaults;
}

/**
 * Fills attributes the command did not set from their default formulas, in list order, so a
 * later default can read an earlier one. A formula that fails leaves the attribute empty:
 * creating an object must never fail because of a tool library formula.
 */
function applyDefaultFormulas(
  attributes: AttributeDef[],
  given: Record<string, Json> | undefined,
  attrs: Record<string, Json>,
): void {
  const byKey = new Map<string, AttributeDef>();
  for (const a of attributes) byKey.set(a.key, a);
  for (const a of attributes) {
    if (!a.defaultFormula || a.type === 'formula' || a.type === 'action')
      continue;
    if (given && given[a.id] !== undefined) continue;
    const source = a.defaultFormula.trim().replace(/^=/, '');
    const result = run(source, {
      get: (name) => {
        const def = byKey.get(name);
        if (!def) return undefined;
        const v = attrs[def.id];
        return v === undefined ? null : (v as never);
      },
    });
    if (result.error || result.value === null) continue;
    attrs[a.id] = result.value as Json;
  }
}

/** The highest drawing-order key in use, or null for an empty model. */
function topPos(model: Model): string | null {
  let top: string | null = null;
  for (const el of Object.values(model.elements))
    if (top === null || el.pos > top) top = el.pos;
  return top;
}

/**
 * Keeps children drawn above their container: when the element sits at or below its new
 * container, it and everything inside it go to the front, in their current order.
 */
function raiseAbove(
  tx: Tx<Model>,
  id: ElementId,
  container: ElementId,
  random?: RandomSource,
): void {
  const model = tx.view;
  const el = model.elements[id]!;
  if (el.pos > model.elements[container]!.pos) return;
  const inside = descendantsOf(model, id)
    .map((d) => model.elements[d]!)
    .sort((a, b) =>
      a.pos === b.pos ? (a.id < b.id ? -1 : 1) : a.pos < b.pos ? -1 : 1,
    );
  let last = topPos(model);
  for (const item of [el, ...inside]) {
    last = positionBetween(last, null, random);
    tx.set(['elements', item.id, 'pos'], last);
  }
}

/** Grows one swimlane to hold its direct children. Writes nothing when they already fit. */
function growToFit(tx: Tx<Model>, id: ElementId, padding: number): void {
  const model = tx.view;
  const lane = model.elements[id]!;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of Object.values(model.elements)) {
    if (el.parent !== id) continue;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.w);
    maxY = Math.max(maxY, el.y + el.h);
  }
  if (minX === Infinity) return;
  const x = Math.min(lane.x, minX - padding);
  const y = Math.min(lane.y, minY - padding);
  const w = Math.max(lane.x + lane.w, maxX + padding) - x;
  const h = Math.max(lane.y + lane.h, maxY + padding) - y;
  if (lane.x !== x) tx.set(['elements', id, 'x'], x);
  if (lane.y !== y) tx.set(['elements', id, 'y'], y);
  if (lane.w !== w) tx.set(['elements', id, 'w'], w);
  if (lane.h !== h) tx.set(['elements', id, 'h'], h);
}

/**
 * After a child was placed, moved or resized: the swimlane it sits in grows to hold it, and so do
 * swimlanes around that one. Plain containers never grow and end the climb.
 */
function fitUp(
  tx: Tx<Model>,
  start: ElementId | undefined,
  tool: ToolLibrary | undefined,
  padding = FIT_PADDING,
): void {
  if (!tool) return;
  const seen = new Set<ElementId>();
  let current = start;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const lane = tx.view.elements[current];
    if (!lane || !isSwimlaneClass(tool, lane.class)) return;
    growToFit(tx, current, padding);
    current = tx.view.elements[current]!.parent;
  }
}

function requireElement(
  model: Model,
  id: string,
  what = 'The element',
): ElementData {
  const el = model.elements[id as ElementId];
  if (!el)
    throw new CommandError(`${what} ${id} does not exist in this model.`);
  return el;
}

function attributeDefsFor(
  model: Model,
  target: string,
  tool: ToolLibrary,
): AttributeDef[] | null {
  try {
    if (target === 'model')
      return tool.modelTypes[model.manifest.modelType]?.attributes ?? null;
    if (target.startsWith('el_'))
      return effectiveAttributes(
        tool,
        model.elements[target as ElementId]!.class,
      );
    return effectiveRelationAttributes(
      tool,
      model.connectors[target as ConnectorId]!.relation,
    );
  } catch {
    // A class or relation the tool no longer has: nothing is known about its attributes.
    return null;
  }
}

function applyModelCommand(
  tx: Tx<Model>,
  command: ModelCommand,
  ctx: ModelContext,
): unknown {
  const model = tx.view;
  const tool = ctx.tool;
  switch (command.type) {
    case 'createElement': {
      const cls = tool?.classes[command.class];
      if (tool) {
        if (!cls)
          throw new CommandError(
            `The class ${command.class} does not exist in the tool library.`,
          );
        if (cls.abstract)
          throw new CommandError(
            `The class "${cls.key}" is abstract, so elements of it cannot be created. Create one of its subclasses instead.`,
          );
      } else if (!isId('class', command.class)) {
        throw new CommandError(`${String(command.class)} is not a class id.`);
      }
      if (command.parent !== undefined)
        requireElement(model, command.parent, 'The container');
      const id =
        command.id ??
        freshId(
          'element',
          (candidate) => candidate in model.elements,
          ctx.random,
        );
      if (command.id !== undefined) {
        if (!isId('element', id))
          throw new CommandError(
            `${id} is not an element id (it must start with el_).`,
          );
        if (id in model.elements)
          throw new CommandError(
            `An element with the id ${id} already exists.`,
          );
      }
      const attrs: Record<string, Json> = {
        ...(tool && cls
          ? defaultsOf(effectiveAttributes(tool, command.class))
          : {}),
        ...(command.attrs ?? {}),
      };
      if (tool && cls)
        applyDefaultFormulas(
          effectiveAttributes(tool, command.class),
          command.attrs,
          attrs,
        );
      for (const key of Object.keys(attrs))
        if (!isId('attribute', key))
          throw new CommandError(`${key} is not an attribute id.`);
      const last = inDrawingOrder(model.elements).at(-1)?.pos ?? null;
      const element: ElementData = {
        id,
        class: command.class,
        x: finite(command.x, 'x'),
        y: finite(command.y, 'y'),
        w: positive(command.w ?? DEFAULT_ELEMENT_SIZE.w, 'The width'),
        h: positive(command.h ?? DEFAULT_ELEMENT_SIZE.h, 'The height'),
        ...(command.parent === undefined ? {} : { parent: command.parent }),
        attrs: attrs as Record<AttributeId, Json>,
        pos: positionBetween(last, null, ctx.random),
      };
      tx.set(['elements', id], element);
      fitUp(tx, command.parent, tool);
      return id;
    }
    case 'createConnector': {
      requireElement(model, command.from, 'The FROM element');
      requireElement(model, command.to, 'The TO element');
      let defaults: Record<string, Json> = {};
      let relDefs: AttributeDef[] = [];
      if (tool) {
        const rel = tool.relations[command.relation];
        if (!rel)
          throw new CommandError(
            `The relation class ${command.relation} does not exist in the tool library.`,
          );
        if (rel.abstract)
          throw new CommandError(
            `The relation class "${rel.key}" is abstract, so connectors of it cannot be created.`,
          );
        relDefs = effectiveRelationAttributes(tool, command.relation);
        defaults = defaultsOf(relDefs);
      } else if (!isId('relation', command.relation)) {
        throw new CommandError(
          `${String(command.relation)} is not a relation class id.`,
        );
      }
      const id =
        command.id ??
        freshId(
          'connector',
          (candidate) => candidate in model.connectors,
          ctx.random,
        );
      if (command.id !== undefined) {
        if (!isId('connector', id))
          throw new CommandError(
            `${id} is not a connector id (it must start with cn_).`,
          );
        if (id in model.connectors)
          throw new CommandError(
            `A connector with the id ${id} already exists.`,
          );
      }
      const attrs: Record<string, Json> = {
        ...defaults,
        ...(command.attrs ?? {}),
      };
      applyDefaultFormulas(relDefs, command.attrs, attrs);
      const last = inDrawingOrder(model.connectors).at(-1)?.pos ?? null;
      const connector: ConnectorData = {
        id,
        relation: command.relation,
        from: command.from,
        to: command.to,
        bends: checkPoints(command.bends ?? [], 'The bend points'),
        attrs: attrs as Record<AttributeId, Json>,
        pos: positionBetween(last, null, ctx.random),
      };
      tx.set(['connectors', id], connector);
      return id;
    }
    case 'setAttribute': {
      if (!isId('attribute', command.attr))
        throw new CommandError(
          `${String(command.attr)} is not an attribute id.`,
        );
      let path: string[];
      if (command.target === 'model') path = ['attrs', command.attr];
      else if (idKind(command.target) === 'element') {
        requireElement(model, command.target);
        path = ['elements', command.target, 'attrs', command.attr];
      } else if (idKind(command.target) === 'connector') {
        if (!model.connectors[command.target as ConnectorId])
          throw new CommandError(
            `The connector ${command.target} does not exist in this model.`,
          );
        path = ['connectors', command.target, 'attrs', command.attr];
      } else {
        throw new CommandError(
          `${String(command.target)} is neither an element, a connector nor "model".`,
        );
      }
      if (tool) {
        const defs = attributeDefsFor(model, command.target, tool);
        const def = defs?.find((d) => d.id === command.attr);
        if (defs && !def)
          throw new CommandError(
            `${command.target === 'model' ? 'The model type' : 'The class'} has no attribute ${command.attr}.`,
          );
        if (def && (def.type === 'formula' || def.type === 'action')) {
          throw new CommandError(
            `The attribute "${def.key}" is ${def.type === 'formula' ? 'calculated' : 'a button'} and cannot be set.`,
          );
        }
      }
      requireJson(command.value, 'The attribute value');
      if (deepEqual(tx.get(path), command.value)) return undefined;
      tx.set(path, command.value);
      return undefined;
    }
    case 'removeAttributeValue': {
      let path: string[];
      let values: Record<string, Json>;
      if (command.target === 'model') {
        path = ['attrs', command.attr];
        values = model.attrs;
      } else if (idKind(command.target) === 'element') {
        values = requireElement(model, command.target).attrs;
        path = ['elements', command.target, 'attrs', command.attr];
      } else if (idKind(command.target) === 'connector') {
        const cn = model.connectors[command.target as ConnectorId];
        if (!cn)
          throw new CommandError(
            `The connector ${command.target} does not exist in this model.`,
          );
        values = cn.attrs;
        path = ['connectors', command.target, 'attrs', command.attr];
      } else {
        throw new CommandError(
          `${String(command.target)} is neither an element, a connector nor "model".`,
        );
      }
      if (tool) {
        const defs = attributeDefsFor(model, command.target, tool);
        const def = defs?.find((d) => d.id === command.attr);
        if (def)
          throw new CommandError(
            `The attribute "${def.key}" is still defined, so its value is not unknown. Clear it instead.`,
          );
      }
      if (!Object.hasOwn(values, command.attr)) return undefined;
      tx.remove(path);
      return undefined;
    }
    case 'move': {
      const el = requireElement(model, command.id);
      if (command.parent !== undefined && command.parent !== null) {
        requireElement(model, command.parent, 'The container');
        if (
          command.parent === command.id ||
          descendantsOf(model, el.id).includes(command.parent)
        ) {
          throw new CommandError(
            'An element cannot be moved into itself or into something it contains.',
          );
        }
      }
      const x = finite(command.x, 'x');
      const y = finite(command.y, 'y');
      // Read everything before the first write: later reads see the changed state.
      const dx = x - el.x;
      const dy = y - el.y;
      // Without a tool library the kind is unknown, so every element is checked for contents.
      const inside =
        (dx !== 0 || dy !== 0) && (!tool || isContainerClass(tool, el.class))
          ? descendantsOf(model, el.id).map((id) => model.elements[id]!)
          : [];
      let parent: ElementId | null | undefined = command.parent;
      if (parent === undefined && command.drop && tool)
        parent = containerAt(
          model,
          tool,
          model.manifest.modelType,
          { x: x + el.w / 2, y: y + el.h / 2 },
          [el.id],
          el.class,
        );
      const was = el.parent;
      if (el.x !== x) tx.set(['elements', el.id, 'x'], x);
      if (el.y !== y) tx.set(['elements', el.id, 'y'], y);
      // The contents travel with their container by the same offset.
      for (const d of inside) {
        tx.set(['elements', d.id, 'x'], d.x + dx);
        tx.set(['elements', d.id, 'y'], d.y + dy);
      }
      if (parent === null) tx.remove(['elements', el.id, 'parent']);
      else if (parent !== undefined && parent !== was) {
        tx.set(['elements', el.id, 'parent'], parent);
        raiseAbove(tx, el.id, parent, ctx.random);
      }
      fitUp(tx, parent === undefined ? was : (parent ?? undefined), tool);
      return undefined;
    }
    case 'fitContainer': {
      const lane = requireElement(model, command.id);
      if (tool && !isSwimlaneClass(tool, lane.class))
        throw new CommandError(
          'Only a swimlane can be fitted to its contents.',
        );
      const padding =
        command.padding === undefined
          ? FIT_PADDING
          : finite(command.padding, 'The padding');
      if (padding < 0)
        throw new CommandError(
          `The padding must be 0 or more (it is ${padding}).`,
        );
      growToFit(tx, lane.id, padding);
      return undefined;
    }
    case 'resize': {
      const el = requireElement(model, command.id);
      const w = positive(command.w, 'The width');
      const h = positive(command.h, 'The height');
      if (el.w !== w) tx.set(['elements', el.id, 'w'], w);
      if (el.h !== h) tx.set(['elements', el.id, 'h'], h);
      if (command.x !== undefined && el.x !== command.x)
        tx.set(['elements', el.id, 'x'], finite(command.x, 'x'));
      if (command.y !== undefined && el.y !== command.y)
        tx.set(['elements', el.id, 'y'], finite(command.y, 'y'));
      fitUp(tx, el.parent, tool);
      return undefined;
    }
    case 'setBends': {
      if (!model.connectors[command.id])
        throw new CommandError(
          `The connector ${command.id} does not exist in this model.`,
        );
      const bends = checkPoints(command.bends, 'The bend points');
      if (!deepEqual(model.connectors[command.id]!.bends, bends))
        tx.set(['connectors', command.id, 'bends'], bends);
      return undefined;
    }
    case 'reconnect': {
      const cn = model.connectors[command.id];
      if (!cn)
        throw new CommandError(
          `The connector ${command.id} does not exist in this model.`,
        );
      if (command.from === undefined && command.to === undefined)
        throw new CommandError(
          'Reconnect needs a new FROM element, a new TO element, or both.',
        );
      if (command.from !== undefined) {
        requireElement(model, command.from, 'The FROM element');
        if (command.from !== cn.from)
          tx.set(['connectors', cn.id, 'from'], command.from);
      }
      if (command.to !== undefined) {
        requireElement(model, command.to, 'The TO element');
        if (command.to !== cn.to)
          tx.set(['connectors', cn.id, 'to'], command.to);
      }
      return undefined;
    }
    case 'delete': {
      if (idKind(command.id) === 'connector') {
        if (!model.connectors[command.id as ConnectorId])
          throw new CommandError(
            `The connector ${command.id} does not exist in this model.`,
          );
        tx.remove(['connectors', command.id]);
        return undefined;
      }
      const doomed = requireElement(model, command.id);
      // What the element contains is kept and moves up to the element's own container.
      for (const child of Object.values(model.elements)) {
        if (child.parent !== doomed.id) continue;
        if (doomed.parent === undefined)
          tx.remove(['elements', child.id, 'parent']);
        else tx.set(['elements', child.id, 'parent'], doomed.parent);
      }
      // Connectors that would be left without an end go too.
      for (const cn of Object.values(model.connectors)) {
        if (cn.from === doomed.id || cn.to === doomed.id)
          tx.remove(['connectors', cn.id]);
      }
      tx.remove(['elements', doomed.id]);
      return undefined;
    }
    case 'reorder': {
      const isElement = idKind(command.id) === 'element';
      const table = (isElement ? model.elements : model.connectors) as Record<
        string,
        { id: string; pos: string }
      >;
      const item = table[command.id];
      if (!item)
        throw new CommandError(`${command.id} does not exist in this model.`);
      const others = inDrawingOrder(table).filter((o) => o.id !== command.id);
      let before: string | null;
      let after: string | null;
      if (command.to === 'front') {
        before = others.at(-1)?.pos ?? null;
        after = null;
      } else if (command.to === 'back') {
        before = null;
        after = others[0]?.pos ?? null;
      } else {
        const anchorId =
          'before' in command.to ? command.to.before : command.to.after;
        if (anchorId === command.id)
          throw new CommandError(
            'An item cannot be placed before or after itself.',
          );
        const anchorIndex = others.findIndex((o) => o.id === anchorId);
        if (anchorIndex < 0)
          throw new CommandError(
            `${anchorId} is not among the ${isElement ? 'elements' : 'connectors'} of this model.`,
          );
        const at = 'before' in command.to ? anchorIndex : anchorIndex + 1;
        before = others[at - 1]?.pos ?? null;
        after = others[at]?.pos ?? null;
      }
      // Already strictly between its new neighbours: keep the key so nothing changes.
      if (
        (before === null || before < item.pos) &&
        (after === null || item.pos < after)
      )
        return undefined;
      tx.set(
        [isElement ? 'elements' : 'connectors', command.id, 'pos'],
        positionBetween(before, after, ctx.random),
      );
      return undefined;
    }
    case 'updateManifest': {
      if (command.name !== undefined) {
        if (typeof command.name !== 'string' || command.name.trim() === '')
          throw new CommandError('The model name cannot be empty.');
        if (model.manifest.name !== command.name)
          tx.set(['manifest', 'name'], command.name);
      }
      if (command.folder !== undefined) {
        if (command.folder === null) tx.remove(['manifest', 'folder']);
        else if (model.manifest.folder !== command.folder)
          tx.set(['manifest', 'folder'], command.folder);
      }
      if (
        command.toolVersion !== undefined &&
        model.manifest.toolVersion !== command.toolVersion
      ) {
        tx.set(['manifest', 'toolVersion'], command.toolVersion);
      }
      return undefined;
    }
    default: {
      const unknown: { type?: unknown } = command;
      throw new CommandError(`Unknown command "${String(unknown.type)}".`);
    }
  }
}

export const modelKind: DocumentKind<Model, ModelCommand, ModelContext> = {
  apply: (tx, command, context) => applyModelCommand(tx, command, context),
};

export type ModelStore = DocumentStore<Model, ModelCommand, ModelContext>;

export function createModelStore(
  model: Model,
  options: {
    tool?: ToolLibrary;
    user?: string;
    random?: RandomSource;
    historyLimit?: number;
  } = {},
): ModelStore {
  return new DocumentStore<Model, ModelCommand, ModelContext>({
    kind: modelKind,
    initial: model,
    context: {
      ...(options.tool ? { tool: options.tool } : {}),
      ...(options.random ? { random: options.random } : {}),
    },
    ...(options.user ? { user: options.user } : {}),
    ...(options.historyLimit ? { historyLimit: options.historyLimit } : {}),
  });
}
