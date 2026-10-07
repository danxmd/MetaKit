import {
  isA,
  modelTypeAllowsClass,
  modelTypeAllowsRelation,
  type ClassDef,
  type ModelTypeDef,
  type RelationDef,
  type ToolLibrary,
  type ViewDef,
  type ViewId,
} from '@metakit-app/core';

export interface Palette {
  classes: ClassDef[];
  relations: RelationDef[];
  views: ViewDef[];
  /** The ids of the relations on offer, for limiting new connectors to the active view. */
  relationIds: Set<string>;
}

const label = (
  labels: Record<string, string> | undefined,
  key: string,
  language: string,
) => labels?.[language] ?? labels?.en ?? key;

/** The text to show for a class or relation. */
export function labelOf(
  def: { key: string; labels?: Record<string, string> },
  language = 'en',
): string {
  return label(def.labels, def.key, language);
}

/**
 * What the palette offers for a model type and view: non-abstract classes and relations that the
 * view lists (a listed abstract class brings in its concrete subclasses). With no view, or a model
 * type without views, everything the model type allows is offered.
 */
export function paletteFor(
  tool: ToolLibrary,
  modelType: ModelTypeDef,
  viewId: ViewId | null = null,
  language = 'en',
): Palette {
  const view = viewId
    ? modelType.views.find((v) => v.id === viewId)
    : undefined;
  const classes = Object.values(tool.classes)
    .filter(
      (c) =>
        !c.abstract &&
        modelTypeAllowsClass(tool, modelType, c.id) &&
        (!view || view.classes.some((listed) => isA(tool, c.id, listed))),
    )
    .sort((a, b) => labelOf(a, language).localeCompare(labelOf(b, language)));
  const relations = Object.values(tool.relations)
    .filter(
      (r) =>
        !r.abstract &&
        modelTypeAllowsRelation(tool, modelType, r.id) &&
        (!view ||
          view.relations.includes(r.id) ||
          view.relations.some((v) => isRelationOf(tool, r, v))),
    )
    .sort((a, b) => labelOf(a, language).localeCompare(labelOf(b, language)));
  return {
    classes,
    relations,
    views: modelType.views,
    relationIds: new Set(relations.map((r) => r.id)),
  };
}

function isRelationOf(
  tool: ToolLibrary,
  relation: RelationDef,
  ancestor: string,
): boolean {
  let current: RelationDef | undefined = relation;
  for (let depth = 0; current && depth < 50; depth++) {
    if (current.id === ancestor) return true;
    current = current.extends ? tool.relations[current.extends] : undefined;
  }
  return false;
}
