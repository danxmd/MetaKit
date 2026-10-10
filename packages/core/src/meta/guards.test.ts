import { describe, expect, it } from 'vitest';
import { sampleTool, SAMPLE, clone } from '../testing/sample-tool';
import {
  formatIssues,
  parseToolLibrary,
  validateToolLibrary,
  type Issue,
} from './guards';
import type { AttributeDef, ToolLibrary } from './types';

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- tests edit parts of a library freely

const base = (): Loose => clone(sampleTool()) as unknown as Loose;
const issuesOf = (tool: unknown): Issue[] => validateToolLibrary(tool);
const messageAt = (tool: unknown, path: string): string[] =>
  issuesOf(tool)
    .filter((i) => i.path === path)
    .map((i) => i.message);
const attr = (tool: Loose, extra: Record<string, unknown>): Loose => {
  tool.classes[SAMPLE.task].attributes.push({
    id: 'att_zz',
    key: 'Zz',
    ...extra,
  });
  return tool;
};
const attrIssues = (extra: Record<string, unknown>) =>
  issuesOf(attr(base(), extra)).filter(
    (i) => i.path.includes('att') || i.path.includes('attributes[3]'),
  );

describe('a complete library', () => {
  it('has no issues', () => {
    expect(issuesOf(sampleTool())).toEqual([]);
    expect(parseToolLibrary(sampleTool()).ok).toBe(true);
  });

  it('covers every attribute type', () => {
    const tool = base();
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
      tool.classes[SAMPLE.task].attributes.push({
        id: `att_t${i}`,
        key: `T${i}`,
        ...e,
      }),
    );
    expect(issuesOf(tool)).toEqual([]);
  });
});

describe('structure', () => {
  it('reports a missing manifest id with its path', () => {
    const tool = base();
    delete tool.manifest.id;
    expect(messageAt(tool, 'manifest.id')[0]).toMatch(
      /Kit id must be an id of the form tool_/,
    );
  });

  it('reports a missing manifest, settings and collections', () => {
    const tool = base();
    delete tool.manifest;
    delete tool.settings;
    delete tool.classes;
    const paths = issuesOf(tool).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(['manifest', 'settings', 'classes']),
    );
  });

  it('refuses things that are not libraries', () => {
    for (const v of [null, 3, 'x', [], undefined])
      expect(issuesOf(v).length).toBeGreaterThan(0);
  });

  it('flags unknown fields, which are usually typos', () => {
    const tool = base();
    tool.classes[SAMPLE.task].colour = 'red';
    expect(messageAt(tool, `classes.${SAMPLE.task}.colour`)[0]).toMatch(
      /Unknown field "colour"/,
    );
  });

  it('checks version, languages and labels', () => {
    const tool = base();
    tool.manifest.version = '1';
    tool.manifest.languages = ['en', 'EN'];
    tool.classes[SAMPLE.task].labels = { fr: 'Tâche' };
    expect(messageAt(tool, 'manifest.version')[0]).toMatch(/look like 1\.0\.0/);
    expect(messageAt(tool, 'manifest.languages[1]')[0]).toMatch(
      /language code/,
    );
    expect(messageAt(tool, `classes.${SAMPLE.task}.labels.fr`)[0]).toMatch(
      /not listed in the Kit's languages/,
    );
  });

  it('requires entry names to match ids', () => {
    const tool = base();
    tool.classes[SAMPLE.task].id = 'cls_other';
    expect(messageAt(tool, `classes.${SAMPLE.task}.id`)[0]).toMatch(
      /does not match the entry name/,
    );
  });

  it('checks settings', () => {
    const tool = base();
    tool.settings.grid.size = 0;
    tool.settings.layers.push({
      key: 'main',
      labels: { en: 'Again' },
      visible: true,
    });
    tool.settings.numbering.start = -1;
    expect(messageAt(tool, 'settings.grid.size')[0]).toMatch(/above 0/);
    expect(messageAt(tool, 'settings.layers[1].key')[0]).toMatch(/used twice/);
    expect(messageAt(tool, 'settings.numbering.start')[0]).toMatch(
      /at least 0/,
    );
  });
});

describe('classes', () => {
  it('rejects an unknown kind and names the allowed ones', () => {
    const tool = base();
    tool.classes[SAMPLE.task].kind = 'box';
    expect(messageAt(tool, `classes.${SAMPLE.task}.kind`)[0]).toMatch(
      /node, container, swimlane/,
    );
  });

  it('rejects a parent that does not exist', () => {
    const tool = base();
    tool.classes[SAMPLE.task].extends = 'cls_missing';
    expect(messageAt(tool, `classes.${SAMPLE.task}.extends`)[0]).toMatch(
      /cls_missing does not exist/,
    );
  });

  it('reports an inheritance cycle once, naming both classes', () => {
    const tool = base();
    tool.classes[SAMPLE.flowNode].extends = SAMPLE.task;
    const loops = issuesOf(tool).filter((i) =>
      /extend each other in a loop/.test(i.message),
    );
    expect(loops).toHaveLength(1);
    expect(loops[0]!.message).toMatch(/^The classes "/);
    expect(loops[0]!.message).toContain('"Task"');
    expect(loops[0]!.message).toContain('"FlowNode"');
  });

  it('reports duplicate class keys with both ids', () => {
    const tool = base();
    tool.classes[SAMPLE.gateway].key = 'Task';
    const m = issuesOf(tool).find((i) =>
      /class key "Task" is also used by/.test(i.message),
    );
    expect(m).toBeDefined();
  });

  it('rejects keys that formulas cannot use', () => {
    const tool = base();
    tool.classes[SAMPLE.task].key = 'My Task';
    expect(messageAt(tool, `classes.${SAMPLE.task}.key`)[0]).toMatch(
      /letters, digits and underscores/,
    );
  });

  it('reports a subclass that repeats an inherited attribute key', () => {
    const tool = base();
    tool.classes[SAMPLE.task].attributes.push({
      id: 'att_name2',
      key: 'Name',
      type: 'text',
    });
    const m = messageAt(tool, `classes.${SAMPLE.task}.attributes`);
    expect(m.join(' ')).toMatch(/two attributes with the key "Name"/);
  });

  it('reports duplicate attribute ids across the chain', () => {
    const tool = base();
    tool.classes[SAMPLE.task].attributes.push({
      id: SAMPLE.attName,
      key: 'Other',
      type: 'text',
    });
    expect(
      messageAt(tool, `classes.${SAMPLE.task}.attributes`).join(' '),
    ).toMatch(/two attributes with the id att_name/);
  });
});

describe('relation classes', () => {
  it('needs both ends when there is no parent', () => {
    const tool = base();
    tool.relations[SAMPLE.flow].to = [];
    expect(messageAt(tool, `relations.${SAMPLE.flow}.to`)[0]).toMatch(
      /At least one TO class is required/,
    );
  });

  it('allows empty ends when there is a parent', () => {
    const tool = base();
    tool.relations.rel_child = {
      id: 'rel_child',
      key: 'Child',
      labels: { en: 'Child' },
      extends: SAMPLE.flow,
      from: [],
      to: [],
      attributes: [],
    };
    expect(issuesOf(tool)).toEqual([]);
  });

  it('names a missing class at an end', () => {
    const tool = base();
    tool.relations[SAMPLE.flow].from = ['cls_nope'];
    expect(messageAt(tool, `relations.${SAMPLE.flow}.from[0]`)[0]).toMatch(
      /cls_nope does not exist/,
    );
  });

  it('detects relation inheritance loops', () => {
    const tool = base();
    tool.relations.rel_b = {
      id: 'rel_b',
      key: 'B',
      labels: { en: 'B' },
      extends: SAMPLE.flow,
      from: [],
      to: [],
      attributes: [],
    };
    tool.relations[SAMPLE.flow].extends = 'rel_b';
    expect(
      issuesOf(tool).some((i) =>
        /relation classes .* extend each other in a loop/.test(i.message),
      ),
    ).toBe(true);
  });
});

describe('model types', () => {
  const mt = SAMPLE.process;

  it('keeps views inside what the model type allows', () => {
    const tool = base();
    tool.modelTypes[mt].views[0].classes.push(SAMPLE.flowNode);
    const m = messageAt(tool, `modelTypes.${mt}.views[0].classes[4]`);
    expect(m[0]).toMatch(
      /view "FlowOnly" uses the class cls_flownode, which the model type does not allow/,
    );
  });

  it('keeps cardinalities inside what the model type allows', () => {
    const tool = base();
    tool.modelTypes[mt].cardinalities.push({
      kind: 'count',
      class: SAMPLE.flowNode,
      min: 1,
    });
    expect(
      messageAt(tool, `modelTypes.${mt}.cardinalities[3].class`)[0],
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
    const tool = base();
    tool.modelTypes[mt].cardinalities[0] = {
      kind: 'count',
      class: SAMPLE.start,
      min: 3,
      max: 1,
    };
    tool.modelTypes[mt].cardinalities[1] = { kind: 'count', class: SAMPLE.end };
    expect(messageAt(tool, `modelTypes.${mt}.cardinalities[0]`)[0]).toMatch(
      /minimum \(3\) is above the maximum \(1\)/,
    );
    expect(messageAt(tool, `modelTypes.${mt}.cardinalities[1]`)[0]).toMatch(
      /needs a minimum, a maximum or both/,
    );
  });

  it('checks degree cardinalities', () => {
    const tool = base();
    tool.modelTypes[mt].cardinalities[2] = {
      kind: 'degree',
      class: SAMPLE.start,
      relation: 'rel_x',
      end: 'middle',
      max: 0,
    };
    expect(messageAt(tool, `modelTypes.${mt}.cardinalities[2].end`)[0]).toMatch(
      /"from" or "to"/,
    );
    expect(issuesOf(tool).some((i) => /rel_x/.test(i.message))).toBe(true);
  });

  it('rejects classes listed twice and duplicate view keys', () => {
    const tool = base();
    tool.modelTypes[mt].classes.push(SAMPLE.task);
    tool.modelTypes[mt].views.push({
      ...tool.modelTypes[mt].views[0],
      id: 'vw_two',
    });
    expect(
      issuesOf(tool).some((i) => /listed more than once/.test(i.message)),
    ).toBe(true);
    expect(
      issuesOf(tool).some((i) =>
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
    const tool = base();
    tool.classes[SAMPLE.task].attributes[0].id = 'name';
    expect(
      messageAt(tool, `classes.${SAMPLE.task}.attributes[0].id`)[0],
    ).toMatch(/att_something/);
  });
});

describe('reporting', () => {
  it('formats issues with their paths', () => {
    const tool = base();
    delete tool.manifest.name;
    expect(formatIssues(issuesOf(tool))).toMatch(
      /^manifest\.name: The Kit name must be text\./,
    );
    const parsed = parseToolLibrary(tool);
    expect(parsed.ok).toBe(false);
  });

  it('types a parsed library', () => {
    const parsed = parseToolLibrary(sampleTool());
    if (parsed.ok) {
      const lib: ToolLibrary = parsed.value;
      const names: AttributeDef['key'][] = lib.classes[
        SAMPLE.flowNode
      ]!.attributes.map((a) => a.key);
      expect(names).toEqual(['Name', 'Code']);
    }
  });
});
