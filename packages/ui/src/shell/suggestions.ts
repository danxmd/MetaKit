import { allowedRelations } from '@metakit-app/canvas';
import {
  isA,
  modelTypeAllowsClass,
  type ClassDef,
  type ClassId,
  type ElementId,
  type Model,
  type ModelTypeDef,
  type RelationDef,
  type RelationId,
  type Kit,
} from '@metakit-app/core';

/**
 * What a concept can be connected to (smart modelling): for each relation class that allows the
 * concept's class at one end, the classes that may be at the other end, and the elements of the
 * model that already fit. Everything comes from the Kit and the model type, so a Kit
 * builder's rules are the single source of truth.
 */

export interface SuggestionTarget {
  class: ClassDef;
  /** Elements of the model of this class (or a subclass) that the relation could connect to. */
  existing: ElementId[];
}

export interface RelationSuggestion {
  relation: RelationDef;
  /** The concept is at the start of the connector: it points to these classes. */
  out: SuggestionTarget[];
  /** The concept is at the end of the connector: these classes point to it. */
  in: SuggestionTarget[];
}

const byKey = <T extends { key: string }>(a: T, b: T) =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

export function suggestConnections(
  kit: Kit,
  modelType: ModelTypeDef,
  model: Model,
  elementId: ElementId,
  /** Limits the choice to the relations of the active view. */
  onlyRelations?: ReadonlySet<string>,
  /** Limits the choice to the classes of the active view. */
  onlyClasses?: ReadonlySet<string>,
): RelationSuggestion[] {
  const element = model.elements[elementId];
  if (!element) return [];
  const own = element.class;
  const candidates = Object.values(kit.classes)
    .filter(
      (c) =>
        !c.abstract &&
        modelTypeAllowsClass(kit, modelType, c.id) &&
        (!onlyClasses || onlyClasses.has(c.id)),
    )
    .sort(byKey);

  const existingOf = (cls: ClassId): ElementId[] =>
    Object.values(model.elements)
      .filter((e) => e.id !== elementId && isA(kit, e.class, cls))
      .map((e) => e.id);

  const groups = new Map<RelationId, RelationSuggestion>();
  const group = (relation: RelationDef): RelationSuggestion => {
    let g = groups.get(relation.id as RelationId);
    if (!g) {
      g = { relation, out: [], in: [] };
      groups.set(relation.id as RelationId, g);
    }
    return g;
  };

  for (const other of candidates) {
    for (const relation of allowedRelations(
      kit,
      modelType,
      own,
      other.id,
      onlyRelations,
    ))
      group(relation).out.push({
        class: other,
        existing: existingOf(other.id),
      });
    for (const relation of allowedRelations(
      kit,
      modelType,
      other.id,
      own,
      onlyRelations,
    ))
      group(relation).in.push({ class: other, existing: existingOf(other.id) });
  }
  return [...groups.values()].sort((a, b) => byKey(a.relation, b.relation));
}

/** "Performs: from an Actor to a Task", for hints and previews. */
export function describeEnds(kit: Kit, relation: RelationDef): string {
  const a = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
  const names = (ids: readonly ClassId[]) => {
    const keys = ids.map((id) => kit.classes[id]?.key ?? id);
    return keys.length === 0
      ? 'anything'
      : keys.length === 1
        ? a(keys[0]!)
        : `${keys.slice(0, -1).map(a).join(', ')} or ${a(keys.at(-1)!)}`;
  };
  return `${relation.key} connects ${names(relation.from)} to ${names(relation.to)}.`;
}

/** One line per row of the suggestion card: "Performs → Task". */
export function suggestionRows(suggestions: readonly RelationSuggestion[]): {
  relation: RelationDef;
  direction: 'out' | 'in';
  target: SuggestionTarget;
}[] {
  return suggestions.flatMap((s) => [
    ...s.out.map((target) => ({
      relation: s.relation,
      direction: 'out' as const,
      target,
    })),
    ...s.in.map((target) => ({
      relation: s.relation,
      direction: 'in' as const,
      target,
    })),
  ]);
}

/** A free spot beside an element for a concept that a suggestion adds. */
export function spotBeside(
  model: Model,
  elementId: ElementId,
  size: { w: number; h: number } = { w: 140, h: 70 },
  gap = 60,
): { x: number; y: number } {
  const e = model.elements[elementId];
  if (!e) return { x: 0, y: 0 };
  const taken = Object.values(model.elements);
  const overlaps = (x: number, y: number) =>
    taken.some(
      (t) =>
        x < t.x + t.w + 10 &&
        x + size.w + 10 > t.x &&
        y < t.y + t.h + 10 &&
        y + size.h + 10 > t.y,
    );
  // Right of the element first, then below, then further right, until something is free.
  for (let step = 0; step < 12; step++) {
    const x = e.x + e.w + gap + (step >> 1) * (size.w + gap);
    const y = e.y + (step % 2 === 1 ? e.h + gap : 0);
    if (!overlaps(x, y)) return { x, y };
  }
  return { x: e.x + e.w + gap, y: e.y + e.h + gap };
}
