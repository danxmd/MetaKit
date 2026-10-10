import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Kit } from '@metakit-app/core';
import { fromLayout, kebab, toLayout } from './layout';
import { sampleKit, sampleWithBehaviour } from './sample-kits';

const read = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../../../kits/${path}`, import.meta.url)),
    'utf8',
  );

describe('toLayout', () => {
  it('writes one file per part with sorted, readable names', () => {
    const files = toLayout(sampleWithBehaviour());
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toContain('kit.json');
    expect(paths).not.toContain('tool.json');
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
    const file = toLayout(sampleKit('bpmn-lite')).find(
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
    const kit = sampleKit('er-lite');
    const [a, b] = Object.values(kit.classes);
    const twin = (first: typeof a, second: typeof b): Kit => ({
      ...kit,
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
    const files = toLayout(sampleKit('er-lite'), [
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
  const cases: [string, () => Kit][] = [
    ['bpmn-lite', () => sampleKit('bpmn-lite')],
    ['er-lite', () => sampleKit('er-lite')],
    ['bpmn-lite with the behaviour examples', sampleWithBehaviour],
  ];
  for (const [name, make] of cases) {
    it(`gives an equal Kit and identical files for ${name}`, () => {
      const kit = make();
      const assets = [
        { path: 'a/b.png', content: 'AAEC', encoding: 'base64' as const },
      ];
      const files = toLayout(kit, assets);
      const back = fromLayout(files);
      expect(back.issues).toEqual([]);
      expect(back.kit).toEqual(kit);
      expect(back.assets).toEqual(assets);
      expect(toLayout(back.kit!, back.assets)).toEqual(files);
    });
  }

  it('orders the parts by id, so the key order after sync is not a change', () => {
    const kit = sampleKit('bpmn-lite');
    const shuffled: Kit = {
      ...kit,
      classes: Object.fromEntries(Object.entries(kit.classes).reverse()),
    };
    expect(toLayout(shuffled)).toEqual(toLayout(kit));
    const back = fromLayout(toLayout(kit)).kit!;
    expect(Object.keys(back.classes)).toEqual(Object.keys(kit.classes).sort());
  });
});

describe('small diffs', () => {
  it('changes one file when one attribute label changes', () => {
    const kit = sampleKit('bpmn-lite');
    const task = Object.values(kit.classes).find((c) => c.key === 'Task')!;
    const edited: Kit = {
      ...kit,
      classes: {
        ...kit.classes,
        [task.id]: {
          ...task,
          attributes: task.attributes.map((a, i) =>
            i === 0 ? { ...a, labels: { en: 'Changed label' } } : a,
          ),
        },
      },
    };
    const before = new Map(toLayout(kit).map((f) => [f.path, f.content]));
    const after = new Map(toLayout(edited).map((f) => [f.path, f.content]));
    expect([...after.keys()]).toEqual([...before.keys()]);
    const different = [...after]
      .filter(([p, c]) => before.get(p) !== c)
      .map(([p]) => p);
    expect(different).toEqual(['classes/task.json']);
  });

  it('adding a class changes the new file and kit.json only', () => {
    const kit = sampleKit('er-lite');
    const first = Object.values(kit.classes)[0]!;
    const added: Kit = {
      ...kit,
      classes: {
        ...kit.classes,
        cls_new: { ...first, id: 'cls_new', key: 'Fresh', attributes: [] },
      },
    };
    const before = new Map(toLayout(kit).map((f) => [f.path, f.content]));
    const different = toLayout(added)
      .filter((f) => before.get(f.path) !== f.content)
      .map((f) => f.path);
    expect(different).toEqual(['classes/fresh.json', 'kit.json']);
  });
});

describe('hand edits', () => {
  it('reports a damaged class file with its path and still loads the rest', () => {
    const kit = sampleKit('er-lite');
    const files = toLayout(kit).map((f) =>
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
    expect(back.kit).not.toBeNull();
    expect(back.kit!.classes['cls_entity' as never]).toBeUndefined();
    expect(Object.keys(back.kit!.classes)).toHaveLength(
      Object.keys(kit.classes).length - 1,
    );
  });

  it('reports a file that does not match its schema and names the file', () => {
    const kit = sampleKit('er-lite');
    const files = toLayout(kit).map((f) =>
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
    const files = toLayout(sampleKit('er-lite')).map((f) =>
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
    expect(back.kit!.scripts['scr_gateway_check']?.source).toBe('');
  });

  it('cannot load without kit.json and says so', () => {
    const back = fromLayout(
      toLayout(sampleKit('er-lite')).filter((f) => f.path !== 'kit.json'),
    );
    expect(back.kit).toBeNull();
    expect(back.issues[0]?.path).toBe('kit.json');
  });

  it('reads a repository from before the Kit rename, with tool.json, and prefers kit.json', () => {
    const kit = sampleKit('er-lite');
    const older = toLayout(kit).map((f) =>
      f.path === 'kit.json' ? { ...f, path: 'tool.json' } : f,
    );
    const back = fromLayout(older);
    expect(back.issues).toEqual([]);
    expect(back.kit).toEqual(kit);
    // Both there (an older release wrote tool.json again): kit.json is the one read.
    const renamed = { ...kit, manifest: { ...kit.manifest, name: 'Old' } };
    const both = [
      ...toLayout(kit),
      ...toLayout(renamed)
        .filter((f) => f.path === 'kit.json')
        .map((f) => ({ ...f, path: 'tool.json' })),
    ];
    expect(fromLayout(both).kit?.manifest.name).toBe(kit.manifest.name);
    const broken = older.map((f) =>
      f.path === 'tool.json' ? { ...f, content: '{' } : f,
    );
    expect(fromLayout(broken).issues[0]?.path).toBe('tool.json');
  });

  it('refuses a newer format and ignores files outside the layout', () => {
    const files = toLayout(sampleKit('er-lite')).map((f) =>
      f.path === 'kit.json'
        ? {
            ...f,
            content: f.content.replace(
              '"formatVersion": 7',
              '"formatVersion": 99',
            ),
          }
        : f,
    );
    const back = fromLayout([...files, { path: 'README.md', content: '# hi' }]);
    expect(back.kit).toBeNull();
    expect(back.issues[0]?.message).toMatch(/newer version/);
    const ok = fromLayout([
      ...toLayout(sampleKit('er-lite')),
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
