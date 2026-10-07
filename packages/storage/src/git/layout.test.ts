import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ToolLibrary } from '@metakit-app/core';
import { fromLayout, kebab, toLayout } from './layout';
import { sampleTool, sampleWithBehaviour } from './sample-tools';

const read = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../../../tools/${path}`, import.meta.url)),
    'utf8',
  );

describe('toLayout', () => {
  it('writes one file per part with sorted, readable names', () => {
    const files = toLayout(sampleWithBehaviour());
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toContain('tool.json');
    expect(paths).toContain('classes/task.json');
    expect(paths).toContain('classes/start-event.json');
    expect(paths.some((p) => p.startsWith('relations/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('model-types/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('shapes/'))).toBe(true);
    expect(paths).toContain('scripts/total-effort-by-lane.ts');
    expect(paths).toContain('scripts/total-effort-by-lane.json');
    expect(paths.some((p) => p.startsWith('rules/'))).toBe(true);
  });

  it('keeps ids inside the files and writes stable JSON', () => {
    const file = toLayout(sampleTool('bpmn-lite')).find(
      (f) => f.path === 'classes/task.json',
    )!;
    expect(file.content.endsWith('\n')).toBe(true);
    expect(file.content).toContain('  "id": "cls_');
    expect(JSON.parse(file.content)).toMatchObject({ key: 'Task' });
  });

  it('holds a script source in a .ts file and the rest in a small .json file', () => {
    const files = toLayout(sampleWithBehaviour());
    const ts = files.find((f) => f.path === 'scripts/check-gateways.ts')!;
    const meta = JSON.parse(
      files.find((f) => f.path === 'scripts/check-gateways.json')!.content,
    ) as Record<string, unknown>;
    expect(ts.content).toBe(read('behaviour-examples/gateway-check.script.ts'));
    expect(meta).toEqual({
      id: 'scr_gateway_check',
      name: 'Check gateways',
      enabled: false,
    });
  });

  it('gives parts with the same file name their id as a suffix, whatever the order', () => {
    const tool = sampleTool('er-lite');
    const [a, b] = Object.values(tool.classes);
    const twin = (first: typeof a, second: typeof b): ToolLibrary => ({
      ...tool,
      classes: {
        [first!.id]: { ...first!, key: 'Same_Name' },
        [second!.id]: { ...second!, key: 'SameName' },
      },
      relations: {},
      modelTypes: {},
      panels: {},
    });
    const one = toLayout(twin(a, b))
      .map((f) => f.path)
      .filter((p) => p.startsWith('classes/'));
    const two = toLayout(twin(b, a))
      .map((f) => f.path)
      .filter((p) => p.startsWith('classes/'));
    expect(one).toHaveLength(2);
    expect(new Set(one).size).toBe(2);
    expect(one.every((p) => p.includes(a!.id) || p.includes(b!.id))).toBe(true);
    expect(two).toEqual(one);
  });

  it('carries assets as given, under assets/', () => {
    const files = toLayout(sampleTool('er-lite'), [
      { path: 'icon.1234.png', content: 'AAEC', encoding: 'base64' },
    ]);
    expect(files.find((f) => f.path === 'assets/icon.1234.png')).toEqual({
      path: 'assets/icon.1234.png',
      content: 'AAEC',
      encoding: 'base64',
    });
  });
});

describe('round trip', () => {
  const cases: [string, () => ToolLibrary][] = [
    ['bpmn-lite', () => sampleTool('bpmn-lite')],
    ['er-lite', () => sampleTool('er-lite')],
    ['bpmn-lite with the behaviour examples', sampleWithBehaviour],
  ];
  for (const [name, make] of cases) {
    it(`gives an equal tool library and identical files for ${name}`, () => {
      const tool = make();
      const assets = [
        { path: 'a/b.png', content: 'AAEC', encoding: 'base64' as const },
      ];
      const files = toLayout(tool, assets);
      const back = fromLayout(files);
      expect(back.issues).toEqual([]);
      expect(back.tool).toEqual(tool);
      expect(back.assets).toEqual(assets);
      expect(toLayout(back.tool!, back.assets)).toEqual(files);
    });
  }

  it('orders the parts by id, so the key order after sync is not a change', () => {
    const tool = sampleTool('bpmn-lite');
    const shuffled: ToolLibrary = {
      ...tool,
      classes: Object.fromEntries(Object.entries(tool.classes).reverse()),
    };
    expect(toLayout(shuffled)).toEqual(toLayout(tool));
    const back = fromLayout(toLayout(tool)).tool!;
    expect(Object.keys(back.classes)).toEqual(Object.keys(tool.classes).sort());
  });
});

describe('small diffs', () => {
  it('changes one file when one attribute label changes', () => {
    const tool = sampleTool('bpmn-lite');
    const task = Object.values(tool.classes).find((c) => c.key === 'Task')!;
    const edited: ToolLibrary = {
      ...tool,
      classes: {
        ...tool.classes,
        [task.id]: {
          ...task,
          attributes: task.attributes.map((a, i) =>
            i === 0 ? { ...a, labels: { en: 'Changed label' } } : a,
          ),
        },
      },
    };
    const before = new Map(toLayout(tool).map((f) => [f.path, f.content]));
    const after = new Map(toLayout(edited).map((f) => [f.path, f.content]));
    expect([...after.keys()]).toEqual([...before.keys()]);
    const different = [...after]
      .filter(([p, c]) => before.get(p) !== c)
      .map(([p]) => p);
    expect(different).toEqual(['classes/task.json']);
  });

  it('adding a class changes the new file and tool.json only', () => {
    const tool = sampleTool('er-lite');
    const first = Object.values(tool.classes)[0]!;
    const added: ToolLibrary = {
      ...tool,
      classes: {
        ...tool.classes,
        cls_new: { ...first, id: 'cls_new', key: 'Fresh', attributes: [] },
      },
    };
    const before = new Map(toLayout(tool).map((f) => [f.path, f.content]));
    const different = toLayout(added)
      .filter((f) => before.get(f.path) !== f.content)
      .map((f) => f.path);
    expect(different).toEqual(['classes/fresh.json', 'tool.json']);
  });
});

describe('hand edits', () => {
  it('reports a damaged class file with its path and still loads the rest', () => {
    const tool = sampleTool('er-lite');
    const files = toLayout(tool).map((f) =>
      f.path === 'classes/entity.json'
        ? { ...f, content: '{ "id": "cls_entity", ' }
        : f,
    );
    const back = fromLayout(files);
    expect(
      back.issues.some(
        (i) =>
          i.path === 'classes/entity.json' && /not valid JSON/.test(i.message),
      ),
    ).toBe(true);
    expect(back.tool).not.toBeNull();
    expect(back.tool!.classes['cls_entity' as never]).toBeUndefined();
    expect(Object.keys(back.tool!.classes)).toHaveLength(
      Object.keys(tool.classes).length - 1,
    );
  });

  it('reports a file that does not match its schema and names the file', () => {
    const tool = sampleTool('er-lite');
    const files = toLayout(tool).map((f) =>
      f.path === 'classes/attribute.json'
        ? {
            ...f,
            content: f.content.replace('"kind": "node"', '"kind": "banana"'),
          }
        : f,
    );
    const back = fromLayout(files);
    expect(back.issues.some((i) => i.path === 'classes/attribute.json')).toBe(
      true,
    );
  });

  it('reports a file without an id', () => {
    const files = toLayout(sampleTool('er-lite')).map((f) =>
      f.path === 'classes/entity.json' ? { ...f, content: '{}\n' } : f,
    );
    const back = fromLayout(files);
    expect(
      back.issues.find((i) => i.path === 'classes/entity.json')?.message,
    ).toMatch(/id/);
  });

  it('reports a script whose source file is missing', () => {
    const files = toLayout(sampleWithBehaviour()).filter(
      (f) => f.path !== 'scripts/check-gateways.ts',
    );
    const back = fromLayout(files);
    expect(
      back.issues.some((i) => i.path === 'scripts/check-gateways.json'),
    ).toBe(true);
    expect(back.tool!.scripts['scr_gateway_check']?.source).toBe('');
  });

  it('cannot load without tool.json and says so', () => {
    const back = fromLayout(
      toLayout(sampleTool('er-lite')).filter((f) => f.path !== 'tool.json'),
    );
    expect(back.tool).toBeNull();
    expect(back.issues[0]?.path).toBe('tool.json');
  });

  it('refuses a newer format and ignores files outside the layout', () => {
    const files = toLayout(sampleTool('er-lite')).map((f) =>
      f.path === 'tool.json'
        ? {
            ...f,
            content: f.content.replace(
              '"formatVersion": 5',
              '"formatVersion": 99',
            ),
          }
        : f,
    );
    const back = fromLayout([...files, { path: 'README.md', content: '# hi' }]);
    expect(back.tool).toBeNull();
    expect(back.issues[0]?.message).toMatch(/newer version/);
    const ok = fromLayout([
      ...toLayout(sampleTool('er-lite')),
      { path: 'README.md', content: '# hi' },
    ]);
    expect(ok.issues).toEqual([]);
  });
});

describe('kebab', () => {
  it('turns keys and names into file names', () => {
    expect(kebab('StartEvent')).toBe('start-event');
    expect(kebab('Start event')).toBe('start-event');
    expect(kebab('HTTPServer')).toBe('http-server');
    expect(kebab('Über Café')).toBe('uber-cafe');
    expect(kebab('***')).toBe('');
  });
});
