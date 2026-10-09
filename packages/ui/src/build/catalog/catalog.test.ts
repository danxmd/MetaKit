import { describe, expect, it } from 'vitest';
import {
  createEmptyTool,
  createToolStore,
  keyProblem,
  LOOK_BASE_IDS,
  LOOK_ICON_NAMES,
  validateToolLibrary,
  type ClassId,
  type ToolLibrary,
} from '@metakit-app/core';
import { parseCached } from '@metakit-app/formula';
import { lookAttributeKeys } from '@metakit-app/shapes';
import {
  CATALOG_CLASSES,
  CATALOG_RELATIONS,
  CATALOG_TOPICS,
  catalogCommands,
  catalogRelationsFor,
  catalogResultText,
} from './catalog';

const ALL = CATALOG_CLASSES.map((c) => c.key);
const empty = () => createEmptyTool({ name: 'Catalog test' });

function apply(tool: ToolLibrary, picks: string[], withRelations = true) {
  const store = createToolStore(tool);
  const result = catalogCommands(store.state, picks, { withRelations });
  const run = store.execute(result.batch);
  expect(run.ok).toBe(true);
  return { store, result };
}

const errors = (tool: ToolLibrary) => validateToolLibrary(tool);

const byKey = (tool: ToolLibrary, key: string) =>
  Object.values(tool.classes).find((c) => c.key === key);
const relationByKey = (tool: ToolLibrary, key: string) =>
  Object.values(tool.relations).find((r) => r.key === key);

describe('class catalog entries', () => {
  it('has seven topics, about sixty classes and about twenty relation classes', () => {
    expect(CATALOG_TOPICS.map((t) => t.label)).toEqual([
      'General',
      'Business and strategy',
      'Project delivery',
      'Data',
      'AI and machine learning',
      'Applications and cloud',
      'Governance and risk',
    ]);
    expect(CATALOG_CLASSES.length).toBeGreaterThanOrEqual(55);
    expect(CATALOG_RELATIONS.length).toBeGreaterThanOrEqual(18);
    for (const topic of CATALOG_TOPICS)
      expect(CATALOG_CLASSES.some((c) => c.topic === topic.id)).toBe(true);
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

  it('has formulas that parse and read attributes of their own class', () => {
    const formulas = CATALOG_CLASSES.flatMap((c) =>
      c.attributes.flatMap((a) =>
        a.type === 'formula' ? [{ cls: c, formula: a.formula }] : [],
      ),
    );
    expect(formulas.map((f) => f.cls.key).sort()).toEqual([
      'DataQualityRule',
      'Evaluation',
      'KPI',
      'Risk',
      'Risk',
    ]);
    for (const f of formulas) {
      const parsed = parseCached(f.formula);
      expect('error' in parsed ? parsed.error : null, f.formula).toBeNull();
    }
  });

  it('never names a company or a vendor product', () => {
    const text = JSON.stringify([CATALOG_CLASSES, CATALOG_RELATIONS]);
    for (const name of [
      'Accenture',
      'Microsoft',
      'Azure',
      'Google',
      'Amazon',
      'AWS',
      'Snowflake',
      'Databricks',
      'OpenAI',
      'Oracle',
      'SAP',
      'Salesforce',
      'Kafka',
    ])
      expect(text, name).not.toMatch(new RegExp(`\\b${name}\\b`, 'i'));
  });
});

describe('catalogCommands', () => {
  it('adds everything to an empty tool library as a valid result', () => {
    const { store, result } = apply(empty(), ALL);
    const tool = store.state;
    expect(errors(tool)).toEqual([]);
    expect(Object.keys(tool.classes)).toHaveLength(CATALOG_CLASSES.length);
    expect(Object.keys(tool.relations)).toHaveLength(CATALOG_RELATIONS.length);
    expect(Object.keys(tool.shapes)).toHaveLength(
      CATALOG_CLASSES.length + CATALOG_RELATIONS.length,
    );
    expect(result.skipped).toEqual([]);
    // Every class draws with its own simple look.
    for (const c of Object.values(tool.classes))
      expect(tool.shapes[c.shape!]?.look, c.key).toBeDefined();
    // Every formula in the result parses.
    for (const c of Object.values(tool.classes))
      for (const a of c.attributes)
        if (a.type === 'formula')
          expect('error' in parseCached(a.formula), a.key).toBe(false);
    // "Any class" ends list every class.
    const every = Object.keys(tool.classes).sort();
    expect([...relationByKey(tool, 'DependsOn')!.from].sort()).toEqual(every);
    expect([...relationByKey(tool, 'DependsOn')!.to].sort()).toEqual(every);
    expect([...relationByKey(tool, 'Owns')!.to].sort()).toEqual(every);
  });

  it('is one undo step, and undo restores the tool library', () => {
    const tool = empty();
    const { store } = apply(tool, ['Dataset', 'DataPipeline', 'DataStore']);
    expect(Object.keys(store.state.classes)).toHaveLength(3);
    expect(store.undo()).toBe(true);
    expect(store.state).toEqual(tool);
    expect(store.canUndo()).toBe(false);
  });

  it('adds the relation classes between the picked classes', () => {
    const { store, result } = apply(empty(), [
      'Dataset',
      'DataPipeline',
      'DataStore',
    ]);
    const tool = store.state;
    const keys = result.added.relations.map((r) => r.key).sort();
    expect(keys).toEqual(['DependsOn', 'FlowsTo', 'ReadsFrom', 'WritesTo']);
    const id = (k: string) => byKey(tool, k)!.id;
    expect(relationByKey(tool, 'WritesTo')).toMatchObject({
      from: [id('DataPipeline')],
      to: [id('DataStore'), id('Dataset')],
    });
    expect(relationByKey(tool, 'ReadsFrom')).toMatchObject({
      from: [id('DataPipeline')],
      to: [id('DataStore'), id('Dataset')],
    });
    expect(catalogResultText(result)).toBe(
      'Added 3 classes and 4 relation classes.',
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
    const store = createToolStore(start);
    const result = catalogCommands(store.state, ['Dataset', 'DataPipeline'], {
      withRelations: true,
    });
    expect(result.skipped).toEqual(['Dataset']);
    expect(result.added.classes.map((c) => c.key)).toEqual(['DataPipeline']);
    expect(store.execute(result.batch).ok).toBe(true);
    const tool = store.state;
    expect(
      Object.values(tool.classes).filter((c) => c.key === 'Dataset'),
    ).toHaveLength(1);
    expect(relationByKey(tool, 'WritesTo')?.to).toEqual([existing]);
    expect(catalogResultText(result)).toContain(
      'Already in this tool library, so not added again: Dataset.',
    );
    expect(errors(tool)).toEqual([]);
  });

  it('connects to a hand-made class that has a catalog key', () => {
    const tool = empty();
    const own = 'cls_handmade00' as ClassId;
    tool.classes[own] = {
      id: own,
      key: 'MLModel',
      kind: 'node',
      labels: { en: 'My model' },
      attributes: [],
    };
    const { store } = apply(tool, ['ModelDeployment']);
    expect(relationByKey(store.state, 'DeployedAs')).toMatchObject({
      from: [own],
    });
    // The hand-made class is left as it was.
    expect(store.state.classes[own]).toEqual(tool.classes[own]);
  });

  it('does not add a relation class whose key is taken', () => {
    const first = apply(empty(), ['Dataset', 'DataPipeline']).store.state;
    const before = relationByKey(first, 'WritesTo');
    const { store, result } = apply(first, ['DataStore']);
    expect(result.added.relations.map((r) => r.key)).not.toContain('WritesTo');
    expect(relationByKey(store.state, 'WritesTo')).toEqual(before);
  });

  it('puts labels under the first language when the tool has no English', () => {
    const tool = createEmptyTool({ name: 'Deutsch', languages: ['de'] });
    const { store } = apply(tool, ['Risk', 'Control']);
    const risk = byKey(store.state, 'Risk')!;
    expect(risk.labels).toEqual({ de: 'Risk' });
    expect(errors(store.state)).toEqual([]);
  });

  it('previews the relation classes for picks', () => {
    expect(
      catalogRelationsFor(['Control', 'Risk'], empty()).map((r) => r.key),
    ).toEqual(['DependsOn', 'Mitigates']);
    expect(catalogRelationsFor([], empty())).toEqual([]);
  });
});
