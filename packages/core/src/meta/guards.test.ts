import { describe, expect, it } from 'vitest';
import { sampleKit, SAMPLE, clone } from '../testing/sample-kit';
import { formatIssues, parseKit, validateKit, type Issue } from './guards';
import type { AttributeDef, Kit } from './types';

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- tests edit parts of a library freely

const base = (): Loose => clone(sampleKit()) as unknown as Loose;
const issuesOf = (kit: unknown): Issue[] => validateKit(kit);
const messageAt = (kit: unknown, path: string): string[] =>
  issuesOf(kit)
    .filter((i) => i.path === path)
    .map((i) => i.message);
const attr = (kit: Loose, extra: Record<string, unknown>): Loose => {
  kit.classes[SAMPLE.task].attributes.push({
    id: 'att_zz',
    key: 'Zz',
    ...extra,
  });
  return kit;
};
const attrIssues = (extra: Record<string, unknown>) =>
  issuesOf(attr(base(), extra)).filter(
    (i) => i.path.includes('att') || i.path.includes('attributes[3]'),
  );

describe('a complete library', () => {
  it('has no issues', () => {
    expect(issuesOf(sampleKit())).toEqual([]);
    expect(parseKit(sampleKit()).ok).toBe(true);
  });

  it('covers every attribute type', () => {
    const kit = base();
    const extras: Record<string, unknown>[] = [
      {
        type: 'text',
        multiline: true,
        maxLength: 5,
        pattern: '^a',
        default: 'abc',
      },
      { type: 'integer', min: 0, max: 5, default: 2 },
      { type: 'number', min: 0, max: 5, decimals: 2, unit: 'h', default: 1.25 },
      { type: 'boolean', display: 'switch', default: true },
      { type: 'date', default: '2026-10-07' },
      { type: 'date-time', default: '2026-10-07T09:30:00Z' },
      { type: 'duration', default: 'PT90M' },
      {
        type: 'choice',
        options: ['a', { value: 'b', labels: { en: 'B' } }],
        default: 'b',
      },
      {
        type: 'multi-choice',
        options: ['a', 'b'],
        min: 0,
        max: 2,
        default: ['a'],
      },
      { type: 'formula', formula: 'Effort * 2', result: 'number' },
      {
        type: 'table',
        columns: [
          { id: 'c1', key: 'Qty', type: 'integer' },
          { id: 'c2', key: 'Kind', type: 'choice', options: ['x'] },
        ],
        maxRows: 5,
        default: [{ c1: 1 }],
      },
      {
        type: 'reference',
        target: { classes: ['cls_task'], modelTypes: ['mt_process'] },
        max: 2,
      },
      { type: 'action', run: { kind: 'script', ref: 'scr_1' } },
      { type: 'link', target: 'any', default: 'https://example.com' },
    ];
    extras.forEach((e, i) =>
      kit.classes[SAMPLE.task].attributes.push({
        id: `att_t${i}`,
        key: `T${i}`,
        ...e,
      }),
    );
    expect(issuesOf(kit)).toEqual([]);
  });
});

describe('structure', () => {
  it('reports a missing manifest id with its path', () => {
    const kit = base();
    delete kit.manifest.id;
    expect(messageAt(kit, 'manifest.id')[0]).toMatch(
      /Kit id must be an id of the form kit_/,
    );
  });

  it('reports a missing manifest, settings and collections', () => {
    const kit = base();
    delete kit.manifest;
    delete kit.settings;
    delete kit.classes;
    const paths = issuesOf(kit).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(['manifest', 'settings', 'classes']),
    );
  });

  it('refuses things that are not libraries', () => {
    for (const v of [null, 3, 'x', [], undefined])
      expect(issuesOf(v).length).toBeGreaterThan(0);
  });

  it('flags unknown fields, which are usually typos', () => {
    const kit = base();
    kit.classes[SAMPLE.task].colour = 'red';
    expect(messageAt(kit, `classes.${SAMPLE.task}.colour`)[0]).toMatch(
      /Unknown field "colour"/,
    );
  });

  it('checks version, languages and labels', () => {
    const kit = base();
    kit.manifest.version = '1';
    kit.manifest.languages = ['en', 'EN'];
    kit.classes[SAMPLE.task].labels = { fr: 'Tâche' };
    expect(messageAt(kit, 'manifest.version')[0]).toMatch(/look like 1\.0\.0/);
    expect(messageAt(kit, 'manifest.languages[1]')[0]).toMatch(/language code/);
    expect(messageAt(kit, `classes.${SAMPLE.task}.labels.fr`)[0]).toMatch(
      /not listed in the Kit's languages/,
    );
  });

  it('requires entry names to match ids', () => {
    const kit = base();
    kit.classes[SAMPLE.task].id = 'cls_other';
    expect(messageAt(kit, `classes.${SAMPLE.task}.id`)[0]).toMatch(
      /does not match the entry name/,
    );
  });

  it('checks settings', () => {
    const kit = base();
    kit.settings.grid.size = 0;
    kit.settings.layers.push({
      key: 'main',
      labels: { en: 'Again' },
      visible: true,
    });
    kit.settings.numbering.start = -1;
    expect(messageAt(kit, 'settings.grid.size')[0]).toMatch(/above 0/);
    expect(messageAt(kit, 'settings.layers[1].key')[0]).toMatch(/used twice/);
    expect(messageAt(kit, 'settings.numbering.start')[0]).toMatch(/at least 0/);
  });
});

describe('classes', () => {
  it('rejects an unknown kind and names the allowed ones', () => {
    const kit = base();
    kit.classes[SAMPLE.task].kind = 'box';
    expect(messageAt(kit, `classes.${SAMPLE.task}.kind`)[0]).toMatch(
      /node, container, swimlane/,
    );
  });

  it('rejects a parent that does not exist', () => {
    const kit = base();
    kit.classes[SAMPLE.task].extends = 'cls_missing';
    expect(messageAt(kit, `classes.${SAMPLE.task}.extends`)[0]).toMatch(
      /cls_missing does not exist/,
    );
  });

  it('reports an inheritance cycle once, naming both classes', () => {
    const kit = base();
    kit.classes[SAMPLE.flowNode].extends = SAMPLE.task;
    const loops = issuesOf(kit).filter((i) =>
      /extend each other in a loop/.test(i.message),
    );
    expect(loops).toHaveLength(1);
    expect(loops[0]!.message).toMatch(/^The classes "/);
    expect(loops[0]!.message).toContain('"Task"');
    expect(loops[0]!.message).toContain('"FlowNode"');
  });

  it('reports duplicate class keys with both ids', () => {
    const kit = base();
    kit.classes[SAMPLE.gateway].key = 'Task';
    const m = issuesOf(kit).find((i) =>
      /class key "Task" is also used by/.test(i.message),
    );
    expect(m).toBeDefined();
  });

  it('rejects keys that formulas cannot use', () => {
    const kit = base();
    kit.classes[SAMPLE.task].key = 'My Task';
    expect(messageAt(kit, `classes.${SAMPLE.task}.key`)[0]).toMatch(
      /letters, digits and underscores/,
    );
  });

  it('reports a subclass that repeats an inherited attribute key', () => {
    const kit = base();
    kit.classes[SAMPLE.task].attributes.push({
      id: 'att_name2',
      key: 'Name',
      type: 'text',
    });
    const m = messageAt(kit, `classes.${SAMPLE.task}.attributes`);
    expect(m.join(' ')).toMatch(/two attributes with the key "Name"/);
  });

  it('reports duplicate attribute ids across the chain', () => {
    const kit = base();
    kit.classes[SAMPLE.task].attributes.push({
      id: SAMPLE.attName,
      key: 'Other',
      type: 'text',
    });
    expect(
      messageAt(kit, `classes.${SAMPLE.task}.attributes`).join(' '),
    ).toMatch(/two attributes with the id att_name/);
  });
});

describe('relation classes', () => {
  it('needs both ends when there is no parent', () => {
    const kit = base();
    kit.relations[SAMPLE.flow].to = [];
    expect(messageAt(kit, `relations.${SAMPLE.flow}.to`)[0]).toMatch(
      /At least one TO class is required/,
    );
  });

  it('allows empty ends when there is a parent', () => {
    const kit = base();
    kit.relations.rel_child = {
      id: 'rel_child',
      key: 'Child',
      labels: { en: 'Child' },
      extends: SAMPLE.flow,
      from: [],
      to: [],
      attributes: [],
    };
    expect(issuesOf(kit)).toEqual([]);
  });

  it('names a missing class at an end', () => {
    const kit = base();
    kit.relations[SAMPLE.flow].from = ['cls_nope'];
    expect(messageAt(kit, `relations.${SAMPLE.flow}.from[0]`)[0]).toMatch(
      /cls_nope does not exist/,
    );
  });

  it('detects relation inheritance loops', () => {
    const kit = base();
    kit.relations.rel_b = {
      id: 'rel_b',
      key: 'B',
      labels: { en: 'B' },
      extends: SAMPLE.flow,
      from: [],
      to: [],
      attributes: [],
    };
    kit.relations[SAMPLE.flow].extends = 'rel_b';
    expect(
      issuesOf(kit).some((i) =>
        /relation classes .* extend each other in a loop/.test(i.message),
      ),
    ).toBe(true);
  });
});

describe('model types', () => {
  const mt = SAMPLE.process;

  it('keeps views inside what the model type allows', () => {
    const kit = base();
    kit.modelTypes[mt].views[0].classes.push(SAMPLE.flowNode);
    const m = messageAt(kit, `modelTypes.${mt}.views[0].classes[4]`);
    expect(m[0]).toMatch(
      /view "FlowOnly" uses the class cls_flownode, which the model type does not allow/,
    );
  });

  it('keeps cardinalities inside what the model type allows', () => {
    const kit = base();
    kit.modelTypes[mt].cardinalities.push({
      kind: 'count',
      class: SAMPLE.flowNode,
      min: 1,
    });
    expect(
      messageAt(kit, `modelTypes.${mt}.cardinalities[3].class`)[0],
    ).toMatch(/does not allow/);
  });

  it('checks container rules', () => {
    const ok = base();
    ok.modelTypes[mt].containers = { [SAMPLE.lane]: [SAMPLE.task] };
    expect(issuesOf(ok)).toEqual([]);

    const notAContainer = base();
    notAContainer.modelTypes[mt].containers = { [SAMPLE.task]: [SAMPLE.end] };
    expect(
      messageAt(notAContainer, `modelTypes.${mt}.containers.${SAMPLE.task}`)[0],
    ).toMatch(/not a container or swimlane/);

    const unknownChild = base();
    unknownChild.modelTypes[mt].containers = { [SAMPLE.lane]: ['cls_nope'] };
    expect(
      messageAt(
        unknownChild,
        `modelTypes.${mt}.containers.${SAMPLE.lane}[0]`,
      )[0],
    ).toMatch(/does not allow it/);
  });

  it('checks cardinality bounds', () => {
    const kit = base();
    kit.modelTypes[mt].cardinalities[0] = {
      kind: 'count',
      class: SAMPLE.start,
      min: 3,
      max: 1,
    };
    kit.modelTypes[mt].cardinalities[1] = { kind: 'count', class: SAMPLE.end };
    expect(messageAt(kit, `modelTypes.${mt}.cardinalities[0]`)[0]).toMatch(
      /minimum \(3\) is above the maximum \(1\)/,
    );
    expect(messageAt(kit, `modelTypes.${mt}.cardinalities[1]`)[0]).toMatch(
      /needs a minimum, a maximum or both/,
    );
  });

  it('checks degree cardinalities', () => {
    const kit = base();
    kit.modelTypes[mt].cardinalities[2] = {
      kind: 'degree',
      class: SAMPLE.start,
      relation: 'rel_x',
      end: 'middle',
      max: 0,
    };
    expect(messageAt(kit, `modelTypes.${mt}.cardinalities[2].end`)[0]).toMatch(
      /"from" or "to"/,
    );
    expect(issuesOf(kit).some((i) => /rel_x/.test(i.message))).toBe(true);
  });

  it('rejects classes listed twice and duplicate view keys', () => {
    const kit = base();
    kit.modelTypes[mt].classes.push(SAMPLE.task);
    kit.modelTypes[mt].views.push({
      ...kit.modelTypes[mt].views[0],
      id: 'vw_two',
    });
    expect(
      issuesOf(kit).some((i) => /listed more than once/.test(i.message)),
    ).toBe(true);
    expect(
      issuesOf(kit).some((i) =>
        /view key "FlowOnly" is used twice/.test(i.message),
      ),
    ).toBe(true);
  });
});

describe('attribute definitions', () => {
  it('reports min above max', () => {
    expect(
      attrIssues({ type: 'integer', min: 5, max: 1 })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/minimum \(5\) is above the maximum \(1\)/);
  });

  it('checks defaults against the type', () => {
    expect(
      attrIssues({ type: 'choice', options: ['a', 'b'], default: 'c' })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/default must be one of: a, b/);
    expect(
      attrIssues({ type: 'integer', default: 1.5 })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/default must be a whole number/);
    expect(
      attrIssues({ type: 'text', maxLength: 2, default: 'abc' })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/default is longer than 2/);
    expect(
      attrIssues({ type: 'date', default: '2026-02-31' }).length,
    ).toBeGreaterThan(0);
    expect(
      attrIssues({ type: 'formula', formula: '1', default: 1 })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/has no default/);
  });

  it('reports duplicate options', () => {
    expect(
      attrIssues({ type: 'choice', options: ['a', 'a'] })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/option "a" is listed more than once/);
  });

  it('needs at least one option', () => {
    expect(
      attrIssues({ type: 'choice', options: [] })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/At least one option/);
  });

  it('rejects an unknown type and lists the types', () => {
    expect(
      attrIssues({ type: 'color' })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/must be one of: text, integer, number/);
  });

  it('rejects options that belong to another type', () => {
    expect(
      attrIssues({ type: 'text', min: 1 })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/Unknown field "min"/);
  });

  it('rejects a pattern that is not a regular expression', () => {
    expect(
      attrIssues({ type: 'text', pattern: '(' })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/not a valid regular expression/);
  });

  it('checks tables, references and actions', () => {
    expect(
      attrIssues({ type: 'table', columns: [] })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/at least one column/);
    expect(
      attrIssues({
        type: 'table',
        columns: [
          { id: 'c', key: 'A', type: 'text' },
          { id: 'c', key: 'A', type: 'text' },
        ],
      })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/column id "c" is used twice/);
    expect(
      attrIssues({ type: 'reference', target: { classes: ['x'] } }).length,
    ).toBeGreaterThan(0);
    expect(
      attrIssues({ type: 'action', run: { kind: 'magic', ref: 'x' } })
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/rule, script, command/);
  });

  it('checks the ids of attributes', () => {
    const kit = base();
    kit.classes[SAMPLE.task].attributes[0].id = 'name';
    expect(
      messageAt(kit, `classes.${SAMPLE.task}.attributes[0].id`)[0],
    ).toMatch(/att_something/);
  });
});

describe('reporting', () => {
  it('formats issues with their paths', () => {
    const kit = base();
    delete kit.manifest.name;
    expect(formatIssues(issuesOf(kit))).toMatch(
      /^manifest\.name: The Kit name must be text\./,
    );
    const parsed = parseKit(kit);
    expect(parsed.ok).toBe(false);
  });

  it('types a parsed library', () => {
    const parsed = parseKit(sampleKit());
    if (parsed.ok) {
      const lib: Kit = parsed.value;
      const names: AttributeDef['key'][] = lib.classes[
        SAMPLE.flowNode
      ]!.attributes.map((a) => a.key);
      expect(names).toEqual(['Name', 'Code']);
    }
  });
});
