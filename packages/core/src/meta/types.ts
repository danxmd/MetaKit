import type {
  AttributeId,
  ClassId,
  ModelTypeId,
  RelationId,
  ShapeId,
  ToolId,
  ViewId,
} from '../ids';
import type { Json } from '../json';

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
  background?: ShapeId;
  help?: Labels;
}

export interface ToolManifest {
  id: ToolId;
  name: string;
  version: string;
  languages: string[];
}

export interface ToolSettings {
  grid: { size: number; snap: boolean; visible: boolean };
  layers: { key: string; labels: Labels; visible: boolean }[];
  numbering: { enabled: boolean; prefix: string; start: number };
}

export interface ToolLibrary {
  formatVersion: number;
  manifest: ToolManifest;
  settings: ToolSettings;
  classes: Record<ClassId, ClassDef>;
  relations: Record<RelationId, RelationDef>;
  modelTypes: Record<ModelTypeId, ModelTypeDef>;
}

/** The format version this release writes for tool libraries. */
export const TOOL_FORMAT_VERSION = 1;

export function optionValue(option: ChoiceOption): string {
  return typeof option === 'string' ? option : option.value;
}

export function emptyToolSettings(): ToolSettings {
  return {
    grid: { size: 10, snap: true, visible: true },
    layers: [],
    numbering: { enabled: false, prefix: '', start: 1 },
  };
}
