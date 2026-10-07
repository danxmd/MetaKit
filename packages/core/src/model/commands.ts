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
      type: 'move';
      id: ElementId;
      x: number;
      y: number;
      /** A container to move into, `null` to move to the top level, absent to keep the container. */
      parent?: ElementId | null;
    }
  | {
      type: 'resize';
      id: ElementId;
      w: number;
      h: number;
      x?: number;
      y?: number;
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

function descendants(model: Model, id: ElementId): ElementId[] {
  const found: ElementId[] = [];
  const queue: ElementId[] = [id];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    for (const el of Object.values(model.elements)) {
      if (el.parent === parent && !found.includes(el.id)) {
        found.push(el.id);
        queue.push(el.id);
      }
    }
  }
  return found;
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
      const attrs = {
        ...(tool && cls
          ? defaultsOf(effectiveAttributes(tool, command.class))
          : {}),
        ...(command.attrs ?? {}),
      };
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
      return id;
    }
    case 'createConnector': {
      requireElement(model, command.from, 'The FROM element');
      requireElement(model, command.to, 'The TO element');
      let defaults: Record<string, Json> = {};
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
        defaults = defaultsOf(
          effectiveRelationAttributes(tool, command.relation),
        );
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
      const attrs = { ...defaults, ...(command.attrs ?? {}) };
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
    case 'move': {
      const el = requireElement(model, command.id);
      if (command.parent !== undefined && command.parent !== null) {
        requireElement(model, command.parent, 'The container');
        if (
          command.parent === command.id ||
          descendants(model, command.id).includes(command.parent)
        ) {
          throw new CommandError(
            'An element cannot be moved into itself or into something it contains.',
          );
        }
      }
      const x = finite(command.x, 'x');
      const y = finite(command.y, 'y');
      if (el.x !== x) tx.set(['elements', el.id, 'x'], x);
      if (el.y !== y) tx.set(['elements', el.id, 'y'], y);
      if (command.parent === null) tx.remove(['elements', el.id, 'parent']);
      else if (command.parent !== undefined && command.parent !== el.parent)
        tx.set(['elements', el.id, 'parent'], command.parent);
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
      requireElement(model, command.id);
      // The element, what it contains, and every connector that would be left without an end.
      const doomed = new Set<string>([
        command.id,
        ...descendants(model, command.id as ElementId),
      ]);
      for (const cn of Object.values(model.connectors)) {
        if (doomed.has(cn.from) || doomed.has(cn.to))
          tx.remove(['connectors', cn.id]);
      }
      for (const id of doomed) tx.remove(['elements', id]);
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
