import { describe, expect, it } from 'vitest';
import {
  createEmptyKit,
  createKitStore,
  keyProblem,
  LOOK_BASE_IDS,
  LOOK_ICON_NAMES,
  validateKit,
  type ClassId,
  type Kit,
} from '@metakit-app/core';
import { namesIn, parseCached } from '@metakit-app/formula';
import { lookAttributeKeys } from '@metakit-app/shapes';
import { NEUTRAL_NAMES } from '../neutral-names';
import {
  CATALOG_CLASSES,
  CATALOG_RELATIONS,
  CATALOG_TOPICS,
  catalogCommands,
  catalogRelationsFor,
  GENERIC_RELATIONS,
  catalogResultText,
} from './catalog';

const ALL = CATALOG_CLASSES.map((c) => c.key);
const empty = () => createEmptyKit({ name: 'Catalog test' });

function apply(
  kit: Kit,
  picks: string[],
  withRelations = true,
  generic: string[] = [],
) {
  const store = createKitStore(kit);
  const result = catalogCommands(store.state, picks, {
    withRelations,
    generic,
  });
  const run = store.execute(result.batch);
  expect(run.ok).toBe(true);
  return { store, result };
}

const errors = (kit: Kit) => validateKit(kit);

const byKey = (kit: Kit, key: string) =>
  Object.values(kit.classes).find((c) => c.key === key);
const relationByKey = (kit: Kit, key: string) =>
  Object.values(kit.relations).find((r) => r.key === key);

describe('class catalog entries', () => {
  it('has sixteen topics, about 250 classes and about sixty relation classes', () => {
    expect(CATALOG_TOPICS.map((t) => t.label)).toEqual([
      'General',
      'People and organisation',
      'Strategy and value',
      'Customer and marketing',
      'Finance and operations',
      'Project delivery',
      'Enterprise architecture',
      'Software and cloud',
      'Security',
      'Data',
      'Data mesh',
      'Data quality and MDM',
      'Analytics and BI',
      'AI and MLOps',
      'Generative AI',
      'Governance and privacy',
    ]);
    expect(new Set(CATALOG_TOPICS.map((t) => t.id)).size).toBe(16);
    expect(CATALOG_CLASSES.length).toBeGreaterThanOrEqual(240);
    expect(CATALOG_RELATIONS.length).toBeGreaterThanOrEqual(60);
    const known = new Set(CATALOG_TOPICS.map((t) => t.id));
    for (const c of CATALOG_CLASSES)
      expect(known.has(c.topic), c.key).toBe(true);
    // Every tab has enough to choose from.
    for (const topic of CATALOG_TOPICS)
      expect(
        CATALOG_CLASSES.filter((c) => c.topic === topic.id).length,
        topic.id,
      ).toBeGreaterThanOrEqual(8);
  });

  it('uses valid, unique keys for classes, relation classes and attributes', () => {
    const keys = [...CATALOG_CLASSES, ...CATALOG_RELATIONS].map((e) => e.key);
    expect(new Set(CATALOG_CLASSES.map((c) => c.key)).size).toBe(
      CATALOG_CLASSES.length,
    );
    expect(new Set(CATALOG_RELATIONS.map((r) => r.key)).size).toBe(
      CATALOG_RELATIONS.length,
    );
    for (const key of keys) expect(keyProblem(key), key).toBeNull();
    for (const entry of [...CATALOG_CLASSES, ...CATALOG_RELATIONS]) {
      const attrKeys = entry.attributes.map((a) => a.key);
      expect(new Set(attrKeys).size, entry.key).toBe(attrKeys.length);
      for (const k of attrKeys)
        expect(keyProblem(k), `${entry.key}.${k}`).toBeNull();
      expect(entry.labels.en.trim(), entry.key).not.toBe('');
      expect(entry.help.trim(), entry.key).not.toBe('');
    }
  });

  it('gives every class a required Name defaulting to its label and a Description', () => {
    for (const c of CATALOG_CLASSES) {
      const name = c.attributes.find((a) => a.key === 'Name');
      expect(name, c.key).toMatchObject({
        type: 'text',
        required: true,
        default: c.labels.en,
      });
      expect(
        c.attributes.some((a) => a.key === 'Description'),
        c.key,
      ).toBe(true);
    }
  });

  it('has looks with known forms and icons that read only attributes of the class', () => {
    for (const c of CATALOG_CLASSES) {
      expect(LOOK_BASE_IDS, c.key).toContain(c.look.base);
      if (c.look.icon)
        expect(LOOK_ICON_NAMES, c.key).toContain(c.look.icon.name);
      expect(c.kind === 'container', c.key).toBe(c.look.base === 'container');
      const keys = new Set(c.attributes.map((a) => a.key));
      for (const k of lookAttributeKeys(c.look))
        expect(keys.has(k), `${c.key} look reads ${k}`).toBe(true);
    }
    for (const r of CATALOG_RELATIONS) {
      const keys = new Set(r.attributes.map((a) => a.key));
      for (const k of lookAttributeKeys(r.look))
        expect(keys.has(k), `${r.key} look reads ${k}`).toBe(true);
    }
  });

  it('names only catalog classes at the ends of relation classes', () => {
    const known = new Set(ALL);
    for (const r of CATALOG_RELATIONS)
      for (const k of [...r.from, ...r.to])
        expect(known.has(k), `${r.key} names ${k}`).toBe(true);
  });

  it('gives every relation-class end existing, distinct keys, and "any class" only to generic ends', () => {
    const known = new Set(ALL);
    // Relation classes with one end open to any class; every other end names its classes.
    const openEnded = CATALOG_RELATIONS.filter(
      (r) => (r.from.length === 0) !== (r.to.length === 0),
    ).map((r) => r.key);
    expect(openEnded).toEqual(['Owns']);
    for (const r of CATALOG_RELATIONS)
      for (const end of [r.from, r.to]) {
        expect(new Set(end).size, r.key).toBe(end.length);
        for (const k of end)
          expect(known.has(k), `${r.key} names ${k}`).toBe(true);
      }
  });

  it('has formulas that parse and read attributes of their own class', () => {
    const formulas = CATALOG_CLASSES.flatMap((c) =>
      c.attributes.flatMap((a) =>
        a.type === 'formula'
          ? [{ cls: c, key: a.key, formula: a.formula }]
          : [],
      ),
    );
    expect(formulas.length).toBeGreaterThanOrEqual(40);
    for (const f of formulas) {
      const parsed = parseCached(f.formula);
      expect('error' in parsed ? parsed.error : null, f.formula).toBeNull();
      if ('error' in parsed) continue;
      const own = new Set(f.cls.attributes.map((a) => a.key));
      for (const name of namesIn(parsed.expr))
        expect(own.has(name), `${f.cls.key}.${f.key} reads ${name}`).toBe(true);
    }
  });

  it('never names a company, a client or a vendor product', () => {
    const text = JSON.stringify([
      CATALOG_TOPICS,
      CATALOG_CLASSES,
      CATALOG_RELATIONS,
    ]);
    for (const name of [...NEUTRAL_NAMES, 'Kafka'])
      expect(text, name).not.toMatch(new RegExp(`\\b${name}\\b`, 'i'));
  });
});

describe('catalogCommands', () => {
  it('adds everything to an empty Kit as a valid result', () => {
    const { store, result } = apply(
      empty(),
      ALL,
      true,
      GENERIC_RELATIONS.map((r) => r.key),
    );
    const kit = store.state;
    expect(errors(kit)).toEqual([]);
    expect(Object.keys(kit.classes)).toHaveLength(CATALOG_CLASSES.length);
    expect(Object.keys(kit.relations)).toHaveLength(CATALOG_RELATIONS.length);
    expect(Object.keys(kit.shapes)).toHaveLength(
      CATALOG_CLASSES.length + CATALOG_RELATIONS.length,
    );
    expect(result.skipped).toEqual([]);
    // Every class draws with its own simple look.
    for (const c of Object.values(kit.classes))
      expect(kit.shapes[c.shape!]?.look, c.key).toBeDefined();
    // Every formula in the result parses.
    for (const c of Object.values(kit.classes))
      for (const a of c.attributes)
        if (a.type === 'formula')
          expect('error' in parseCached(a.formula), a.key).toBe(false);
    // "Any class" ends list every class.
    const every = Object.keys(kit.classes).sort();
    expect([...relationByKey(kit, 'DependsOn')!.from].sort()).toEqual(every);
    expect([...relationByKey(kit, 'DependsOn')!.to].sort()).toEqual(every);
    expect([...relationByKey(kit, 'Owns')!.to].sort()).toEqual(every);
  });

  it('is one undo step, and undo restores the Kit', () => {
    const kit = empty();
    const { store } = apply(kit, ['Dataset', 'DataPipeline', 'DataStore']);
    expect(Object.keys(store.state.classes)).toHaveLength(3);
    expect(store.undo()).toBe(true);
    expect(store.state).toEqual(kit);
    expect(store.canUndo()).toBe(false);
  });

  it('adds the relation classes between the picked classes', () => {
    const { store, result } = apply(empty(), [
      'Dataset',
      'DataPipeline',
      'DataStore',
    ]);
    const kit = store.state;
    const keys = result.added.relations.map((r) => r.key).sort();
    // Depends on connects any two classes, so it only comes when it is ticked.
    expect(keys).toEqual(['FlowsTo', 'ReadsFrom', 'WritesTo']);
    const id = (k: string) => byKey(kit, k)!.id;
    expect(relationByKey(kit, 'WritesTo')).toMatchObject({
      from: [id('DataPipeline')],
      to: [id('DataStore'), id('Dataset')],
    });
    expect(relationByKey(kit, 'ReadsFrom')).toMatchObject({
      from: [id('DataPipeline')],
      to: [id('DataStore'), id('Dataset')],
    });
    expect(catalogResultText(result)).toBe(
      'Added 3 classes and 3 relation classes.',
    );
  });

  it('adds no relation classes when asked not to', () => {
    const { store, result } = apply(
      empty(),
      ['Dataset', 'DataPipeline'],
      false,
    );
    expect(Object.keys(store.state.relations)).toHaveLength(0);
    expect(catalogResultText(result)).toBe('Added 2 classes.');
  });

  it('skips taken keys and connects relation classes to the existing class', () => {
    const start = apply(empty(), ['Dataset'], false).store.state;
    const existing = byKey(start, 'Dataset')!.id;
    const store = createKitStore(start);
    const result = catalogCommands(store.state, ['Dataset', 'DataPipeline'], {
      withRelations: true,
    });
    expect(result.skipped).toEqual(['Dataset']);
    expect(result.added.classes.map((c) => c.key)).toEqual(['DataPipeline']);
    expect(store.execute(result.batch).ok).toBe(true);
    const kit = store.state;
    expect(
      Object.values(kit.classes).filter((c) => c.key === 'Dataset'),
    ).toHaveLength(1);
    expect(relationByKey(kit, 'WritesTo')?.to).toEqual([existing]);
    expect(catalogResultText(result)).toContain(
      'Already in this Kit, so not added again: Dataset.',
    );
    expect(errors(kit)).toEqual([]);
  });

  it('connects to a hand-made class that has a catalog key', () => {
    const kit = empty();
    const own = 'cls_handmade00' as ClassId;
    kit.classes[own] = {
      id: own,
      key: 'MLModel',
      kind: 'node',
      labels: { en: 'My model' },
      attributes: [],
    };
    const { store } = apply(kit, ['ModelDeployment']);
    expect(relationByKey(store.state, 'DeployedAs')).toMatchObject({
      from: [own],
    });
    // The hand-made class is left as it was.
    expect(store.state.classes[own]).toEqual(kit.classes[own]);
  });

  it('does not add a relation class whose key is taken', () => {
    const first = apply(empty(), ['Dataset', 'DataPipeline']).store.state;
    const before = relationByKey(first, 'WritesTo');
    const { store, result } = apply(first, ['DataStore']);
    expect(result.added.relations.map((r) => r.key)).not.toContain('WritesTo');
    expect(relationByKey(store.state, 'WritesTo')).toEqual(before);
  });

  it('puts labels under the first language when the Kit has no English', () => {
    const kit = createEmptyKit({ name: 'Deutsch', languages: ['de'] });
    const { store } = apply(kit, ['Risk', 'Control']);
    const risk = byKey(store.state, 'Risk')!;
    expect(risk.labels).toEqual({ de: 'Risk' });
    expect(errors(store.state)).toEqual([]);
  });

  it('adds a generative AI set from its tab with the relation classes between them', () => {
    const picks = ['Prompt', 'KnowledgeBase', 'Retriever', 'FoundationModel'];
    for (const key of picks)
      expect(CATALOG_CLASSES.find((c) => c.key === key)?.topic, key).toBe(
        'genai',
      );
    const { store, result } = apply(empty(), picks);
    expect(result.added.classes.map((c) => c.key)).toEqual(picks);
    expect(result.added.relations.map((r) => r.key)).toEqual(['Searches']);
    expect(errors(store.state)).toEqual([]);
    expect(store.undo()).toBe(true);
    expect(Object.keys(store.state.classes)).toHaveLength(0);
  });

  it('previews the relation classes for picks', () => {
    expect(
      catalogRelationsFor(['Control', 'Risk'], empty()).map((r) => r.key),
    ).toEqual(['Mitigates']);
    expect(catalogRelationsFor([], empty())).toEqual([]);
  });

  it('brings a relation class with an any-class end only with a class on its named end', () => {
    // Owns runs from a person, team or data owner to any class.
    expect(
      catalogRelationsFor(['Dataset', 'Risk'], empty()).map((r) => r.key),
    ).not.toContain('Owns');
    expect(
      catalogRelationsFor(['Dataset', 'Person'], empty()).map((r) => r.key),
    ).toContain('Owns');
  });

  it('adds a generic relation class only when it is ticked, also without the other relations', () => {
    const generic = GENERIC_RELATIONS.map((r) => r.key);
    expect(generic).toEqual(['DependsOn']);
    const { store, result } = apply(
      empty(),
      ['Task', 'Milestone'],
      false,
      generic,
    );
    expect(result.added.relations.map((r) => r.key)).toEqual(['DependsOn']);
    const dependsOn = relationByKey(store.state, 'DependsOn')!;
    expect(dependsOn.from).toHaveLength(2);
    expect(errors(store.state)).toEqual([]);
  });
});
