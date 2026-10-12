import type { ClassId, ElementId, ModelTypeId } from '../ids';
import { classChain, isA } from '../meta/inherit';
import type { Kit } from '../meta/types';
import type { ElementData, Model, Point } from './types';

/** How far a swimlane keeps its children from its edges when it grows to fit them. */
export const FIT_PADDING = 10;

/** True when elements of this class can hold other elements (`container` or `swimlane`). */
export function isContainerClass(kit: Kit, classId: ClassId): boolean {
  const kind = kit.classes[classId]?.kind;
  return kind === 'container' || kind === 'swimlane';
}

export function isSwimlaneClass(kit: Kit, classId: ClassId): boolean {
  return kit.classes[classId]?.kind === 'swimlane';
}

/**
 * Whether a container of `containerClass` accepts a child of `childClass` in the model type. The
 * rule of the nearest class in the container's inheritance chain that has one applies; a container
 * class with no rule accepts anything. A listed class also accepts its subclasses.
 */
export function containerAccepts(
  kit: Kit,
  modelTypeId: ModelTypeId,
  containerClass: ClassId,
  childClass: ClassId,
): boolean {
  const rules = kit.modelTypes[modelTypeId]?.containers;
  if (!rules) return true;
  let chain: ClassId[];
  try {
    chain = classChain(kit, containerClass)
      .map((c) => c.id)
      .reverse();
  } catch {
    // A broken inheritance chain is a Kit problem; use the class alone.
    chain = [containerClass];
  }
  for (const id of chain) {
    const accepted = rules[id];
    if (accepted) return accepted.some((a) => isA(kit, childClass, a));
  }
  return true;
}

/** Direct children by container, built in one pass over the model. */
export function childrenIndex(model: Model): Map<ElementId, ElementId[]> {
  const index = new Map<ElementId, ElementId[]>();
  for (const el of Object.values(model.elements)) {
    if (el.parent === undefined) continue;
    const list = index.get(el.parent);
    if (list) list.push(el.id);
    else index.set(el.parent, [el.id]);
  }
  return index;
}

/**
 * Everything inside an element, at any depth, without the element itself. Pass a prebuilt `index`
 * to look up many elements at the cost of their own descendants only. Safe on a looping parent
 * graph: every element is listed once.
 */
export function descendantsOf(
  model: Model,
  id: ElementId,
  index: ReadonlyMap<ElementId, ElementId[]> = childrenIndex(model),
): ElementId[] {
  const found: ElementId[] = [];
  const seen = new Set<ElementId>([id]);
  const stack: ElementId[] = [id];
  while (stack.length > 0) {
    for (const child of index.get(stack.pop()!) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      found.push(child);
      stack.push(child);
    }
  }
  return found;
}

/** The parent chain of an element, nearest first. Stops at a missing parent or when it loops. */
export function ancestorsOf(model: Model, id: ElementId): ElementId[] {
  const chain: ElementId[] = [];
  const seen = new Set<ElementId>([id]);
  let parent = model.elements[id]?.parent;
  while (parent !== undefined && !seen.has(parent) && model.elements[parent]) {
    chain.push(parent);
    seen.add(parent);
    parent = model.elements[parent]!.parent;
  }
  return chain;
}

/** True when following `parent` from this element comes back to a visited element. */
export function parentChainLoops(model: Model, id: ElementId): boolean {
  const seen = new Set<ElementId>([id]);
  let parent = model.elements[id]?.parent;
  while (parent !== undefined && model.elements[parent]) {
    if (seen.has(parent)) return true;
    seen.add(parent);
    parent = model.elements[parent]!.parent;
  }
  return false;
}

/**
 * The ids from `ids` that no other id in `ids` contains. Moving or deleting these takes the rest
 * along, so acting on every id would handle the contents twice.
 */
export function outermostOf(
  model: Model,
  ids: Iterable<ElementId>,
): ElementId[] {
  const set = new Set(ids);
  return [...set].filter(
    (id) => !ancestorsOf(model, id).some((ancestor) => set.has(ancestor)),
  );
}

const contains = (el: ElementData, p: Point): boolean =>
  p.x >= el.x && p.x <= el.x + el.w && p.y >= el.y && p.y <= el.y + el.h;

/**
 * The deepest container or swimlane whose box contains `centre` and that accepts `classId`, or
 * null. Elements in `ignoreIds`, and anything inside them, are skipped, so passing the moved
 * element can never produce a parent that is itself or one of its own descendants. Of two
 * containers at the same depth the one drawn on top wins.
 */
export function containerAt(
  model: Model,
  kit: Kit,
  modelTypeId: ModelTypeId,
  centre: Point,
  ignoreIds: Iterable<ElementId>,
  classId: ClassId,
): ElementId | null {
  const ignore = new Set(ignoreIds);
  let best: { el: ElementData; depth: number } | null = null;
  for (const el of Object.values(model.elements)) {
    if (!contains(el, centre) || !isContainerClass(kit, el.class)) continue;
    if (!containerAccepts(kit, modelTypeId, el.class, classId)) continue;
    const chain = ancestorsOf(model, el.id);
    if (ignore.has(el.id) || chain.some((a) => ignore.has(a))) continue;
    const depth = chain.length;
    if (
      !best ||
      depth > best.depth ||
      (depth === best.depth &&
        (el.pos > best.el.pos ||
          (el.pos === best.el.pos && el.id > best.el.id)))
    )
      best = { el, depth };
  }
  return best?.el.id ?? null;
}
