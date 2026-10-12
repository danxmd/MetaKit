import type { ClassId, RelationId } from '../ids';
import type {
  AttributeDef,
  ClassDef,
  ModelTypeDef,
  RelationDef,
  Kit,
} from './types';

export class InheritanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InheritanceError';
  }
}

interface Node {
  id: string;
  key: string;
  extends?: string;
}

/** The definition and its ancestors, root first. Throws on a missing parent or a cycle. */
function chain<T extends Node>(
  table: Record<string, T>,
  id: string,
  what: string,
): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current !== undefined) {
    const def: T | undefined = table[current];
    if (!def) {
      throw new InheritanceError(
        result.length === 0
          ? `There is no ${what} with the id ${current}`
          : `${what} "${result[result.length - 1]!.key}" extends ${current}, which does not exist`,
      );
    }
    if (seen.has(current)) {
      throw new InheritanceError(
        `The ${what === 'class' ? 'classes' : 'relation classes'} ${[...seen].map((s) => `"${table[s]!.key}"`).join(' and ')} extend each other in a loop`,
      );
    }
    seen.add(current);
    result.push(def);
    current = def.extends;
  }
  return result.reverse();
}

/** The class and its ancestors, root first. */
export function classChain(kit: Kit, id: ClassId): ClassDef[] {
  return chain(kit.classes, id, 'class');
}

export function relationChain(kit: Kit, id: RelationId): RelationDef[] {
  return chain(kit.relations, id, 'relation class');
}

/** Inherited attributes first, then the class's own. */
export function effectiveAttributes(kit: Kit, id: ClassId): AttributeDef[] {
  return classChain(kit, id).flatMap((c) => c.attributes);
}

export function effectiveRelationAttributes(
  kit: Kit,
  id: RelationId,
): AttributeDef[] {
  return relationChain(kit, id).flatMap((r) => r.attributes);
}

/** True when `id` is `ancestorId` or descends from it. Unknown ids are not "a kind of" anything. */
export function isA(kit: Kit, id: ClassId, ancestorId: ClassId): boolean {
  try {
    return classChain(kit, id).some((c) => c.id === ancestorId);
  } catch {
    return false;
  }
}

export function relationIsA(
  kit: Kit,
  id: RelationId,
  ancestorId: RelationId,
): boolean {
  try {
    return relationChain(kit, id).some((r) => r.id === ancestorId);
  } catch {
    return false;
  }
}

/** All classes that descend from `id`, not including it. */
export function subclasses(kit: Kit, id: ClassId): ClassDef[] {
  return Object.values(kit.classes)
    .filter((c) => c.id !== id && isA(kit, c.id, id))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** The relation's own FROM and TO lists, or its nearest ancestor's when its own are empty. */
export function effectiveEnds(
  kit: Kit,
  id: RelationId,
): { from: ClassId[]; to: ClassId[] } {
  const chainRootFirst = relationChain(kit, id);
  const nearestFirst = [...chainRootFirst].reverse();
  const pick = (end: 'from' | 'to'): ClassId[] =>
    nearestFirst.find((r) => r[end].length > 0)?.[end] ?? [];
  return { from: pick('from'), to: pick('to') };
}

/** Whether an element of `classId` may sit at the given end of the relation. */
export function allowsEnd(
  kit: Kit,
  relationId: RelationId,
  end: 'from' | 'to',
  classId: ClassId,
): boolean {
  const allowed = effectiveEnds(kit, relationId)[end];
  return allowed.some((a) => isA(kit, classId, a));
}

/** A class is allowed in a model type when it, or an ancestor, is listed. */
export function modelTypeAllowsClass(
  kit: Kit,
  modelType: ModelTypeDef,
  classId: ClassId,
): boolean {
  return modelType.classes.some((c) => isA(kit, classId, c));
}

export function modelTypeAllowsRelation(
  kit: Kit,
  modelType: ModelTypeDef,
  relationId: RelationId,
): boolean {
  return modelType.relations.some((r) => relationIsA(kit, relationId, r));
}

export function findClassByKey(kit: Kit, key: string): ClassDef | undefined {
  return Object.values(kit.classes).find((c) => c.key === key);
}

export function findRelationByKey(
  kit: Kit,
  key: string,
): RelationDef | undefined {
  return Object.values(kit.relations).find((r) => r.key === key);
}

export function findModelTypeByKey(
  kit: Kit,
  key: string,
): ModelTypeDef | undefined {
  return Object.values(kit.modelTypes).find((m) => m.key === key);
}
