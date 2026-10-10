import {
  newId,
  type AttributeDef,
  type BatchCommand,
  type ClassDef,
  type ClassId,
  type Labels,
  type RelationDef,
  type RelationId,
  type ToolCommand,
  type ToolLibrary,
} from '@metakit-app/core';
import { nodeShapeFromLook, relationShapeFromLook } from '@metakit-app/shapes';
import { shapeNameFor } from '../appearance-model';
import {
  CATALOG_CLASSES,
  CATALOG_RELATIONS,
  type CatalogAttribute,
  type CatalogClass,
  type CatalogRelation,
} from './entries';

export {
  CATALOG_CLASSES,
  CATALOG_RELATIONS,
  CATALOG_TOPICS,
  type CatalogAttribute,
  type CatalogClass,
  type CatalogRelation,
  type CatalogTopic,
  type CatalogTopicId,
} from './entries';

/**
 * Turns picks from the class catalog into tool commands (openspec/changes/ai-data-catalog). Pure
 * and DOM-free: the dialog runs the batch through the command API, so adding is one undo step.
 */

export interface CatalogAddResult {
  batch: BatchCommand<ToolCommand>;
  added: {
    classes: { id: ClassId; key: string }[];
    relations: { id: RelationId; key: string }[];
  };
  /** Picked keys the tool library already has; they are left as they are. */
  skipped: string[];
}

const classByKey = new Map(CATALOG_CLASSES.map((c) => [c.key, c]));

export function catalogClass(key: string): CatalogClass | undefined {
  return classByKey.get(key);
}

/** The relation classes a catalog class takes part in, at either end (any-class ends count). */
export function relationsOfClass(key: string): CatalogRelation[] {
  return CATALOG_RELATIONS.filter(
    (r) =>
      r.from.length === 0 ||
      r.to.length === 0 ||
      r.from.includes(key) ||
      r.to.includes(key),
  );
}

/** Catalog text goes under English, or under the first language when the tool has no English. */
function languageOf(tool: ToolLibrary): string {
  const languages = tool.manifest.languages;
  return languages.includes('en') ? 'en' : (languages[0] ?? 'en');
}

function attributeDef(a: CatalogAttribute, language: string): AttributeDef {
  const { label, help, ...rest } = a;
  const labels: Labels = { [language]: label };
  const def = { ...rest, id: newId('attribute'), labels } as AttributeDef;
  if (help) def.help = { [language]: help };
  return def;
}

function classKeys(tool: ToolLibrary): Map<string, ClassId> {
  return new Map(
    Object.values(tool.classes).map((c) => [c.key, c.id] as const),
  );
}

/** A relation class whose two ends allow any class, such as Depends on. */
const isGeneric = (r: CatalogRelation) =>
  r.from.length === 0 && r.to.length === 0;

/**
 * Relation classes that connect any two classes. They never come along by themselves, because
 * they would come with every pick; the dialog offers each one to tick.
 */
export const GENERIC_RELATIONS: readonly CatalogRelation[] =
  CATALOG_RELATIONS.filter(isGeneric);

/**
 * Which catalog relation classes come with these picks. An end is met when one of its classes is
 * picked or already in the tool library by key; an end that allows any class is always met. A
 * relation class needs both ends met, a picked class on one of its named ends (so Owns comes with
 * Person, not with every class), and a key the tool library does not have yet. Generic relation
 * classes come only when they are listed in `generic`.
 */
export function catalogRelationsFor(
  picks: readonly string[],
  tool: ToolLibrary,
  generic: readonly string[] = [],
): CatalogRelation[] {
  const present = classKeys(tool);
  const picked = new Set(
    picks.filter((k) => classByKey.has(k) && !present.has(k)),
  );
  if (picked.size === 0) return [];
  const taken = new Set(Object.values(tool.relations).map((r) => r.key));
  const available = (k: string) => picked.has(k) || present.has(k);
  const met = (end: string[]) => end.length === 0 || end.some(available);
  const touches = (end: string[]) => end.some((k) => picked.has(k));
  return CATALOG_RELATIONS.filter((r) =>
    taken.has(r.key)
      ? false
      : isGeneric(r)
        ? generic.includes(r.key)
        : met(r.from) && met(r.to) && (touches(r.from) || touches(r.to)),
  );
}

export function catalogCommands(
  tool: ToolLibrary,
  picks: readonly string[],
  options: { withRelations: boolean; generic?: readonly string[] },
): CatalogAddResult {
  const language = languageOf(tool);
  const ids = classKeys(tool);
  const commands: ToolCommand[] = [];
  const added: CatalogAddResult['added'] = { classes: [], relations: [] };
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const key of picks) {
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = classByKey.get(key);
    if (!entry) continue;
    if (ids.has(key)) {
      skipped.push(key);
      continue;
    }
    const id = newId('class');
    const shape = nodeShapeFromLook(
      structuredClone(entry.look),
      newId('shape'),
      shapeNameFor(key),
    );
    const def: ClassDef = {
      id,
      key,
      kind: entry.kind,
      labels: { [language]: entry.labels.en },
      help: { [language]: entry.help },
      attributes: entry.attributes.map((a) => attributeDef(a, language)),
      shape: shape.id,
    };
    commands.push({ type: 'putShape', def: shape });
    commands.push({ type: 'putClass', def });
    added.classes.push({ id, key });
  }

  const generic = options.generic ?? [];
  if (options.withRelations || generic.length > 0) {
    const newKeys = added.classes.map((c) => c.key);
    const after = new Map(ids);
    for (const c of added.classes) after.set(c.key, c.id);
    // The tool library format needs at least one class at each end, so an end that allows any
    // class lists every class there is once the picks are in.
    const every = [...after.values()];
    const resolve = (end: string[]): ClassId[] =>
      end.length === 0
        ? every
        : end.flatMap((k) => {
            const id = after.get(k);
            return id ? [id] : [];
          });
    const wanted = catalogRelationsFor(newKeys, tool, generic).filter(
      (r) => options.withRelations || isGeneric(r),
    );
    for (const r of wanted) {
      const id = newId('relation');
      const shape = relationShapeFromLook(
        structuredClone(r.look),
        newId('shape'),
        shapeNameFor(r.key),
      );
      const def: RelationDef = {
        id,
        key: r.key,
        labels: { [language]: r.labels.en },
        help: { [language]: r.help },
        from: resolve(r.from),
        to: resolve(r.to),
        attributes: r.attributes.map((a) => attributeDef(a, language)),
        shape: shape.id,
      };
      commands.push({ type: 'putShape', def: shape });
      commands.push({ type: 'putRelation', def });
      added.relations.push({ id, key: r.key });
    }
  }

  return { batch: { type: 'batch', commands }, added, skipped };
}

/** "Added 3 classes and 2 relation classes." plus the keys that were already there. */
export function catalogResultText(result: CatalogAddResult): string {
  const n = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;
  const { classes, relations } = result.added;
  let text =
    relations.length > 0
      ? `Added ${n(classes.length, 'class', 'classes')} and ${n(relations.length, 'relation class', 'relation classes')}.`
      : `Added ${n(classes.length, 'class', 'classes')}.`;
  if (result.skipped.length > 0)
    text += ` Already in this Kit, so not added again: ${result.skipped.join(', ')}.`;
  return text;
}
