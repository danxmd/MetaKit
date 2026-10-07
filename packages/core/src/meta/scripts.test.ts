import { describe, expect, it } from 'vitest';
import { sampleTool } from '../testing/sample-tool';
import { createToolStore } from './commands';
import { validateToolLibrary } from './guards';
import { TOOL_FORMAT_VERSION, type ToolLibrary } from './types';
import type { Script } from './script-types';

const SCRIPT: Script = {
  id: 'scr_renumber',
  name: 'Renumber tasks',
  source: 'import { on } from "metakit";\non("object.created", () => {});',
};

const paths = (tool: unknown) => validateToolLibrary(tool).map((i) => i.path);
const withScripts = (scripts: unknown, manifest: object = {}): ToolLibrary => {
  const tool = sampleTool();
  return {
    ...tool,
    manifest: { ...tool.manifest, ...manifest },
    scripts,
  } as unknown as ToolLibrary;
};

describe('scripts in the tool library', () => {
  it('are format 4 and a library with scripts and permissions is valid', () => {
    expect(TOOL_FORMAT_VERSION).toBe(4);
    const tool = withScripts(
      { [SCRIPT.id]: SCRIPT },
      { permissions: { network: true, files: false } },
    );
    expect(validateToolLibrary(tool)).toEqual([]);
  });

  it('require the scripts table', () => {
    const tool = sampleTool() as unknown as Record<string, unknown>;
    delete tool.scripts;
    expect(paths(tool)).toContain('scripts');
  });

  it('report a wrong id, an id that does not match, an empty name and unknown fields', () => {
    const bad = {
      scr_a: { id: 'scr_a', name: '', source: 1, extra: true },
      scr_b: { id: 'rule_b', name: 'B', source: '' },
      scr_c: { id: 'scr_other', name: 'C', source: '' },
    };
    const p = paths(withScripts(bad));
    expect(p).toContain('scripts.scr_a.name');
    expect(p).toContain('scripts.scr_a.source');
    expect(p).toContain('scripts.scr_a.extra');
    expect(p).toContain('scripts.scr_b.id');
    expect(p).toContain('scripts.scr_c.id');
  });

  it('report bad permissions', () => {
    const p = paths(
      withScripts({}, { permissions: { network: 'yes', camera: true } }),
    );
    expect(p).toContain('manifest.permissions.network');
    expect(p).toContain('manifest.permissions.camera');
  });
});

describe('script commands', () => {
  it('put, replace and remove a script, and undo each step', () => {
    const store = createToolStore(sampleTool());
    store.execute({ type: 'putScript', script: SCRIPT });
    expect(store.state.scripts[SCRIPT.id]).toEqual(SCRIPT);
    store.execute({
      type: 'putScript',
      script: { ...SCRIPT, source: '// new', enabled: false },
    });
    expect(store.state.scripts[SCRIPT.id]?.enabled).toBe(false);
    store.execute({ type: 'removeScript', id: SCRIPT.id });
    expect(store.state.scripts[SCRIPT.id]).toBeUndefined();
    store.undo();
    expect(store.state.scripts[SCRIPT.id]?.source).toBe('// new');
    expect(validateToolLibrary(store.state)).toEqual([]);
  });

  it('refuse a bad id, an empty name and a missing script', () => {
    const store = createToolStore(sampleTool());
    expect(() =>
      store.execute({
        type: 'putScript',
        script: { ...SCRIPT, id: 'x_1' as never },
      }),
    ).toThrow(/scr_/);
    expect(() =>
      store.execute({ type: 'putScript', script: { ...SCRIPT, name: ' ' } }),
    ).toThrow(/name/);
    expect(() =>
      store.execute({ type: 'removeScript', id: 'scr_none' }),
    ).toThrow(/does not exist/);
  });

  it('change the permissions through updateManifest', () => {
    const store = createToolStore(sampleTool());
    store.execute({ type: 'updateManifest', permissions: { network: true } });
    expect(store.state.manifest.permissions).toEqual({ network: true });
  });
});
