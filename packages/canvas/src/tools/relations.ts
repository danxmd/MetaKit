import {
  allowsEnd,
  modelTypeAllowsRelation,
  type ClassId,
  type ModelTypeDef,
  type RelationDef,
  type ToolLibrary,
} from '@metakit-app/core';

/**
 * Relations a connector may use from an element of `fromClass` to one of `toClass` in this model
 * type: not abstract, listed for the model type, and with both ends allowed. Sorted by key so the
 * choice offered to the user is stable.
 */
export function allowedRelations(
  tool: ToolLibrary,
  modelType: ModelTypeDef,
  fromClass: ClassId,
  toClass: ClassId,
  /** Limits the choice to the views' relations when given. */
  only?: ReadonlySet<string>,
): RelationDef[] {
  return Object.values(tool.relations)
    .filter(
      (r) =>
        !r.abstract &&
        (!only || only.has(r.id)) &&
        modelTypeAllowsRelation(tool, modelType, r.id) &&
        allowsEnd(tool, r.id, 'from', fromClass) &&
        allowsEnd(tool, r.id, 'to', toClass),
    )
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Why no relation fits, in plain English, for the message shown when a drop is refused. */
export function refusalReason(
  tool: ToolLibrary,
  fromClass: ClassId,
  toClass: ClassId,
  relation?: RelationDef,
): string {
  const name = (id: ClassId) => tool.classes[id]?.key ?? id;
  if (relation)
    return `A "${relation.key}" cannot go from a ${name(fromClass)} to a ${name(toClass)} in this model type.`;
  return `No relation allows a connector from a ${name(fromClass)} to a ${name(toClass)} in this model type.`;
}
