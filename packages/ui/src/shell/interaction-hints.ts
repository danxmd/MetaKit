import {
  allowsEnd,
  labelOfDef,
  modelTypeAllowsRelation,
  orList,
  withArticle,
  type ClassDef,
  type ModelTypeDef,
  type RelationDef,
  type RelationId,
  type Kit,
} from '@metakit-app/core';
import { describeEnds } from './suggestions';

/**
 * The hint line (interaction hints): one plain sentence for what the person is doing now. Pure, so
 * it is tested without a browser; the view only shows the text.
 */

export type HintState =
  | { kind: 'idle'; selected: number }
  | { kind: 'place'; class: ClassDef }
  | { kind: 'connect'; relation: RelationDef; picked: boolean }
  | { kind: 'palette-relation'; relation: RelationDef }
  | { kind: 'palette-class'; class: ClassDef }
  | { kind: 'connector'; relation: RelationDef; from: string; to: string }
  | { kind: 'refused'; reason: string };

export interface HintOptions {
  language?: string;
  /** Limits what the hints name to what this model type allows. */
  modelType?: ModelTypeDef;
}

/** Whether a relation may start or end at elements of the class (by inheritance). */
function connectsClass(
  kit: Kit,
  relation: RelationDef,
  cls: ClassDef,
  modelType: ModelTypeDef | undefined,
): boolean {
  if (relation.abstract) return false;
  if (modelType && !modelTypeAllowsRelation(kit, modelType, relation.id))
    return false;
  try {
    return (
      allowsEnd(kit, relation.id as RelationId, 'from', cls.id) ||
      allowsEnd(kit, relation.id as RelationId, 'to', cls.id)
    );
  } catch {
    // A broken inheritance chain is reported in Build mode.
    return false;
  }
}

export function hintFor(
  kit: Kit,
  state: HintState,
  options: HintOptions = {},
): string {
  const language = options.language ?? 'en';
  const ends = (relation: RelationDef) => describeEnds(kit, relation, options);
  const name = (def: { key: string; labels?: Record<string, string> }) =>
    labelOfDef(def, language);
  switch (state.kind) {
    case 'idle':
      return state.selected === 0
        ? 'Choose a concept on the left and click on the canvas to place it. Drag from a concept to connect it.'
        : state.selected === 1
          ? 'Edit the attributes on the right. Drag the handles to resize. Delete removes it.'
          : `${state.selected} selected. Drag to move them together, or use Arrange to align them.`;
    case 'place':
      return `Click on the canvas to place ${withArticle(name(state.class))}. Press Escape to stop.`;
    case 'connect':
      return state.picked
        ? `Let go on an outlined concept where the ${name(state.relation)} should end. ${ends(state.relation)}`
        : `Press on an outlined concept where the ${name(state.relation)} should start and drag to where it ends. ${ends(state.relation)}`;
    case 'palette-relation':
      return ends(state.relation);
    case 'palette-class': {
      const cls = state.class;
      const uses = Object.values(kit.relations)
        .filter((r) => connectsClass(kit, r, cls, options.modelType))
        .map(name)
        .sort((a, b) => a.localeCompare(b));
      return uses.length === 0
        ? `${name(cls)}: click on the canvas to place it.`
        : `${name(cls)} can be connected with ${orList(uses)}.`;
    }
    case 'connector':
      return `${name(state.relation)}: ${state.from} to ${state.to}. ${ends(state.relation)}`;
    case 'refused':
      return state.reason;
  }
}
