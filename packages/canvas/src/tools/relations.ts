import {
  allowsEnd,
  modelTypeAllowsRelation,
  type ClassId,
  type RelationId,
  type ModelTypeDef,
  type RelationDef,
  type Kit,
} from '@metakit-app/core';

/**
 * Relations a connector may use from an element of `fromClass` to one of `toClass` in this model
 * type: not abstract, listed for the model type, and with both ends allowed. Sorted by key so the
 * choice offered to the user is stable.
 */
export function allowedRelations(
  kit: Kit,
  modelType: ModelTypeDef,
  fromClass: ClassId,
  toClass: ClassId,
  /** Limits the choice to the views' relations when given. */
  only?: ReadonlySet<string>,
): RelationDef[] {
  return Object.values(kit.relations)
    .filter(
      (r) =>
        !r.abstract &&
        (!only || only.has(r.id)) &&
        modelTypeAllowsRelation(kit, modelType, r.id) &&
        allowsEnd(kit, r.id, 'from', fromClass) &&
        allowsEnd(kit, r.id, 'to', toClass),
    )
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * Whether an element of `cls` is worth highlighting while a relation is being connected: as the
 * start (no `from` yet) when some usable relation may begin at its class, or as the end when a
 * usable relation may go from the picked class to it. `relation` limits this to the chosen one.
 */
export function canConnectAt(
  kit: Kit,
  modelType: ModelTypeDef,
  cls: ClassId,
  options: {
    relation?: RelationId | undefined;
    from?: ClassId | undefined;
    only?: ReadonlySet<string> | undefined;
  } = {},
): boolean {
  const { relation, from, only } = options;
  if (from)
    return allowedRelations(kit, modelType, from, cls, only).some(
      (r) => !relation || r.id === relation,
    );
  return Object.values(kit.relations).some(
    (r) =>
      !r.abstract &&
      (!relation || r.id === relation) &&
      (!only || only.has(r.id)) &&
      modelTypeAllowsRelation(kit, modelType, r.id) &&
      allowsEnd(kit, r.id, 'from', cls),
  );
}

/** Why no relation fits, in plain English, for the message shown when a drop is refused. */
export function refusalReason(
  kit: Kit,
  fromClass: ClassId,
  toClass: ClassId,
  relation?: RelationDef,
): string {
  const name = (id: ClassId) => kit.classes[id]?.key ?? id;
  if (relation)
    return `A "${relation.key}" cannot go from a ${name(fromClass)} to a ${name(toClass)} in this model type.`;
  return `No relation allows a connector from a ${name(fromClass)} to a ${name(toClass)} in this model type.`;
}
