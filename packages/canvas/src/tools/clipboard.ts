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
  type KitId,
  type Kit,
} from '@metakit-app/core';

export const CLIPBOARD_KIND = 'metakit-clipboard';

export interface ClipboardElement {
  key: ElementId;
  /** The class by id and by key, so that a paste into another Kit can match by key. */
  class: string;
  classKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Attribute values by attribute key (not id), so that they can follow a class to another Kit. */
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
  tool: KitId;
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
  kit: Kit,
  model: Model,
  elementIds: Iterable<ElementId>,
): ClipboardData {
  const chosen = new Set(elementIds);
  const elements: ClipboardElement[] = [];
  for (const id of chosen) {
    const e = model.elements[id];
    const cls = kit.classes[e?.class as never];
    if (!e || !cls) continue;
    elements.push({
      key: id,
      class: e.class,
      classKey: cls.key,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      attrs: keyed(safeAttributes(kit, e.class), e.attrs),
    });
  }
  const connectors: ClipboardConnector[] = [];
  for (const c of Object.values(model.connectors)) {
    if (!chosen.has(c.from) || !chosen.has(c.to)) continue;
    const rel = kit.relations[c.relation];
    if (!rel) continue;
    connectors.push({
      relation: c.relation,
      relationKey: rel.key,
      from: c.from,
      to: c.to,
      bends: c.bends.map((b) => ({ ...b })),
      attrs: keyed(safeRelationAttributes(kit, c.relation), c.attrs),
    });
  }
  return {
    kind: CLIPBOARD_KIND,
    formatVersion: 1,
    tool: kit.manifest.id,
    elements,
    connectors,
  };
}

function safeRelationAttributes(kit: Kit, relationId: string) {
  try {
    return effectiveRelationAttributes(kit, relationId as never);
  } catch {
    return [];
  }
}

function safeAttributes(kit: Kit, classId: string) {
  try {
    return effectiveAttributes(kit, classId as never);
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
 * matched by id in the same Kit and by key otherwise, everything moved by `offset`.
 */
export function planPaste(
  kit: Kit,
  modelType: ModelTypeDef,
  data: ClipboardData,
  offset: Point,
  random?: RandomSource,
): PastePlan {
  const commands: ModelCommand[] = [];
  const newIds = new Map<ElementId, ElementId>();
  const skipped = { elements: 0, connectors: 0 };
  const sameKit = data.tool === kit.manifest.id;

  for (const e of data.elements) {
    const cls =
      (sameKit ? kit.classes[e.class as never] : undefined) ??
      Object.values(kit.classes).find((c) => c.key === e.classKey);
    if (!cls || cls.abstract || !modelTypeAllowsClass(kit, modelType, cls.id)) {
      skipped.elements += 1;
      continue;
    }
    const defs = safeAttributes(kit, cls.id);
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
      (sameKit ? kit.relations[c.relation as never] : undefined) ??
      Object.values(kit.relations).find((r) => r.key === c.relationKey);
    if (
      !from ||
      !to ||
      !rel ||
      rel.abstract ||
      !modelTypeAllowsRelation(kit, modelType, rel.id)
    ) {
      skipped.connectors += 1;
      continue;
    }
    const attrs: Record<AttributeId, Json> = {};
    for (const def of safeRelationAttributes(kit, rel.id))
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
