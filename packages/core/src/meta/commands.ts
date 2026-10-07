import {
  isId,
  type ClassId,
  type ModelTypeId,
  type RelationId,
  type AttributeId,
  type ShapeId,
} from '../ids';
import { formatIssues, validateAttribute } from './guards';
import {
  keyProblem,
  ownerDef,
  planKeyRename,
  relatedKeys,
  scopeOwners,
  type KeyOwner,
  type KeyScope,
} from './keys';
import type { PanelLayout, ShapeDef } from './shape-types';
import {
  DocumentStore,
  type BatchCommand,
  type DocumentKind,
} from '../store/store';
import { CommandError, type Tx } from '../store/tx';
import type {
  AttributeDef,
  ClassDef,
  ModelTypeDef,
  RelationDef,
  ToolLibrary,
  ToolManifest,
  ToolSettings,
} from './types';

export type ToolCommand =
  | {
      type: 'updateManifest';
      name?: string;
      version?: string;
      languages?: string[];
    }
  | {
      type: 'updateSettings';
      grid?: Partial<ToolSettings['grid']>;
      layers?: ToolSettings['layers'];
      numbering?: Partial<ToolSettings['numbering']>;
    }
  | { type: 'putClass'; def: ClassDef }
  | { type: 'putRelation'; def: RelationDef }
  | { type: 'putModelType'; def: ModelTypeDef }
  | { type: 'removeClass'; id: ClassId }
  | { type: 'removeRelation'; id: RelationId }
  | { type: 'removeModelType'; id: ModelTypeId }
  | { type: 'renameKey'; scope: KeyScope; newKey: string }
  | {
      type: 'putAttribute';
      owner: KeyOwner;
      def: AttributeDef;
      /** Where to insert a new attribute; at the end when absent. */
      index?: number;
    }
  | { type: 'removeAttribute'; owner: KeyOwner; id: AttributeId }
  | { type: 'moveAttribute'; owner: KeyOwner; id: AttributeId; to: number }
  | { type: 'putShape'; def: ShapeDef }
  | { type: 'removeShape'; id: ShapeId }
  | { type: 'putPanel'; layout: PanelLayout }
  | { type: 'removePanel'; id: ClassId | RelationId };

export type ToolCommandOrBatch = ToolCommand | BatchCommand<ToolCommand>;

const nameOf = (x: { key: string }) => `"${x.key}"`;

/** Who still uses a class, so that removing it can be refused with a useful message. */
function classUsers(tool: ToolLibrary, id: ClassId): string[] {
  const users: string[] = [];
  for (const c of Object.values(tool.classes))
    if (c.extends === id) users.push(`class ${nameOf(c)} extends it`);
  for (const r of Object.values(tool.relations)) {
    if (r.from.includes(id))
      users.push(`relation class ${nameOf(r)} allows it at FROM`);
    if (r.to.includes(id))
      users.push(`relation class ${nameOf(r)} allows it at TO`);
  }
  for (const m of Object.values(tool.modelTypes)) {
    if (m.classes.includes(id)) users.push(`model type ${nameOf(m)} allows it`);
    for (const v of m.views)
      if (v.classes.includes(id))
        users.push(`view ${nameOf(v)} of ${nameOf(m)} lists it`);
    for (const k of m.cardinalities)
      if (k.class === id)
        users.push(`model type ${nameOf(m)} has a cardinality for it`);
    for (const [container, accepted] of Object.entries(m.containers ?? {}))
      if (container === id || accepted.includes(id))
        users.push(`model type ${nameOf(m)} has a container rule for it`);
  }
  return users;
}

function relationUsers(tool: ToolLibrary, id: RelationId): string[] {
  const users: string[] = [];
  for (const r of Object.values(tool.relations))
    if (r.extends === id) users.push(`relation class ${nameOf(r)} extends it`);
  for (const m of Object.values(tool.modelTypes)) {
    if (m.relations.includes(id))
      users.push(`model type ${nameOf(m)} allows it`);
    for (const v of m.views)
      if (v.relations.includes(id))
        users.push(`view ${nameOf(v)} of ${nameOf(m)} lists it`);
    for (const k of m.cardinalities)
      if (k.kind === 'degree' && k.relation === id)
        users.push(`model type ${nameOf(m)} has a cardinality for it`);
  }
  return users;
}

/** Who still uses a shape, so that removing it can be refused with a useful message. */
function shapeUsers(tool: ToolLibrary, id: ShapeId): string[] {
  const users: string[] = [];
  for (const c of Object.values(tool.classes))
    if (c.shape === id) users.push(`class ${nameOf(c)} draws with it`);
  for (const r of Object.values(tool.relations))
    if (r.shape === id) users.push(`relation class ${nameOf(r)} draws with it`);
  for (const m of Object.values(tool.modelTypes))
    if (m.background === id)
      users.push(`model type ${nameOf(m)} uses it as background`);
  const uses = (
    parts: { type: string; shape?: string; parts?: unknown[] }[],
  ): boolean =>
    parts.some(
      (p) =>
        (p.type === 'use' && p.shape === id) ||
        (p.type === 'group' && uses((p.parts ?? []) as never)),
    );
  for (const s of Object.values(tool.shapes ?? {}))
    if (
      s.kind === 'node' &&
      (uses(s.parts as never) ||
        (s.variants ?? []).some((v) => uses(v.parts as never)))
    )
      users.push(`shape ${s.name ?? s.id} embeds it`);
  return users;
}

function attributeTable(
  owner: KeyOwner,
): 'classes' | 'relations' | 'modelTypes' {
  return owner.kind === 'class'
    ? 'classes'
    : owner.kind === 'relation'
      ? 'relations'
      : 'modelTypes';
}

interface PanelNode {
  attribute?: string;
  items?: PanelNode[];
  [key: string]: unknown;
}

/** Removes the items that list an attribute key, inside tabs and groups. */
function pruneItems(nodes: PanelNode[], key: string): PanelNode[] {
  return nodes
    .filter((n) => n.attribute !== key)
    .map((n) => (n.items ? { ...n, items: pruneItems(n.items, key) } : n));
}

function put<D extends { id: string }>(
  tx: Tx<ToolLibrary>,
  table: 'classes' | 'relations' | 'modelTypes' | 'shapes',
  prefix: 'class' | 'relation' | 'modelType' | 'shape',
  def: D,
  what: string,
) {
  if (def === null || typeof def !== 'object' || !isId(prefix, def.id))
    throw new CommandError(
      `The ${what} needs an id of the right kind (it is ${JSON.stringify((def as { id?: unknown } | null)?.id)}).`,
    );
  tx.set([table, def.id], def);
}

function applyToolCommand(tx: Tx<ToolLibrary>, command: ToolCommand): unknown {
  const tool = tx.view;
  switch (command.type) {
    case 'updateManifest': {
      const patch: Partial<ToolManifest> = {};
      if (command.name !== undefined) patch.name = command.name;
      if (command.version !== undefined) patch.version = command.version;
      if (command.languages !== undefined) patch.languages = command.languages;
      for (const [k, v] of Object.entries(patch)) tx.set(['manifest', k], v);
      return undefined;
    }
    case 'updateSettings': {
      for (const [k, v] of Object.entries(command.grid ?? {}))
        tx.set(['settings', 'grid', k], v);
      if (command.layers !== undefined)
        tx.set(['settings', 'layers'], command.layers);
      for (const [k, v] of Object.entries(command.numbering ?? {}))
        tx.set(['settings', 'numbering', k], v);
      return undefined;
    }
    case 'putClass':
      put(tx, 'classes', 'class', command.def, 'class');
      return command.def.id;
    case 'putRelation':
      put(tx, 'relations', 'relation', command.def, 'relation class');
      return command.def.id;
    case 'putModelType':
      put(tx, 'modelTypes', 'modelType', command.def, 'model type');
      return command.def.id;
    case 'removeClass': {
      const def = tool.classes[command.id];
      if (!def)
        throw new CommandError(`The class ${command.id} does not exist.`);
      const users = classUsers(tool, command.id);
      if (users.length > 0)
        throw new CommandError(
          `The class ${nameOf(def)} is still in use: ${users.join('; ')}.`,
        );
      tx.remove(['classes', command.id]);
      return undefined;
    }
    case 'removeRelation': {
      const def = tool.relations[command.id];
      if (!def)
        throw new CommandError(
          `The relation class ${command.id} does not exist.`,
        );
      const users = relationUsers(tool, command.id);
      if (users.length > 0)
        throw new CommandError(
          `The relation class ${nameOf(def)} is still in use: ${users.join('; ')}.`,
        );
      tx.remove(['relations', command.id]);
      return undefined;
    }
    case 'removeModelType': {
      if (!tool.modelTypes[command.id])
        throw new CommandError(`The model type ${command.id} does not exist.`);
      tx.remove(['modelTypes', command.id]);
      return undefined;
    }
    case 'renameKey': {
      const plan = planKeyRename(tool, command.scope, command.newKey);
      if ('error' in plan) throw new CommandError(plan.error);
      for (const change of plan.changes) tx.set(change.path, change.value);
      return plan.usages;
    }
    case 'putAttribute': {
      const def = ownerDef(tool, command.owner);
      if (!def)
        throw new CommandError(
          'That class, relation class or model type does not exist.',
        );
      const attr = command.def;
      const issues = validateAttribute(attr, tool.manifest.languages);
      if (issues.length > 0)
        throw new CommandError(
          `The attribute is not valid.\n${formatIssues(issues)}`,
        );
      const at = def.attributes.findIndex((a) => a.id === attr.id);
      if (at >= 0 && def.attributes[at]!.key !== attr.key)
        throw new CommandError(
          'To change the key of an attribute, rename it, so that the formulas that use it are rewritten.',
        );
      if (at < 0) {
        const clash = relatedKeys(tool, command.owner, attr.id).get(attr.key);
        if (clash)
          throw new CommandError(
            `The key "${attr.key}" is already used by an attribute of ${clash}.`,
          );
        const problem = keyProblem(attr.key);
        if (problem) throw new CommandError(problem);
      }
      const next = [...def.attributes];
      if (at >= 0) next[at] = attr;
      else
        next.splice(
          Math.min(Math.max(command.index ?? next.length, 0), next.length),
          0,
          attr,
        );
      tx.set(
        [attributeTable(command.owner), command.owner.id, 'attributes'],
        next,
      );
      return attr.id;
    }
    case 'removeAttribute': {
      const def = ownerDef(tool, command.owner);
      const attr = def?.attributes.find((a) => a.id === command.id);
      if (!def || !attr)
        throw new CommandError('That attribute does not exist.');
      tx.set(
        [attributeTable(command.owner), command.owner.id, 'attributes'],
        def.attributes.filter((a) => a.id !== command.id),
      );
      // A panel layout cannot list an attribute that is gone.
      for (const o of scopeOwners(tool, command.owner)) {
        const layout = o.kind === 'modelType' ? undefined : tool.panels?.[o.id];
        if (!layout) continue;
        const pruned = pruneItems(
          layout.tabs as unknown as PanelNode[],
          attr.key,
        );
        tx.set(['panels', o.id, 'tabs'], pruned);
      }
      return undefined;
    }
    case 'moveAttribute': {
      const def = ownerDef(tool, command.owner);
      const from = def?.attributes.findIndex((a) => a.id === command.id) ?? -1;
      if (!def || from < 0)
        throw new CommandError('That attribute does not exist.');
      const next = [...def.attributes];
      const [moved] = next.splice(from, 1);
      next.splice(Math.min(Math.max(command.to, 0), next.length), 0, moved!);
      tx.set(
        [attributeTable(command.owner), command.owner.id, 'attributes'],
        next,
      );
      return undefined;
    }
    case 'putShape':
      put(tx, 'shapes', 'shape', command.def, 'shape');
      return command.def.id;
    case 'removeShape': {
      const def = tool.shapes?.[command.id];
      if (!def)
        throw new CommandError(`The shape ${command.id} does not exist.`);
      const users = shapeUsers(tool, command.id);
      if (users.length > 0)
        throw new CommandError(
          `The shape ${def.name ?? def.id} is still in use: ${users.join('; ')}.`,
        );
      tx.remove(['shapes', command.id]);
      return undefined;
    }
    case 'putPanel': {
      const id = command.layout?.class;
      if (
        typeof id !== 'string' ||
        !(id in tool.classes || id in tool.relations)
      )
        throw new CommandError(
          `The panel layout needs the id of an existing class or relation class (it is ${JSON.stringify(id)}).`,
        );
      tx.set(['panels', id], command.layout);
      return id;
    }
    case 'removePanel': {
      if (!tool.panels?.[command.id])
        throw new CommandError(`There is no panel layout for ${command.id}.`);
      tx.remove(['panels', command.id]);
      return undefined;
    }
    default: {
      const unknown: { type?: unknown } = command;
      throw new CommandError(`Unknown command "${String(unknown.type)}".`);
    }
  }
}

export const toolKind: DocumentKind<ToolLibrary, ToolCommand, undefined> = {
  apply: (tx, command) => applyToolCommand(tx, command),
};

export type ToolStore = DocumentStore<ToolLibrary, ToolCommand, undefined>;

export function createToolStore(
  tool: ToolLibrary,
  options: { user?: string; historyLimit?: number } = {},
): ToolStore {
  return new DocumentStore<ToolLibrary, ToolCommand, undefined>({
    kind: toolKind,
    initial: tool,
    context: undefined,
    ...(options.user ? { user: options.user } : {}),
    ...(options.historyLimit ? { historyLimit: options.historyLimit } : {}),
  });
}
