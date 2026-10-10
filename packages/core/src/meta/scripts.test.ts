import { describe, expect, it } from 'vitest';
import { sampleKit } from '../testing/sample-kit';
import { createKitStore } from './commands';
import { validateKit } from './guards';
import { KIT_FORMAT_VERSION, type Kit } from './types';
import type { Script } from './script-types';

const SCRIPT: Script = {
  id: 'scr_renumber',
  name: 'Renumber tasks',
  source: 'import { on } from "metakit";\non("object.created", () => {});',
};

const paths = (kit: unknown) => validateKit(kit).map((i) => i.path);
const withScripts = (scripts: unknown, manifest: object = {}): Kit => {
  const kit = sampleKit();
  return {
    ...kit,
    manifest: { ...kit.manifest, ...manifest },
    scripts,
  } as unknown as Kit;
};

describe('scripts in the Kit', () => {
  it('are in format 4 and later, and a library with scripts and permissions is valid', () => {
    expect(KIT_FORMAT_VERSION).toBe(6);
    const kit = withScripts(
      { [SCRIPT.id]: SCRIPT },
      { permissions: { network: true, files: false } },
    );
    expect(validateKit(kit)).toEqual([]);
  });

  it('require the scripts table', () => {
    const kit = sampleKit() as unknown as Record<string, unknown>;
    delete kit.scripts;
    expect(paths(kit)).toContain('scripts');
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
    const store = createKitStore(sampleKit());
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
    expect(validateKit(store.state)).toEqual([]);
  });

  it('refuse a bad id, an empty name and a missing script', () => {
    const store = createKitStore(sampleKit());
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
    const store = createKitStore(sampleKit());
    store.execute({ type: 'updateManifest', permissions: { network: true } });
    expect(store.state.manifest.permissions).toEqual({ network: true });
  });
});
