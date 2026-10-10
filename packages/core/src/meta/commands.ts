import {
  isId,
  type ClassId,
  type ModelTypeId,
  type RelationId,
  type AttributeId,
  type ShapeId,
} from '../ids';
import { formatIssues, validateAttribute, validateKit } from './guards';
import {
  keyProblem,
  ownerDef,
  planKeyRename,
  relatedKeys,
  scopeOwners,
  type KeyOwner,
  type KeyScope,
} from './keys';
import type { Constraint, Rule, RuleId } from './rule-types';
import { MAX_SCRIPT_CHARS } from './script-guards';
import type { Script, ScriptId, KitPermissions } from './script-types';
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
  Kit,
  KitManifest,
  KitSettings,
} from './types';

export type KitCommand =
  | {
      type: 'updateManifest';
      name?: string;
      version?: string;
      languages?: string[];
      permissions?: KitPermissions;
    }
  | {
      type: 'updateSettings';
      grid?: Partial<KitSettings['grid']>;
      layers?: KitSettings['layers'];
      numbering?: Partial<KitSettings['numbering']>;
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
  | { type: 'putRule'; rule: Rule }
  | { type: 'removeRule'; id: RuleId }
  | { type: 'putScript'; script: Script }
  | { type: 'removeScript'; id: ScriptId }
  | {
      type: 'putConstraint';
      owner: KeyOwner;
      constraint: Constraint;
      index?: number;
    }
  | { type: 'removeConstraint'; owner: KeyOwner; id: string }
  | { type: 'putShape'; def: ShapeDef }
  | { type: 'removeShape'; id: ShapeId }
  | { type: 'putPanel'; layout: PanelLayout }
  | { type: 'removePanel'; id: ClassId | RelationId };

export type KitCommandOrBatch = KitCommand | BatchCommand<KitCommand>;

const nameOf = (x: { key: string }) => `"${x.key}"`;

/** Who still uses a class, so that removing it can be refused with a useful message. */
function classUsers(kit: Kit, id: ClassId): string[] {
  const users: string[] = [];
  for (const c of Object.values(kit.classes))
    if (c.extends === id) users.push(`class ${nameOf(c)} extends it`);
  for (const r of Object.values(kit.relations)) {
    if (r.from.includes(id))
      users.push(`relation class ${nameOf(r)} allows it at FROM`);
    if (r.to.includes(id))
      users.push(`relation class ${nameOf(r)} allows it at TO`);
  }
  for (const m of Object.values(kit.modelTypes)) {
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

function relationUsers(kit: Kit, id: RelationId): string[] {
  const users: string[] = [];
  for (const r of Object.values(kit.relations))
    if (r.extends === id) users.push(`relation class ${nameOf(r)} extends it`);
  for (const m of Object.values(kit.modelTypes)) {
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
function shapeUsers(kit: Kit, id: ShapeId): string[] {
  const users: string[] = [];
  for (const c of Object.values(kit.classes))
    if (c.shape === id) users.push(`class ${nameOf(c)} draws with it`);
  for (const r of Object.values(kit.relations))
    if (r.shape === id) users.push(`relation class ${nameOf(r)} draws with it`);
  for (const m of Object.values(kit.modelTypes))
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
  for (const s of Object.values(kit.shapes ?? {}))
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
  tx: Tx<Kit>,
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

function applyKitCommand(tx: Tx<Kit>, command: KitCommand): unknown {
  const kit = tx.view;
  switch (command.type) {
    case 'updateManifest': {
      const patch: Partial<KitManifest> = {};
      if (command.name !== undefined) patch.name = command.name;
      if (command.version !== undefined) patch.version = command.version;
      if (command.languages !== undefined) patch.languages = command.languages;
      if (command.permissions !== undefined)
        patch.permissions = command.permissions;
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
      const def = kit.classes[command.id];
      if (!def)
        throw new CommandError(`The class ${command.id} does not exist.`);
      const users = classUsers(kit, command.id);
      if (users.length > 0)
        throw new CommandError(
          `The class ${nameOf(def)} is still in use: ${users.join('; ')}.`,
        );
      tx.remove(['classes', command.id]);
      return undefined;
    }
    case 'removeRelation': {
      const def = kit.relations[command.id];
      if (!def)
        throw new CommandError(
          `The relation class ${command.id} does not exist.`,
        );
      const users = relationUsers(kit, command.id);
      if (users.length > 0)
        throw new CommandError(
          `The relation class ${nameOf(def)} is still in use: ${users.join('; ')}.`,
        );
      tx.remove(['relations', command.id]);
      return undefined;
    }
    case 'removeModelType': {
      if (!kit.modelTypes[command.id])
        throw new CommandError(`The model type ${command.id} does not exist.`);
      tx.remove(['modelTypes', command.id]);
      return undefined;
    }
    case 'renameKey': {
      const plan = planKeyRename(kit, command.scope, command.newKey);
      if ('error' in plan) throw new CommandError(plan.error);
      for (const change of plan.changes) tx.set(change.path, change.value);
      return plan.usages;
    }
    case 'putAttribute': {
      const def = ownerDef(kit, command.owner);
      if (!def)
        throw new CommandError(
          'That class, relation class or model type does not exist.',
        );
      const attr = command.def;
      const issues = validateAttribute(attr, kit.manifest.languages);
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
        const clash = relatedKeys(kit, command.owner, attr.id).get(attr.key);
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
      const def = ownerDef(kit, command.owner);
      const attr = def?.attributes.find((a) => a.id === command.id);
      if (!def || !attr)
        throw new CommandError('That attribute does not exist.');
      tx.set(
        [attributeTable(command.owner), command.owner.id, 'attributes'],
        def.attributes.filter((a) => a.id !== command.id),
      );
      // A panel layout cannot list an attribute that is gone.
      for (const o of scopeOwners(kit, command.owner)) {
        const layout = o.kind === 'modelType' ? undefined : kit.panels?.[o.id];
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
      const def = ownerDef(kit, command.owner);
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
    case 'putRule': {
      const rule = command.rule;
      if (rule === null || typeof rule !== 'object' || !isId('rule', rule.id))
        throw new CommandError(
          `The rule needs an id of the form rule_something (it is ${JSON.stringify((rule as { id?: unknown } | null)?.id)}).`,
        );
      // Checked here so that a rule the engine could not run never reaches the Kit.
      const probe = { ...kit, rules: { ...kit.rules, [rule.id]: rule } };
      const issues = validateKit(probe).filter((i) =>
        i.path.startsWith(`rules.${rule.id}`),
      );
      if (issues.length > 0)
        throw new CommandError(
          `The rule is not valid.\n${formatIssues(issues)}`,
        );
      tx.set(['rules', rule.id], rule);
      return rule.id;
    }
    case 'removeRule': {
      if (!kit.rules?.[command.id])
        throw new CommandError(`The rule ${command.id} does not exist.`);
      tx.remove(['rules', command.id]);
      return undefined;
    }
    case 'putScript': {
      const script = command.script;
      if (
        script === null ||
        typeof script !== 'object' ||
        !isId('script', script.id)
      )
        throw new CommandError(
          `The script needs an id of the form scr_something (it is ${JSON.stringify((script as { id?: unknown } | null)?.id)}).`,
        );
      if (typeof script.name !== 'string' || script.name.trim() === '')
        throw new CommandError('The script needs a name.');
      if (typeof script.source !== 'string')
        throw new CommandError('The script source must be text.');
      if (script.source.length > MAX_SCRIPT_CHARS)
        throw new CommandError(
          `The script is longer than ${MAX_SCRIPT_CHARS} characters.`,
        );
      tx.set(['scripts', script.id], script);
      return script.id;
    }
    case 'removeScript': {
      if (!kit.scripts?.[command.id])
        throw new CommandError(`The script ${command.id} does not exist.`);
      tx.remove(['scripts', command.id]);
      return undefined;
    }
    case 'putConstraint': {
      const def = ownerDef(kit, command.owner) as
        { constraints?: Constraint[] } | undefined;
      if (!def)
        throw new CommandError(
          'That class, relation class or model type does not exist.',
        );
      const list = [...(def.constraints ?? [])];
      const at = list.findIndex((k) => k.id === command.constraint.id);
      if (at >= 0) list[at] = command.constraint;
      else
        list.splice(
          Math.min(Math.max(command.index ?? list.length, 0), list.length),
          0,
          command.constraint,
        );
      tx.set(
        [attributeTable(command.owner), command.owner.id, 'constraints'],
        list,
      );
      return command.constraint.id;
    }
    case 'removeConstraint': {
      const def = ownerDef(kit, command.owner) as
        { constraints?: Constraint[] } | undefined;
      if (!def?.constraints?.some((k) => k.id === command.id))
        throw new CommandError('That constraint does not exist.');
      const rest = def.constraints.filter((k) => k.id !== command.id);
      const table = attributeTable(command.owner);
      if (rest.length > 0)
        tx.set([table, command.owner.id, 'constraints'], rest);
      else tx.remove([table, command.owner.id, 'constraints']);
      return undefined;
    }
    case 'putShape':
      put(tx, 'shapes', 'shape', command.def, 'shape');
      return command.def.id;
    case 'removeShape': {
      const def = kit.shapes?.[command.id];
      if (!def)
        throw new CommandError(`The shape ${command.id} does not exist.`);
      const users = shapeUsers(kit, command.id);
      if (users.length > 0)
        throw new CommandError(
          `The shape ${def.name ?? def.id} is still in use: ${users.join('; ')}.`,
        );
      tx.remove(['shapes', command.id]);
      return undefined;
    }
    case 'putPanel': {
      const id = command.layout?.class;
      if (typeof id !== 'string' || !(id in kit.classes || id in kit.relations))
        throw new CommandError(
          `The panel layout needs the id of an existing class or relation class (it is ${JSON.stringify(id)}).`,
        );
      tx.set(['panels', id], command.layout);
      return id;
    }
    case 'removePanel': {
      if (!kit.panels?.[command.id])
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

export const kitKind: DocumentKind<Kit, KitCommand, undefined> = {
  apply: (tx, command) => applyKitCommand(tx, command),
};

export type KitStore = DocumentStore<Kit, KitCommand, undefined>;

export function createKitStore(
  kit: Kit,
  options: { user?: string; historyLimit?: number } = {},
): KitStore {
  return new DocumentStore<Kit, KitCommand, undefined>({
    kind: kitKind,
    initial: kit,
    context: undefined,
    ...(options.user ? { user: options.user } : {}),
    ...(options.historyLimit ? { historyLimit: options.historyLimit } : {}),
  });
}
