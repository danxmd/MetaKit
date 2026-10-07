import {
  effectiveAttributes,
  effectiveRelationAttributes,
  modelTypeAllowsClass,
  modelTypeAllowsRelation,
  newId,
  type AttributeId,
  type ConnectorId,
  type ElementId,
  type Json,
  type Model,
  type ModelCommand,
  type ModelTypeDef,
  type Point,
  type RandomSource,
  type ToolId,
  type ToolLibrary,
} from '@metakit-app/core';

export const CLIPBOARD_KIND = 'metakit-clipboard';

export interface ClipboardElement {
  key: ElementId;
  /** The class by id and by key, so that a paste into another tool library can match by key. */
  class: string;
  classKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Attribute values by attribute key (not id), so that they can follow a class to another tool. */
  attrs: Record<string, Json>;
}

export interface ClipboardConnector {
  relation: string;
  relationKey: string;
  from: ElementId;
  to: ElementId;
  bends: Point[];
  attrs: Record<string, Json>;
}

export interface ClipboardData {
  kind: typeof CLIPBOARD_KIND;
  formatVersion: 1;
  tool: ToolId;
  elements: ClipboardElement[];
  connectors: ClipboardConnector[];
}

function keyed(
  defs: { id: string; key: string }[],
  attrs: Record<string, Json>,
): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const def of defs) if (def.id in attrs) out[def.key] = attrs[def.id]!;
  return out;
}

/** The selected elements and the connectors that join two selected elements. */
export function copySelection(
  tool: ToolLibrary,
  model: Model,
  elementIds: Iterable<ElementId>,
): ClipboardData {
  const chosen = new Set(elementIds);
  const elements: ClipboardElement[] = [];
  for (const id of chosen) {
    const e = model.elements[id];
    const cls = tool.classes[e?.class as never];
    if (!e || !cls) continue;
    elements.push({
      key: id,
      class: e.class,
      classKey: cls.key,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      attrs: keyed(safeAttributes(tool, e.class), e.attrs),
    });
  }
  const connectors: ClipboardConnector[] = [];
  for (const c of Object.values(model.connectors)) {
    if (!chosen.has(c.from) || !chosen.has(c.to)) continue;
    const rel = tool.relations[c.relation];
    if (!rel) continue;
    connectors.push({
      relation: c.relation,
      relationKey: rel.key,
      from: c.from,
      to: c.to,
      bends: c.bends.map((b) => ({ ...b })),
      attrs: keyed(safeRelationAttributes(tool, c.relation), c.attrs),
    });
  }
  return {
    kind: CLIPBOARD_KIND,
    formatVersion: 1,
    tool: tool.manifest.id,
    elements,
    connectors,
  };
}

function safeRelationAttributes(tool: ToolLibrary, relationId: string) {
  try {
    return effectiveRelationAttributes(tool, relationId as never);
  } catch {
    return [];
  }
}

function safeAttributes(tool: ToolLibrary, classId: string) {
  try {
    return effectiveAttributes(tool, classId as never);
  } catch {
    return [];
  }
}

export function serializeClipboard(data: ClipboardData): string {
  return JSON.stringify(data);
}

/** Parses clipboard text; anything that is not MetaKit clipboard data gives null. */
export function parseClipboard(text: string): ClipboardData | null {
  try {
    const value = JSON.parse(text) as Partial<ClipboardData> | null;
    if (
      !value ||
      value.kind !== CLIPBOARD_KIND ||
      value.formatVersion !== 1 ||
      !Array.isArray(value.elements) ||
      !Array.isArray(value.connectors)
    )
      return null;
    return value as ClipboardData;
  } catch {
    return null;
  }
}

export interface PastePlan {
  commands: ModelCommand[];
  /** Ids of the new elements, in the order of the clipboard. */
  elements: ElementId[];
  connectors: ConnectorId[];
  /** Items left out because the target model type does not allow their class or relation. */
  skipped: { elements: number; connectors: number };
}

/**
 * Turns clipboard data into commands for a model: new ids, attribute values matched by key, classes
 * matched by id in the same tool library and by key otherwise, everything moved by `offset`.
 */
export function planPaste(
  tool: ToolLibrary,
  modelType: ModelTypeDef,
  data: ClipboardData,
  offset: Point,
  random?: RandomSource,
): PastePlan {
  const commands: ModelCommand[] = [];
  const newIds = new Map<ElementId, ElementId>();
  const skipped = { elements: 0, connectors: 0 };
  const sameTool = data.tool === tool.manifest.id;

  for (const e of data.elements) {
    const cls =
      (sameTool ? tool.classes[e.class as never] : undefined) ??
      Object.values(tool.classes).find((c) => c.key === e.classKey);
    if (
      !cls ||
      cls.abstract ||
      !modelTypeAllowsClass(tool, modelType, cls.id)
    ) {
      skipped.elements += 1;
      continue;
    }
    const defs = safeAttributes(tool, cls.id);
    const attrs: Record<AttributeId, Json> = {};
    for (const def of defs)
      if (def.key in e.attrs) attrs[def.id] = e.attrs[def.key]!;
    const id = newId('element', random);
    newIds.set(e.key, id);
    commands.push({
      type: 'createElement',
      id,
      class: cls.id,
      x: e.x + offset.x,
      y: e.y + offset.y,
      w: e.w,
      h: e.h,
      attrs,
    });
  }
  const connectors: ConnectorId[] = [];
  for (const c of data.connectors) {
    const from = newIds.get(c.from);
    const to = newIds.get(c.to);
    const rel =
      (sameTool ? tool.relations[c.relation as never] : undefined) ??
      Object.values(tool.relations).find((r) => r.key === c.relationKey);
    if (
      !from ||
      !to ||
      !rel ||
      rel.abstract ||
      !modelTypeAllowsRelation(tool, modelType, rel.id)
    ) {
      skipped.connectors += 1;
      continue;
    }
    const attrs: Record<AttributeId, Json> = {};
    for (const def of safeRelationAttributes(tool, rel.id))
      if (def.key in c.attrs) attrs[def.id] = c.attrs[def.key]!;
    const id = newId('connector', random);
    connectors.push(id);
    commands.push({
      type: 'createConnector',
      id,
      relation: rel.id,
      from,
      to,
      bends: c.bends.map((b) => ({ x: b.x + offset.x, y: b.y + offset.y })),
      attrs,
    });
  }
  return {
    commands,
    elements: data.elements.flatMap((e) => newIds.get(e.key) ?? []),
    connectors,
    skipped,
  };
}
