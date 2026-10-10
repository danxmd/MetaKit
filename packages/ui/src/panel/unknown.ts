import {
  effectiveAttributes,
  effectiveRelationAttributes,
  type AttributeDef,
  type ClassId,
  type Json,
  type RelationId,
  type Kit,
} from '@metakit-app/core';

export interface UnknownAttribute {
  /** The attribute id the value is stored under. */
  id: string;
  value: Json;
}

/**
 * Stored values whose attribute the class (or relation class, or model type) no longer defines.
 * They stay in the model until the user removes them. An unknown class lists nothing: its whole
 * object is already shown as a placeholder.
 */
export function unknownAttributes(
  kit: Kit,
  classId: string,
  attrs: Readonly<Record<string, Json>>,
): UnknownAttribute[] {
  // The tables are keyed by prefixed ids; a plain string lookup is how the id arrives from a model.
  const classes = kit.classes as Record<string, unknown>;
  const relations = kit.relations as Record<string, unknown>;
  const modelTypes = kit.modelTypes as Record<
    string,
    { attributes: AttributeDef[] } | undefined
  >;
  let defs: AttributeDef[] | undefined;
  try {
    if (Object.hasOwn(classes, classId))
      defs = effectiveAttributes(kit, classId as ClassId);
    else if (Object.hasOwn(relations, classId))
      defs = effectiveRelationAttributes(kit, classId as RelationId);
    else if (Object.hasOwn(modelTypes, classId))
      defs = modelTypes[classId]!.attributes;
  } catch {
    // A class that extends itself in a loop has no reliable attribute list.
    return [];
  }
  if (!defs) return [];
  const known = new Set(defs.map((d) => d.id as string));
  return Object.entries(attrs)
    .filter(([id]) => !known.has(id))
    .map(([id, value]) => ({ id, value }));
}
