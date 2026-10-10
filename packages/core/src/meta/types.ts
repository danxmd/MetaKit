import type {
  AttributeId,
  ClassId,
  ModelTypeId,
  RelationId,
  ShapeId,
  KitId,
  ViewId,
} from '../ids';
import type { Json } from '../json';
import type { Constraint, Rule, RuleId } from './rule-types';
import type { Script, ScriptId, KitPermissions } from './script-types';
import type { PanelLayout, ShapeDef } from './shape-types';

/** Text per language code, for example `{ "en": "Task", "de": "Aufgabe" }`. */
export type Labels = Record<string, string>;

export type ChoiceOption = string | { value: string; labels?: Labels };

interface AttributeBase {
  id: AttributeId;
  /** The name formulas and scripts use. Letters, digits and underscores; unique where it is looked up. */
  key: string;
  labels?: Labels;
  help?: Labels;
  required?: boolean;
  /** Name of the group in the attribute panel. */
  group?: string;
  /** A formula (starting with `=`) that gives the value of a new object when none is set. */
  defaultFormula?: string;
}

export type TextAttribute = AttributeBase & {
  type: 'text';
  multiline?: boolean;
  maxLength?: number;
  pattern?: string;
  default?: string;
};
export type IntegerAttribute = AttributeBase & {
  type: 'integer';
  min?: number;
  max?: number;
  default?: number;
};
export type NumberAttribute = AttributeBase & {
  type: 'number';
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
  default?: number;
};
export type BooleanAttribute = AttributeBase & {
  type: 'boolean';
  display?: 'checkbox' | 'switch';
  default?: boolean;
};
/** ISO 8601 date, `2026-10-07`. */
export type DateAttribute = AttributeBase & { type: 'date'; default?: string };
/** ISO 8601 date and time, `2026-10-07T09:30:00Z`. */
export type DateTimeAttribute = AttributeBase & {
  type: 'date-time';
  default?: string;
};
/** ISO 8601 duration, `PT90M`. */
export type DurationAttribute = AttributeBase & {
  type: 'duration';
  default?: string;
};
export type ChoiceAttribute = AttributeBase & {
  type: 'choice';
  options: ChoiceOption[];
  default?: string;
};
export type MultiChoiceAttribute = AttributeBase & {
  type: 'multi-choice';
  options: ChoiceOption[];
  min?: number;
  max?: number;
  default?: string[];
};
/** Read-only; recalculated when what it reads changes (phase 5). */
export type FormulaAttribute = AttributeBase & {
  type: 'formula';
  formula: string;
  result?: 'text' | 'number' | 'boolean' | 'date';
};

export type TableColumnType =
  'text' | 'integer' | 'number' | 'boolean' | 'date' | 'choice';
export interface TableColumn {
  id: string;
  key: string;
  type: TableColumnType;
  labels?: Labels;
  options?: ChoiceOption[];
}
export type TableAttribute = AttributeBase & {
  type: 'table';
  columns: TableColumn[];
  maxRows?: number;
  default?: { [columnId: string]: Json }[];
};
export type ReferenceAttribute = AttributeBase & {
  type: 'reference';
  target: { modelTypes?: ModelTypeId[]; classes?: ClassId[] };
  max?: number;
};
/** A button that runs a rule, a script or a command. */
export type ActionAttribute = AttributeBase & {
  type: 'action';
  run: { kind: 'rule' | 'script' | 'command'; ref: string };
};
export type LinkAttribute = AttributeBase & {
  type: 'link';
  target?: 'url' | 'file' | 'any';
  default?: string;
};

export type AttributeDef =
  | TextAttribute
  | IntegerAttribute
  | NumberAttribute
  | BooleanAttribute
  | DateAttribute
  | DateTimeAttribute
  | DurationAttribute
  | ChoiceAttribute
  | MultiChoiceAttribute
  | FormulaAttribute
  | TableAttribute
  | ReferenceAttribute
  | ActionAttribute
  | LinkAttribute;

export type AttributeType = AttributeDef['type'];

export const ATTRIBUTE_TYPES: readonly AttributeType[] = [
  'text',
  'integer',
  'number',
  'boolean',
  'date',
  'date-time',
  'duration',
  'choice',
  'multi-choice',
  'formula',
  'table',
  'reference',
  'action',
  'link',
];

export type ClassKind = 'node' | 'container' | 'swimlane';
export const CLASS_KINDS: readonly ClassKind[] = [
  'node',
  'container',
  'swimlane',
];

export interface ClassDef {
  id: ClassId;
  key: string;
  kind: ClassKind;
  labels: Labels;
  extends?: ClassId;
  abstract?: boolean;
  attributes: AttributeDef[];
  /** Checks on an object, each a formula that is true when the object is fine. */
  constraints?: Constraint[];
  shape?: ShapeId;
  panel?: string;
  help?: Labels;
}

export interface RelationDef {
  id: RelationId;
  key: string;
  labels: Labels;
  extends?: RelationId;
  abstract?: boolean;
  /** Allowed classes at the start. Abstract classes mean "any subclass". Empty means "as the parent". */
  from: ClassId[];
  to: ClassId[];
  attributes: AttributeDef[];
  constraints?: Constraint[];
  shape?: ShapeId;
  help?: Labels;
}

export interface ViewDef {
  id: ViewId;
  key: string;
  labels: Labels;
  classes: ClassId[];
  relations: RelationId[];
}

export type Cardinality =
  | { kind: 'count'; class: ClassId; min?: number; max?: number }
  | {
      kind: 'degree';
      class: ClassId;
      relation: RelationId;
      end: 'from' | 'to';
      min?: number;
      max?: number;
    };

export interface ModelTypeDef {
  id: ModelTypeId;
  key: string;
  labels: Labels;
  classes: ClassId[];
  relations: RelationId[];
  views: ViewDef[];
  cardinalities: Cardinality[];
  /**
   * Which classes each container or swimlane class accepts as children (a listed class also
   * accepts its subclasses). A container class that is not listed accepts any class.
   */
  containers?: Record<ClassId, ClassId[]>;
  /** Attributes of the model itself. */
  attributes: AttributeDef[];
  constraints?: Constraint[];
  background?: ShapeId;
  help?: Labels;
}

export interface KitManifest {
  id: KitId;
  name: string;
  version: string;
  languages: string[];
  /** What the scripts of this Kit need beyond models and dialogs (ADR 0006). */
  permissions?: KitPermissions;
  /** The Kit this one was copied from, shown as "Based on …" (ADR 0010). */
  basedOn?: KitOrigin;
}

/** Where a copied Kit came from, as it was when it was copied. */
export interface KitOrigin {
  id: KitId;
  name: string;
  version: string;
}

export interface KitSettings {
  grid: { size: number; snap: boolean; visible: boolean };
  layers: { key: string; labels: Labels; visible: boolean }[];
  numbering: { enabled: boolean; prefix: string; start: number };
}

export interface Kit {
  formatVersion: number;
  manifest: KitManifest;
  settings: KitSettings;
  classes: Record<ClassId, ClassDef>;
  relations: Record<RelationId, RelationDef>;
  modelTypes: Record<ModelTypeId, ModelTypeDef>;
  /** Shapes by id; a class or relation class names one in `shape`. */
  shapes: Record<ShapeId, ShapeDef>;
  /** Panel layouts, keyed by the id of the class or relation class they belong to. */
  panels: Record<string, PanelLayout>;
  /** No-code rules (phase 5). */
  rules: Record<RuleId, Rule>;
  /** TypeScript scripts (phase 7). */
  scripts: Record<ScriptId, Script>;
}

/** The format version this release writes for Kits (2: shapes and panels, ADR 0004; 3: rules, constraints and default formulas, ADR 0005; 4: scripts and permissions, ADR 0006; 5: simple looks of shapes, ADR 0009; 6: `manifest.basedOn` for copies, ADR 0010). */
export const KIT_FORMAT_VERSION = 6;

export function optionValue(option: ChoiceOption): string {
  return typeof option === 'string' ? option : option.value;
}

export function emptyKitSettings(): KitSettings {
  return {
    grid: { size: 10, snap: true, visible: true },
    layers: [],
    numbering: { enabled: false, prefix: '', start: 1 },
  };
}
