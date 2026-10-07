import type {
  AttributeId,
  ClassId,
  ConnectorId,
  ElementId,
  ModelId,
  ModelTypeId,
  RelationId,
  ToolId,
} from '../ids';
import type { Json } from '../json';

export interface Point {
  x: number;
  y: number;
}

export interface ModelManifest {
  id: ModelId;
  name: string;
  /** The tool library this model was made with, and the version it was last saved with. */
  tool: ToolId;
  toolVersion: string;
  modelType: ModelTypeId;
  /** Explorer folder, a path such as "Sales/2026". It is a field, not a directory. */
  folder?: string;
}

export interface ElementData {
  id: ElementId;
  class: ClassId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The container this element sits in; absent for top-level elements. */
  parent?: ElementId;
  /** Values by attribute id. Values for attributes the tool no longer has are kept. */
  attrs: Record<AttributeId, Json>;
  /** Drawing order key; larger sorts on top. */
  pos: string;
}

export interface ConnectorData {
  id: ConnectorId;
  relation: RelationId;
  from: ElementId;
  to: ElementId;
  bends: Point[];
  attrs: Record<AttributeId, Json>;
  pos: string;
}

export interface Model {
  formatVersion: number;
  manifest: ModelManifest;
  /** Values of the model-level attributes of the model type. */
  attrs: Record<AttributeId, Json>;
  elements: Record<ElementId, ElementData>;
  connectors: Record<ConnectorId, ConnectorData>;
}

/** The format version this release writes for models. */
export const MODEL_FORMAT_VERSION = 1;

export const DEFAULT_ELEMENT_SIZE = { w: 120, h: 60 } as const;

/** Elements and connectors in drawing order, bottom first. Ties are broken by id. */
export function inDrawingOrder<T extends { id: string; pos: string }>(
  items: Record<string, T>,
): T[] {
  return Object.values(items).sort((a, b) =>
    a.pos === b.pos ? (a.id < b.id ? -1 : 1) : a.pos < b.pos ? -1 : 1,
  );
}
