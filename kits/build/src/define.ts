import {
  KIT_FORMAT_VERSION,
  ModelCalculator,
  createKitStore,
  effectiveAttributes,
  emptyKitSettings,
  validateKit,
  validateModel,
  type AttributeDef,
  type ClassDef,
  type ClassId,
  type Constraint,
  type Json,
  type Kit,
  type KitCommand,
  type KitId,
  type LookBase,
  type LookColour,
  type LookIconName,
  type LookLineStyle,
  type MarkerType,
  type Model,
  type ModelTypeDef,
  type ModelTypeId,
  type NodeLook,
  type PanelControl,
  type PanelLayout,
  type RelationDef,
  type RelationId,
  type RelationLook,
  type Rule,
  type RuleAction,
  type RuleId,
  type ShapeId,
} from '@metakit-app/core';
import {
  baseInfo,
  nodeShapeFromLook,
  relationShapeFromLook,
} from '@metakit-app/shapes';
import { exportMkModel, importMkModel } from '@metakit-app/storage';
import {
  catalogCommands,
  type CatalogAttribute,
} from '@metakit-app/ui/catalog';

/**
 * Turns a short description of a built-in Kit into its `kit.json` and sample model
 * (openspec/changes/kit-library). Catalog classes come through `catalogCommands`, so their looks
 * and attributes stay the same as in the class catalog. Every id is derived from a key, so running
 * it again gives the same files.
 */

export type { CatalogAttribute };

// Ids ------------------------------------------------------------------------------------------

const low = (key: string) => key.toLowerCase();
export const classId = (key: string) => `cls_${low(key)}` as ClassId;
export const relationId = (key: string) => `rel_${low(key)}` as RelationId;
const classShapeId = (key: string) => `shp_${low(key)}` as ShapeId;
const relationShapeId = (key: string) => `shp_rel_${low(key)}` as ShapeId;
const attributeId = (owner: string, key: string) =>
  `att_${low(owner)}_${low(key)}` as AttributeDef['id'];
const shapeName = (key: string) => `${key} look`;

// Attributes -----------------------------------------------------------------------------------

/** "TargetScore" becomes "Target score"; words in capitals stay as they are. */
export function words(key: string): string {
  const parts = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
  return parts
    .map((w, i) => (i === 0 || /^[A-Z0-9]+$/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}

interface Common {
  label?: string;
  help?: string;
  required?: boolean;
}

export const text = (
  key: string,
  extra: Common & {
    maxLength?: number;
    pattern?: string;
    default?: string;
  } = {},
): CatalogAttribute => ({ type: 'text', key, label: words(key), ...extra });
export const long = (key: string, extra: Common = {}): CatalogAttribute => ({
  type: 'text',
  key,
  label: words(key),
  multiline: true,
  ...extra,
});
export const choice = (
  key: string,
  options: string[],
  extra: Common & { default?: string } = {},
): CatalogAttribute => ({
  type: 'choice',
  key,
  label: words(key),
  options,
  ...extra,
});
export const int = (
  key: string,
  extra: Common & { min?: number; max?: number; default?: number } = {},
): CatalogAttribute => ({ type: 'integer', key, label: words(key), ...extra });
export const num = (
  key: string,
  extra: Common & {
    min?: number;
    max?: number;
    unit?: string;
    decimals?: number;
  } = {},
): CatalogAttribute => ({ type: 'number', key, label: words(key), ...extra });
export const date = (key: string, extra: Common = {}): CatalogAttribute => ({
  type: 'date',
  key,
  label: words(key),
  ...extra,
});
export const bool = (
  key: string,
  extra: Common & { default?: boolean } = {},
): CatalogAttribute => ({ type: 'boolean', key, label: words(key), ...extra });
/** A table; each column's id is its key in lower case, which is how sample rows name it. */
export const table = (
  key: string,
  columns: {
    key: string;
    type: 'text' | 'integer' | 'number' | 'boolean' | 'date' | 'choice';
    options?: string[];
  }[],
  extra: Common & { maxRows?: number } = {},
): CatalogAttribute => ({
  type: 'table',
  key,
  label: words(key),
  columns: columns.map((c) => ({
    id: low(c.key),
    key: c.key,
    type: c.type,
    labels: { en: words(c.key) },
    ...(c.options ? { options: c.options } : {}),
  })),
  ...extra,
});
/** A whole number from 1 to 5. */
export const scale = (key: string, extra: Common = {}): CatalogAttribute => ({
  type: 'integer',
  key,
  min: 1,
  max: 5,
  ...extra,
  label: `${extra.label ?? words(key)} (1 to 5)`,
});
export const formula = (
  key: string,
  source: string,
  result: 'text' | 'number' | 'boolean',
  help: string,
  extra: { label?: string } = {},
): CatalogAttribute => ({
  type: 'formula',
  key,
  label: extra.label ?? words(key),
  formula: source,
  result,
  help,
});

// Looks ----------------------------------------------------------------------------------------

export interface LookOptions {
  fill: LookColour;
  border: LookColour;
  icon?: LookIconName;
  /** The attribute shown as the title; Name when left out. */
  title?: string;
  /** Not drawn by containers and swimlanes. */
  subtitle?: string;
  fields?: string[];
  borderWidth?: number;
  width?: number;
  height?: number;
}

/** A simple look in the style of the class catalog: bold name, optional subtitle and fields. */
export function look(base: LookBase, o: LookOptions): NodeLook {
  const size = { ...baseInfo(base).size };
  if (o.fields && o.fields.length > 3)
    size.height += (o.fields.length - 3) * 16;
  const result: NodeLook = {
    base,
    fill: o.fill,
    border: o.border,
    borderWidth: o.borderWidth ?? 1.5,
    borderStyle: base === 'container' ? 'dashed' : 'solid',
    title: { attribute: o.title ?? 'Name', bold: true },
    size: {
      width: o.width ?? size.width,
      height: o.height ?? size.height,
      resizable: true,
    },
  };
  if (o.subtitle) result.subtitle = { attribute: o.subtitle };
  if (o.icon) result.icon = { name: o.icon };
  if (o.fields) result.fields = o.fields;
  return result;
}

export function line(
  colour: LookColour,
  o: {
    style?: LookLineStyle;
    start?: MarkerType;
    end?: MarkerType;
    label?: string;
  } = {},
): RelationLook {
  return {
    colour,
    width: 1.5,
    style: o.style ?? 'solid',
    routing: 'orthogonal',
    start: o.start ?? 'none',
    end: o.end ?? 'arrow',
    label: o.label ? { attribute: o.label } : null,
  };
}

// Descriptions ---------------------------------------------------------------------------------

export interface ConstraintSpec {
  id: string;
  formula: string;
  message: string;
  severity?: 'error' | 'warning';
}

export interface ClassSpec {
  key: string;
  label: string;
  help: string;
  kind?: 'node' | 'container' | 'swimlane';
  extends?: string;
  abstract?: boolean;
  /** Absent for an abstract class, which is never drawn. */
  look?: NodeLook;
  /** A required Name comes first unless the class extends one that has it. */
  attributes: CatalogAttribute[];
  constraints?: ConstraintSpec[];
}

/** Changes to a class that came from the catalog. */
export interface AmendSpec {
  label?: string;
  help?: string;
  abstract?: boolean;
  /** A new look; null removes the shape (for an abstract class). */
  look?: NodeLook | null;
  /** Added at the end, or in place of the attribute with the same key. */
  attributes?: CatalogAttribute[];
  remove?: string[];
  constraints?: ConstraintSpec[];
}

export interface RelationSpec {
  key: string;
  label: string;
  help: string;
  from: string[];
  to: string[];
  attributes?: CatalogAttribute[];
  /** Checks on each connector; `from` and `to` are its two ends. */
  constraints?: ConstraintSpec[];
  look: RelationLook;
}

/** Classes added at the ends of a relation class that came from the catalog, or ends replaced. */
export interface RelationAmendSpec {
  from?: string[];
  to?: string[];
  replace?: boolean;
}

export type CardinalitySpec =
  | { kind: 'count'; class: string; min?: number; max?: number }
  | {
      kind: 'degree';
      class: string;
      relation: string;
      end: 'from' | 'to';
      min?: number;
      max?: number;
    };

export interface ModelTypeSpec {
  key: string;
  label: string;
  help: string;
  /** Class keys; every class that is not abstract when left out. */
  classes?: string[];
  /** Relation keys; every relation class when left out. */
  relations?: string[];
  views?: {
    key: string;
    label: string;
    classes: string[];
    relations: string[];
  }[];
  cardinalities?: CardinalitySpec[];
  containers?: Record<string, string[]>;
  attributes?: CatalogAttribute[];
}

export interface PanelSpec {
  class: string;
  tabs: {
    label: string;
    items: (string | { attribute: string; control?: PanelControl })[];
  }[];
  showRelations?: boolean;
}

export interface RuleSpec {
  id: RuleId;
  label: string;
  when: {
    event: Rule['when']['event'];
    class?: string;
    attribute?: string;
  };
  if?: string;
  then: RuleAction[];
}

export interface SampleElement {
  /** A short name; the element id is `el_<id>`. */
  id: string;
  class: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  parent?: string;
  attributes: Record<string, Json>;
}

export interface SampleConnector {
  relation: string;
  from: string;
  to: string;
  attributes?: Record<string, Json>;
}

export interface SampleSpec {
  file: string;
  id: `mdl_${string}`;
  name: string;
  modelType: string;
  attributes?: Record<string, Json>;
  elements: SampleElement[];
  connectors: SampleConnector[];
  /** Warnings the sample shows on purpose, so the checks have something to report. */
  intendedWarnings: number;
}

export interface KitSpec {
  /** The folder under `kits/`, also the id of its help topic. */
  folder: string;
  id: KitId;
  name: string;
  catalog: { keys: string[]; generic?: string[] };
  amend?: Record<string, AmendSpec>;
  classes?: ClassSpec[];
  relations?: RelationSpec[];
  amendRelations?: Record<string, RelationAmendSpec>;
  modelTypes: ModelTypeSpec[];
  panels?: PanelSpec[];
  rules?: RuleSpec[];
  sample: SampleSpec;
}

// Building -------------------------------------------------------------------------------------

function attributeDef(owner: string, a: CatalogAttribute): AttributeDef {
  const { label, help, ...rest } = a;
  const def = {
    ...rest,
    id: attributeId(owner, a.key),
    labels: { en: label },
  } as AttributeDef;
  if (help) def.help = { en: help };
  return def;
}

function constraint(c: ConstraintSpec): Constraint {
  return {
    id: c.id,
    formula: c.formula,
    message: c.message,
    severity: c.severity ?? 'warning',
  };
}

/** Catalog commands carry random ids; this gives them the ids derived from their keys. */
function withStableIds(commands: KitCommand[]): KitCommand[] {
  const ids = new Map<string, string>();
  for (const c of commands) {
    if (c.type === 'putClass') {
      ids.set(c.def.id, classId(c.def.key));
      if (c.def.shape) ids.set(c.def.shape, classShapeId(c.def.key));
      for (const a of c.def.attributes)
        ids.set(a.id, attributeId(c.def.key, a.key));
    } else if (c.type === 'putRelation') {
      ids.set(c.def.id, relationId(c.def.key));
      if (c.def.shape) ids.set(c.def.shape, relationShapeId(c.def.key));
      for (const a of c.def.attributes)
        ids.set(a.id, attributeId(c.def.key, a.key));
    }
  }
  let json = JSON.stringify(commands);
  for (const [from, to] of ids) json = json.split(`"${from}"`).join(`"${to}"`);
  return JSON.parse(json) as KitCommand[];
}

function emptyKit(spec: KitSpec): Kit {
  return {
    formatVersion: KIT_FORMAT_VERSION,
    manifest: {
      id: spec.id,
      name: spec.name,
      version: '1.0.0',
      languages: ['en'],
    },
    settings: emptyKitSettings(),
    classes: {},
    relations: {},
    modelTypes: {},
    shapes: {},
    panels: {},
    rules: {},
    scripts: {},
  };
}

export function buildKit(spec: KitSpec): Kit {
  const store = createKitStore(emptyKit(spec));
  const kit = () => store.state;
  const run = (commands: KitCommand[]) => {
    if (commands.length > 0) store.execute({ type: 'batch', commands });
  };
  const cls = (key: string): ClassDef => {
    const found = kit().classes[classId(key)];
    if (!found) throw new Error(`${spec.folder}: there is no class "${key}".`);
    return found;
  };
  const clsId = (key: string) => cls(key).id;

  // 1. Catalog classes and the relation classes that come with them.
  const picked = catalogCommands(kit(), spec.catalog.keys, {
    withRelations: true,
    generic: spec.catalog.generic ?? [],
  });
  const missing = spec.catalog.keys.filter(
    (k) => !picked.added.classes.some((c) => c.key === k),
  );
  if (missing.length > 0)
    throw new Error(
      `${spec.folder}: not in the catalog: ${missing.join(', ')}`,
    );
  run(withStableIds(picked.batch.commands));

  // 2. Classes of this Kit, parents first.
  for (const c of spec.classes ?? []) {
    const parent = c.extends ? cls(c.extends) : undefined;
    const hasName =
      parent !== undefined &&
      effectiveAttributes(kit(), parent.id).some((a) => a.key === 'Name');
    const name: CatalogAttribute = {
      type: 'text',
      key: 'Name',
      label: 'Name',
      required: true,
      default: c.label,
    };
    const attributes = [
      ...(hasName || c.attributes.some((a) => a.key === 'Name') ? [] : [name]),
      ...c.attributes,
    ];
    const def: ClassDef = {
      id: classId(c.key),
      key: c.key,
      kind: c.kind ?? (c.look?.base === 'container' ? 'container' : 'node'),
      labels: { en: c.label },
      help: { en: c.help },
      attributes: attributes.map((a) => attributeDef(c.key, a)),
    };
    if (parent) def.extends = parent.id;
    if (c.abstract) def.abstract = true;
    if (c.constraints) def.constraints = c.constraints.map(constraint);
    const commands: KitCommand[] = [];
    if (c.look) {
      const shape = nodeShapeFromLook(
        c.look,
        classShapeId(c.key),
        shapeName(c.key),
      );
      commands.push({ type: 'putShape', def: shape });
      def.shape = shape.id;
    }
    commands.push({ type: 'putClass', def });
    run(commands);
  }

  // 3. Changes to catalog classes.
  for (const [key, a] of Object.entries(spec.amend ?? {})) {
    const def = structuredClone(cls(key));
    if (a.label) def.labels = { en: a.label };
    if (a.help) def.help = { en: a.help };
    if (a.abstract) def.abstract = true;
    for (const attr of a.attributes ?? []) {
      const next = attributeDef(key, attr);
      const at = def.attributes.findIndex((x) => x.key === attr.key);
      if (at >= 0) def.attributes[at] = next;
      else def.attributes.push(next);
    }
    if (a.remove)
      def.attributes = def.attributes.filter((x) => !a.remove!.includes(x.key));
    if (a.constraints) def.constraints = a.constraints.map(constraint);
    const commands: KitCommand[] = [];
    const oldShape = def.shape;
    if (a.look === null) delete def.shape;
    else if (a.look) {
      const shape = nodeShapeFromLook(
        a.look,
        classShapeId(key),
        shapeName(key),
      );
      commands.push({ type: 'putShape', def: shape });
      def.shape = shape.id;
    }
    commands.push({ type: 'putClass', def });
    if (a.look === null && oldShape)
      commands.push({ type: 'removeShape', id: oldShape });
    run(commands);
  }

  // 4. Relation classes of this Kit, and wider ends for catalog ones.
  for (const r of spec.relations ?? []) {
    const shape = relationShapeFromLook(
      r.look,
      relationShapeId(r.key),
      shapeName(r.key),
    );
    const def: RelationDef = {
      id: relationId(r.key),
      key: r.key,
      labels: { en: r.label },
      help: { en: r.help },
      from: r.from.map(clsId),
      to: r.to.map(clsId),
      attributes: (r.attributes ?? []).map((a) => attributeDef(r.key, a)),
      shape: shape.id,
    };
    if (r.constraints) def.constraints = r.constraints.map(constraint);
    run([
      { type: 'putShape', def: shape },
      { type: 'putRelation', def },
    ]);
  }
  for (const [key, a] of Object.entries(spec.amendRelations ?? {})) {
    const def = structuredClone(kit().relations[relationId(key)]);
    if (!def) throw new Error(`${spec.folder}: there is no relation "${key}".`);
    if (a.replace) {
      if (a.from) def.from = [];
      if (a.to) def.to = [];
    }
    for (const k of a.from ?? []) def.from.push(clsId(k));
    for (const k of a.to ?? []) def.to.push(clsId(k));
    run([{ type: 'putRelation', def }]);
  }

  // 5. Model types.
  const relId = (key: string) => {
    const id = relationId(key);
    if (!kit().relations[id])
      throw new Error(`${spec.folder}: there is no relation "${key}".`);
    return id;
  };
  for (const m of spec.modelTypes) {
    const mtId = `mt_${low(m.key)}` as ModelTypeId;
    const def: ModelTypeDef = {
      id: mtId,
      key: m.key,
      labels: { en: m.label },
      classes: m.classes
        ? m.classes.map(clsId)
        : Object.values(kit().classes)
            .filter((c) => !c.abstract)
            .map((c) => c.id),
      relations: m.relations
        ? m.relations.map(relId)
        : Object.values(kit().relations).map((r) => r.id),
      views: (m.views ?? []).map((v) => ({
        id: `vw_${low(v.key)}` as ModelTypeDef['views'][number]['id'],
        key: v.key,
        labels: { en: v.label },
        classes: v.classes.map(clsId),
        relations: v.relations.map(relId),
      })),
      cardinalities: (m.cardinalities ?? []).map((c) =>
        c.kind === 'count'
          ? { ...c, class: clsId(c.class) }
          : { ...c, class: clsId(c.class), relation: relId(c.relation) },
      ),
      attributes: (m.attributes ?? []).map((a) =>
        attributeDef(`mt${m.key}`, a),
      ),
      help: { en: m.help },
    };
    if (m.containers)
      def.containers = Object.fromEntries(
        Object.entries(m.containers).map(([k, v]) => [clsId(k), v.map(clsId)]),
      );
    run([{ type: 'putModelType', def }]);
  }

  // 6. Panels and rules.
  for (const p of spec.panels ?? []) {
    const owner = cls(p.class);
    const keys = new Set(
      effectiveAttributes(kit(), owner.id).map((a) => a.key),
    );
    const layout: PanelLayout = {
      class: owner.id,
      tabs: p.tabs.map((t) => ({
        label: t.label,
        items: t.items.map((i) => {
          const item = typeof i === 'string' ? { attribute: i } : i;
          if (!keys.has(item.attribute))
            throw new Error(
              `${spec.folder}: the panel of ${p.class} names "${item.attribute}", which it does not have.`,
            );
          return item;
        }),
      })),
    };
    if (p.showRelations) layout.showRelations = true;
    run([{ type: 'putPanel', layout }]);
  }
  for (const r of spec.rules ?? []) {
    const rule: Rule = {
      id: r.id,
      label: r.label,
      when: {
        event: r.when.event,
        ...(r.when.class ? { class: clsId(r.when.class) } : {}),
        ...(r.when.attribute ? { attribute: r.when.attribute } : {}),
      },
      ...(r.if ? { if: r.if } : {}),
      then: r.then,
    };
    run([{ type: 'putRule', rule }]);
  }

  const result = kit();
  const issues = validateKit(result);
  if (issues.length > 0)
    throw new Error(
      `${spec.folder}: the Kit is not valid:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`,
    );
  return result;
}

/** The sample model, read through the same import as a file the person picks. */
export function buildSample(kit: Kit, sample: SampleSpec): Model {
  const el = (id: string) => `el_${id}`;
  const file = {
    formatVersion: 2,
    kind: 'mkmodel',
    id: sample.id,
    name: sample.name,
    kit: {
      id: kit.manifest.id,
      name: kit.manifest.name,
      version: kit.manifest.version,
    },
    modelType: sample.modelType,
    ...(sample.attributes ? { attributes: sample.attributes } : {}),
    elements: sample.elements.map((e) => {
      const def = kit.classes[classId(e.class)];
      const shape = def?.shape ? kit.shapes[def.shape] : undefined;
      const size = shape?.kind === 'node' ? shape.size : undefined;
      return {
        id: el(e.id),
        class: e.class,
        x: e.x,
        y: e.y,
        w: e.w ?? size?.width,
        h: e.h ?? size?.height,
        ...(e.parent ? { parent: el(e.parent) } : {}),
        attributes: e.attributes,
      };
    }),
    connectors: sample.connectors.map((c, i) => ({
      id: `cn_${String(i + 1).padStart(3, '0')}`,
      relation: c.relation,
      from: el(c.from),
      to: el(c.to),
      ...(c.attributes ? { attributes: c.attributes } : {}),
    })),
  };
  return importMkModel(kit, file);
}

export interface BuiltFiles {
  kit: Kit;
  model: Model;
  /** Path under `kits/` and text (Prettier formats it when written). */
  files: { path: string; text: string }[];
}

/** The Kit and its sample, checked: the sample has no errors and only its intended warnings. */
export function renderKit(spec: KitSpec): BuiltFiles {
  const kit = buildKit(spec);
  const model = buildSample(kit, spec.sample);
  const issues = validateModel(
    kit,
    model,
    new ModelCalculator(kit, () => model),
  );
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (errors.length > 0 || warnings.length !== spec.sample.intendedWarnings)
    throw new Error(
      `${spec.folder}: the sample has ${errors.length} errors and ${warnings.length} warnings (${spec.sample.intendedWarnings} intended):\n${issues.map((i) => `  ${i.severity}: ${i.message}`).join('\n')}`,
    );
  return {
    kit,
    model,
    files: [
      {
        path: `${spec.folder}/kit.json`,
        // In the order it was built, not sorted: the order of the values of a colour that
        // depends on an attribute is the order of the tests in the shape it makes.
        text: `${JSON.stringify(kit, null, 2)}
`,
      },
      {
        path: `${spec.folder}/${spec.sample.file}`,
        text: exportMkModel(kit, model),
      },
    ],
  };
}
