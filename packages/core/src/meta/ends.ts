import type { ClassId, RelationId } from '../ids';
import { effectiveEnds, isA, modelTypeAllowsClass } from './inherit';
import type { ClassDef, ModelTypeDef, RelationDef, Kit } from './types';

/**
 * What a relation connects, in words a modeller understands (openspec/changes/relation-ends).
 * The Kit lists classes at each end, often abstract ones; people place concrete objects. So every
 * description of a relation names the concrete classes that may sit at each end, by label, and the
 * palette, the hints, the refusal messages and Build mode all use these helpers to say it the same
 * way.
 */

export interface EndOptions {
  /** The language of the labels; falls back to English, then to the key. */
  language?: string;
  /** Leaves out classes this model type does not allow. */
  modelType?: ModelTypeDef;
}

/** The label of a class or relation in the language, else in English, else its key. */
export function labelOfDef(
  def: { key: string; labels?: Record<string, string> },
  language = 'en',
): string {
  return def.labels?.[language] ?? def.labels?.en ?? def.key;
}

/**
 * The concrete classes an element at one end may have. An abstract class stands for its concrete
 * subclasses; a concrete class stands for itself and its subclasses, so it is listed once. A class
 * the model type does not allow is replaced by those of its subclasses it does allow.
 */
export function concreteEndClasses(
  kit: Kit,
  ids: readonly ClassId[],
  options: EndOptions = {},
): ClassDef[] {
  const { modelType, language = 'en' } = options;
  const children = new Map<string, ClassDef[]>();
  for (const c of Object.values(kit.classes)) {
    if (!c.extends) continue;
    const list = children.get(c.extends);
    if (list) list.push(c);
    else children.set(c.extends, [c]);
  }
  const found: ClassDef[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    // The seen set also stops a broken Kit whose classes extend each other in a loop.
    if (seen.has(id)) return;
    seen.add(id);
    const c = kit.classes[id as ClassId];
    if (!c) return;
    if (
      !c.abstract &&
      (!modelType || modelTypeAllowsClass(kit, modelType, c.id))
    ) {
      found.push(c);
      return;
    }
    for (const child of children.get(id) ?? []) visit(child.id);
  };
  for (const id of ids) visit(id);
  // A class listed beside one of its ancestors is already covered by the ancestor.
  return found
    .filter((c) => !found.some((o) => o !== c && isA(kit, c.id, o.id)))
    .sort((a, b) =>
      labelOfDef(a, language).localeCompare(labelOfDef(b, language)),
    );
}

/** The concrete classes at each end of a relation, using the inherited ends. */
export function relationEndClasses(
  kit: Kit,
  relationId: RelationId,
  options: EndOptions = {},
): { from: ClassDef[]; to: ClassDef[] } {
  let ends: { from: ClassId[]; to: ClassId[] };
  try {
    ends = effectiveEnds(kit, relationId);
  } catch {
    // A broken inheritance chain is reported in Build mode; the relation's own ends will do here.
    const own = kit.relations[relationId];
    ends = { from: own?.from ?? [], to: own?.to ?? [] };
  }
  return {
    from: concreteEndClasses(kit, ends.from, options),
    to: concreteEndClasses(kit, ends.to, options),
  };
}

/** "a" or "an" before a word, by how it is usually said. */
export function withArticle(word: string): string {
  const first = word.trim().split(/\s+/)[0] ?? '';
  // Initialisms are read letter by letter: an SLA, an FAQ, a KPI.
  const initialism = /^[A-Z][A-Z0-9]+$/.test(first);
  const an = initialism
    ? /^[AEFHILMNORSX]/.test(first)
    : /^(?:hour|honest|honou?r|heir)/i.test(first) ||
      (/^[aeiou]/i.test(first) &&
        !/^(?:uni|use|usu|ur[aeiou]|eu|one\b|once)/i.test(first));
  return `${an ? 'an' : 'a'} ${word}`;
}

/** "Agent", "Agent or Human", "Agent, Human or Team"; with articles, "an Agent or a Human". */
export function orList(words: readonly string[], article = false): string {
  const items = article ? words.map(withArticle) : [...words];
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)!}`;
}

/**
 * "an Agent or a Human to a Task" from the names at each end. An empty end that the Kit leaves
 * open reads `open.word` ("any object"); one the model type filters out reads "nothing in this
 * model type".
 */
export function connectsPhrase(
  from: readonly string[],
  to: readonly string[],
  open: { from?: boolean; to?: boolean; word?: string } = {},
): string {
  const word = open.word ?? 'any object';
  const phrase = (names: readonly string[], isOpen: boolean | undefined) =>
    names.length > 0
      ? orList(names, true)
      : isOpen
        ? word
        : 'nothing in this model type';
  return `${phrase(from, open.from)} to ${phrase(to, open.to)}`;
}

/** "Connects an Agent or a Human to a Task." */
export function connectsSentence(
  from: readonly string[],
  to: readonly string[],
  open: { from?: boolean; to?: boolean; word?: string } = {},
): string {
  return `Connects ${connectsPhrase(from, to, open)}.`;
}

export interface RelationEnds {
  /** Labels of the concrete classes that may be at the start. */
  from: string[];
  to: string[];
  /** "an Agent or a Human to a Task", for sentences such as "Performs connects …". */
  phrase: string;
  /** "Connects an Agent or a Human to a Task." */
  sentence: string;
}

/** What a relation connects: the labels at each end and one plain sentence. */
export function describeRelationEnds(
  kit: Kit,
  relation: RelationDef,
  options: EndOptions = {},
): RelationEnds {
  const language = options.language ?? 'en';
  const classes = relationEndClasses(kit, relation.id, options);
  let raw: { from: ClassId[]; to: ClassId[] };
  try {
    raw = effectiveEnds(kit, relation.id);
  } catch {
    raw = { from: relation.from, to: relation.to };
  }
  const from = classes.from.map((c) => labelOfDef(c, language));
  const to = classes.to.map((c) => labelOfDef(c, language));
  const phrase = connectsPhrase(from, to, {
    from: raw.from.length === 0,
    to: raw.to.length === 0,
  });
  return { from, to, phrase, sentence: `Connects ${phrase}.` };
}

/**
 * The concrete classes that a ticked class brings in at a relation end besides itself, for
 * Build mode: for an abstract class the classes it stands for, for a concrete one its subclasses.
 */
export function includedSubclasses(
  kit: Kit,
  id: ClassId,
  language = 'en',
): ClassDef[] {
  const children = Object.values(kit.classes)
    .filter((c) => c.extends === id)
    .map((c) => c.id);
  return concreteEndClasses(kit, children, { language });
}
