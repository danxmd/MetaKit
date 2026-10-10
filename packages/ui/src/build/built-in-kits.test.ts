import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ModelCalculator,
  KIT_FORMAT_VERSION,
  validateKit,
  validateModel,
  type Kit,
  type NodeShape,
  type RelationShape,
} from '@metakit-app/core';
import { docsFromFiles } from '@metakit-app/docs';
import { parseCached } from '@metakit-app/formula';
import {
  compileNode,
  nodeShapeFromLook,
  relationShapeFromLook,
} from '@metakit-app/shapes';
import { importMkModel } from '@metakit-app/storage';
import { BUILT_IN_DOMAINS, BUILT_IN_KITS } from './built-in';

/**
 * Every built-in Kit (openspec/changes/kit-library), whatever its domain: it is valid, its
 * formulas parse, its shapes are simple looks, its sample model loads without errors and with
 * only the warnings it shows on purpose, it has a help topic, and it names no company or vendor.
 * The data and AI Kits keep their own, more detailed tests next to this one.
 */

const kitsDir = fileURLToPath(new URL('../../../../kits', import.meta.url));
const docsDir = fileURLToPath(
  new URL('../../../docs/content', import.meta.url),
);

/** Warnings a sample model shows on purpose, so the checks of its Kit have something to report. */
const INTENDED_WARNINGS: Record<string, number> = {
  'data-ai-architecture': 1,
  'data-governance': 2,
  'data-ai-strategy': 1,
  'data-ai-maturity': 1,
  'kpi-metric-tree': 1,
  'ml-lifecycle': 1,
  'genai-solution': 1,
  'ai-risk-compliance': 1,
  'capability-map': 1,
  'business-model-canvas': 1,
  'value-streams-journeys': 1,
  'stakeholder-org-map': 1,
  'okrs-goals': 1,
};

/**
 * Kits whose topic in the `kits` category comes with the help task of the change (task 9). The
 * three data and AI ones already have a tutorial under the folder name.
 */
const TOPIC_LATER = new Set(['bpmn-lite', 'er-lite', 'agent-pipeline']);
const TOPIC_IN_TUTORIALS = new Set([
  'data-ai-architecture',
  'ai-use-case-portfolio',
  'data-governance',
]);

/** Kits from before simple looks (ADR 0009), drawn by hand; they keep their shapes for now. */
const HAND_DRAWN = new Set(['bpmn-lite', 'er-lite', 'agent-pipeline']);

/** Companies, consultancies and vendor products that built-in content must not name. */
const NAMES = [
  'Accenture',
  'Deloitte',
  'McKinsey',
  'PwC',
  'KPMG',
  'EY',
  'Capgemini',
  'IBM',
  'Microsoft',
  'Azure',
  'AWS',
  'Amazon',
  'Google',
  'GCP',
  'Snowflake',
  'Databricks',
  'Salesforce',
  'SAP',
  'Oracle',
  'OpenAI',
  'Anthropic',
  'Tableau',
  'Power BI',
  'Informatica',
  'Collibra',
];
const NAME_PATTERN = new RegExp(`\\b(${NAMES.join('|')})\\b`, 'i');

/** The folder under kits/ that holds the Kit with this id. */
function folderOf(id: string): string {
  const folder = readdirSync(kitsDir).find((name) => {
    const path = join(kitsDir, name, 'kit.json');
    try {
      return (JSON.parse(readFileSync(path, 'utf8')) as Kit).manifest.id === id;
    } catch {
      return false;
    }
  });
  if (!folder) throw new Error(`No folder under kits/ holds ${id}`);
  return folder;
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}
const topicFiles = Object.fromEntries(
  markdownFiles(docsDir).map((path) => [
    `content/${relative(docsDir, path).split('\\').join('/')}`,
    readFileSync(path, 'utf8'),
  ]),
);
const docs = docsFromFiles(topicFiles);

/** Every formula of a Kit: attribute formulas, constraints, rule conditions and `=` values. */
function badFormulas(kit: Kit): string[] {
  const bad: string[] = [];
  const FORMULA_KEYS = new Set(['formula', 'defaultFormula', 'if', 'when']);
  const walk = (value: unknown, path: string, key = ''): void => {
    if (typeof value === 'string') {
      const isFormula =
        value.trimStart().startsWith('=') ||
        (FORMULA_KEYS.has(key) && !path.endsWith('.when.event'));
      if (!isFormula || path.includes('scripts.')) return;
      const source = value.trimStart().startsWith('=')
        ? value.trimStart().slice(1)
        : value;
      const r = parseCached(source);
      if ('error' in r) bad.push(`${path}: ${r.error}`);
    } else if (Array.isArray(value))
      value.forEach((v, i) => walk(v, `${path}[${i}]`, key));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, k);
  };
  walk(kit, 'kit');
  return bad;
}

describe('the list of built-in Kits', () => {
  it('is in the order of the domains, so every list shows them alike', () => {
    const rank = (d: string) => BUILT_IN_DOMAINS.findIndex((x) => x.id === d);
    const ranks = BUILT_IN_KITS.map((k) => rank(k.domain));
    expect(ranks.every((r) => r >= 0)).toBe(true);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('has a sample model for every Kit and no folder twice', () => {
    const folders = BUILT_IN_KITS.map((k) => folderOf(k.id));
    expect(new Set(folders).size).toBe(folders.length);
  });
});

for (const entry of BUILT_IN_KITS) {
  describe(`built-in Kit "${entry.name}"`, () => {
    const folder = folderOf(entry.id);
    const kitText = readFileSync(join(kitsDir, folder, 'kit.json'), 'utf8');
    const kit = JSON.parse(kitText) as Kit;

    it('is valid and in the current format', () => {
      expect(validateKit(kit)).toEqual([]);
      expect(kit.formatVersion).toBe(KIT_FORMAT_VERSION);
      expect(kit.manifest).toMatchObject({
        id: entry.id,
        name: entry.name,
        version: entry.version,
      });
    });

    it('has formulas that all parse', () => {
      expect(badFormulas(kit)).toEqual([]);
    });

    it.skipIf(HAND_DRAWN.has(folder))(
      'draws every shape from a simple look, equal to the parts the look makes',
      () => {
        for (const shape of Object.values(kit.shapes)) {
          expect(shape.look, shape.id).toBeDefined();
          const again =
            shape.kind === 'node'
              ? nodeShapeFromLook(
                  (shape as NodeShape).look!,
                  shape.id,
                  shape.name,
                )
              : relationShapeFromLook(
                  (shape as RelationShape).look!,
                  shape.id,
                  shape.name,
                );
          expect(again, shape.id).toEqual(shape);
        }
        for (const owner of [
          ...Object.values(kit.classes).filter((c) => !c.abstract),
          ...Object.values(kit.relations),
        ])
          expect(kit.shapes[owner.shape!], owner.key).toBeDefined();
      },
    );

    it('has a sample model that loads and draws without errors and has only its intended warnings', () => {
      const samples = readdirSync(join(kitsDir, folder)).filter((f) =>
        f.endsWith('.mkmodel.json'),
      );
      expect(samples.length).toBeGreaterThan(0);
      let warnings = 0;
      for (const file of samples) {
        const model = importMkModel(
          kit,
          readFileSync(join(kitsDir, folder, file), 'utf8'),
        );
        const calc = new ModelCalculator(kit, () => model);
        const issues = validateModel(kit, model, calc);
        // Every object draws without a problem in its formulas. Hand-drawn shapes read values
        // the canvas gives them, such as $fill, so only simple looks are drawn here.
        const drawn = HAND_DRAWN.has(folder)
          ? []
          : Object.values(model.elements);
        for (const el of drawn) {
          const cls = kit.classes[el.class]!;
          const shape = kit.shapes[cls.shape!] as NodeShape;
          const out = compileNode(shape, {
            w: el.w ?? shape.size.width,
            h: el.h ?? shape.size.height,
            scope: calc.scope(el.id, { $label: cls.labels['en'] ?? cls.key }),
          });
          expect(out.messages, `${file}: ${cls.key} ${el.id}`).toEqual([]);
        }
        expect(
          issues.filter((i) => i.severity === 'error').map((i) => i.message),
          file,
        ).toEqual([]);
        warnings += issues.filter((i) => i.severity === 'warning').length;
      }
      expect(warnings).toBe(INTENDED_WARNINGS[folder] ?? 0);
    });

    const later = TOPIC_LATER.has(folder);
    it.skipIf(later)(`has a help topic "${folder}"`, () => {
      const topic = docs.get(folder);
      expect(topic, folder).toBeDefined();
      expect(topic!.category).toBe(
        TOPIC_IN_TUTORIALS.has(folder) ? 'tutorials' : 'kits',
      );
    });

    it('names no company, client or vendor product', () => {
      const texts: [string, string][] = [
        [`kits/${folder}/kit.json`, kitText],
        ['the list entry', `${entry.name} ${entry.description}`],
      ];
      const topic = docs.get(folder);
      if (topic) texts.push([topic.path, topicFiles[topic.path] ?? '']);
      for (const [where, text] of texts)
        expect(text.match(NAME_PATTERN)?.[0], where).toBeUndefined();
    });
  });
}
