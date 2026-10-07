import { isId, type ClassId, type ModelTypeId, type RelationId } from '../ids';
import {
  DocumentStore,
  type BatchCommand,
  type DocumentKind,
} from '../store/store';
import { CommandError, type Tx } from '../store/tx';
import type {
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
  | { type: 'removeModelType'; id: ModelTypeId };

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

function put<D extends { id: string }>(
  tx: Tx<ToolLibrary>,
  table: 'classes' | 'relations' | 'modelTypes',
  prefix: 'class' | 'relation' | 'modelType',
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
  const tool = tx.state;
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
