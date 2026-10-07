import type { ClassId, RelationId } from '../ids';
import type {
  AttributeDef,
  ClassDef,
  ModelTypeDef,
  RelationDef,
  ToolLibrary,
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
export function classChain(tool: ToolLibrary, id: ClassId): ClassDef[] {
  return chain(tool.classes, id, 'class');
}

export function relationChain(
  tool: ToolLibrary,
  id: RelationId,
): RelationDef[] {
  return chain(tool.relations, id, 'relation class');
}

/** Inherited attributes first, then the class's own. */
export function effectiveAttributes(
  tool: ToolLibrary,
  id: ClassId,
): AttributeDef[] {
  return classChain(tool, id).flatMap((c) => c.attributes);
}

export function effectiveRelationAttributes(
  tool: ToolLibrary,
  id: RelationId,
): AttributeDef[] {
  return relationChain(tool, id).flatMap((r) => r.attributes);
}

/** True when `id` is `ancestorId` or descends from it. Unknown ids are not "a kind of" anything. */
export function isA(
  tool: ToolLibrary,
  id: ClassId,
  ancestorId: ClassId,
): boolean {
  try {
    return classChain(tool, id).some((c) => c.id === ancestorId);
  } catch {
    return false;
  }
}

export function relationIsA(
  tool: ToolLibrary,
  id: RelationId,
  ancestorId: RelationId,
): boolean {
  try {
    return relationChain(tool, id).some((r) => r.id === ancestorId);
  } catch {
    return false;
  }
}

/** All classes that descend from `id`, not including it. */
export function subclasses(tool: ToolLibrary, id: ClassId): ClassDef[] {
  return Object.values(tool.classes)
    .filter((c) => c.id !== id && isA(tool, c.id, id))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** The relation's own FROM and TO lists, or its nearest ancestor's when its own are empty. */
export function effectiveEnds(
  tool: ToolLibrary,
  id: RelationId,
): { from: ClassId[]; to: ClassId[] } {
  const chainRootFirst = relationChain(tool, id);
  const nearestFirst = [...chainRootFirst].reverse();
  const pick = (end: 'from' | 'to'): ClassId[] =>
    nearestFirst.find((r) => r[end].length > 0)?.[end] ?? [];
  return { from: pick('from'), to: pick('to') };
}

/** Whether an element of `classId` may sit at the given end of the relation. */
export function allowsEnd(
  tool: ToolLibrary,
  relationId: RelationId,
  end: 'from' | 'to',
  classId: ClassId,
): boolean {
  const allowed = effectiveEnds(tool, relationId)[end];
  return allowed.some((a) => isA(tool, classId, a));
}

/** A class is allowed in a model type when it, or an ancestor, is listed. */
export function modelTypeAllowsClass(
  tool: ToolLibrary,
  modelType: ModelTypeDef,
  classId: ClassId,
): boolean {
  return modelType.classes.some((c) => isA(tool, classId, c));
}

export function modelTypeAllowsRelation(
  tool: ToolLibrary,
  modelType: ModelTypeDef,
  relationId: RelationId,
): boolean {
  return modelType.relations.some((r) => relationIsA(tool, relationId, r));
}

export function findClassByKey(
  tool: ToolLibrary,
  key: string,
): ClassDef | undefined {
  return Object.values(tool.classes).find((c) => c.key === key);
}

export function findRelationByKey(
  tool: ToolLibrary,
  key: string,
): RelationDef | undefined {
  return Object.values(tool.relations).find((r) => r.key === key);
}

export function findModelTypeByKey(
  tool: ToolLibrary,
  key: string,
): ModelTypeDef | undefined {
  return Object.values(tool.modelTypes).find((m) => m.key === key);
}
