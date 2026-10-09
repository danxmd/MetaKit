import { describe, expect, it } from 'vitest';
import { FormatError, NewerFormatError } from './errors';
import {
  CURRENT_FORMAT,
  MIGRATIONS,
  migrate,
  type MigrationRegistry,
} from './migrate';

describe('migration', () => {
  it('upgrades the example: a version 0 workspace file called its name "title"', () => {
    const result = migrate('workspace', {
      formatVersion: 0,
      title: 'Research group',
      created: '2026-10-07T09:00:00.000Z',
    });
    expect(result).toEqual({
      from: 0,
      to: 1,
      value: {
        formatVersion: 1,
        name: 'Research group',
        created: '2026-10-07T09:00:00.000Z',
      },
    });
  });

  it('does not touch a file that is current', () => {
    const file = { formatVersion: 1, name: 'x', created: 'y' };
    const result = migrate('workspace', file);
    expect(result.value).toBe(file);
    expect(result.from).toBe(1);
  });

  it('keeps a name that is already there', () => {
    expect(
      migrate('workspace', { formatVersion: 0, title: 'old', name: 'new' })
        .value.name,
    ).toBe('new');
  });

  it('applies steps in order when a file is two versions behind', () => {
    const registry: MigrationRegistry = {
      ...MIGRATIONS,
      model: [
        {
          from: 1,
          to: 2,
          up: (v) => ({
            ...v,
            steps: [...((v.steps as string[]) ?? []), 'one-to-two'],
          }),
        },
        {
          from: 2,
          to: 3,
          up: (v) => ({
            ...v,
            steps: [...((v.steps as string[]) ?? []), 'two-to-three'],
          }),
        },
      ],
    };
    const result = migrate('model', { formatVersion: 1 }, registry, {
      ...CURRENT_FORMAT,
      model: 3,
    });
    expect(result).toEqual({
      from: 1,
      to: 3,
      value: { formatVersion: 3, steps: ['one-to-two', 'two-to-three'] },
    });
  });

  it('refuses a newer file and says to update', () => {
    expect(() => migrate('model', { formatVersion: 99 })).toThrow(
      NewerFormatError,
    );
    expect(() => migrate('model', { formatVersion: 99 })).toThrow(
      /Update MetaKit.*has not been changed/,
    );
  });

  it('refuses files without a usable version', () => {
    for (const bad of [
      {},
      { formatVersion: '1' },
      { formatVersion: 1.5 },
      { formatVersion: -1 },
      null,
      [],
      'x',
    ]) {
      expect(() => migrate('tool', bad)).toThrow(FormatError);
    }
  });

  it('refuses when there is no step to take', () => {
    expect(() => migrate('tool', { formatVersion: 0 })).toThrow(
      /no way to bring a tool file from format 0 up to 1/,
    );
  });

  it('knows every kind', () => {
    for (const kind of Object.keys(CURRENT_FORMAT))
      expect(MIGRATIONS).toHaveProperty(kind);
  });
});

describe('snapshot format 2', () => {
  it('turns a format 1 snapshot (a plain document) into registers without losing anything', async () => {
    const { parseSnapshot, materialize } = await import('@metakit-app/sync');
    const document = {
      attrs: {},
      connectors: {},
      elements: { el_a: { attrs: { att_n: 'A' }, id: 'el_a', x: 1 } },
      formatVersion: 1,
      manifest: { id: 'mdl_x', name: 'X' },
    };
    const v1 = {
      document,
      formatVersion: 1,
      instance: 'aaaa0001',
      kind: 'model',
      savedAt: '2026-10-07T09:00:00.000Z',
    };
    const migrated = migrate('snapshot', v1);
    expect(migrated).toMatchObject({ from: 1, to: 2 });
    expect(migrated.value['formatVersion']).toBe(2);
    const parsed = parseSnapshot(
      `${JSON.stringify(migrated.value)}\n`,
      'model',
    );
    expect(materialize(parsed.state)).toEqual(document);
    expect(parsed.instance).toBe('aaaa0001');
  });
});

describe('tool library formats 2, 3 and 4', () => {
  it('adds empty shapes, panels and rules to a version 1 library and keeps the rest', () => {
    const v1 = {
      formatVersion: 1,
      manifest: {
        id: 'tool_x',
        name: 'X',
        version: '1.0.0',
        languages: ['en'],
      },
      settings: {},
      classes: { cls_a: { id: 'cls_a', key: 'A' } },
      relations: {},
      modelTypes: {},
    };
    const { value, from, to } = migrate('tool-document', v1);
    expect([from, to]).toEqual([1, 6]);
    expect(value).toEqual({
      ...v1,
      formatVersion: 6,
      shapes: {},
      panels: {},
      rules: {},
      scripts: {},
    });
  });

  it('adds only the rules to a version 2 library and leaves its shapes alone', () => {
    const v2 = {
      formatVersion: 2,
      shapes: { shp_a: { id: 'shp_a' } },
      panels: {},
    };
    const { value, from, to } = migrate('tool-document', v2);
    expect([from, to]).toEqual([2, 6]);
    expect(value).toEqual({
      ...v2,
      formatVersion: 6,
      rules: {},
      scripts: {},
    });
  });

  it('adds only the scripts to a version 3 library and keeps its rules', () => {
    const v3 = {
      formatVersion: 3,
      shapes: {},
      panels: {},
      rules: { rule_a: { id: 'rule_a' } },
    };
    const { value, from, to } = migrate('tool-document', v3);
    expect([from, to]).toEqual([3, 6]);
    expect(value).toEqual({ ...v3, formatVersion: 6, scripts: {} });
  });

  it('only raises the version of a version 4 library (format 5 adds the optional look)', () => {
    const v4 = {
      formatVersion: 4,
      shapes: { shp_a: { id: 'shp_a', kind: 'node' } },
      rules: {},
      scripts: { scr_a: { id: 'scr_a', name: 'A', source: '' } },
    };
    const { value, from, to } = migrate('tool-document', v4);
    expect([from, to]).toEqual([4, 6]);
    expect(value).toEqual({ ...v4, formatVersion: 6 });
  });

  it('only raises the version of a version 5 library (format 6 adds the optional basedOn)', () => {
    const v5 = {
      formatVersion: 5,
      shapes: {
        shp_a: {
          id: 'shp_a',
          kind: 'relation',
          look: { colour: '#000', width: 1 },
        },
      },
      rules: {},
      scripts: {},
    };
    const { value, from, to } = migrate('tool-document', v5);
    expect([from, to]).toEqual([5, 6]);
    expect(value).toEqual({ ...v5, formatVersion: 6 });
  });

  it('leaves a version 6 library alone, and refuses one from a newer release', () => {
    const v6 = {
      formatVersion: 6,
      manifest: {
        id: 'tool_b',
        name: 'B',
        version: '1.0.0',
        languages: ['en'],
        basedOn: { id: 'tool_a', name: 'A', version: '2.1.0' },
      },
      rules: {},
      scripts: {},
    };
    expect(migrate('tool-document', v6).value).toEqual(v6);
    expect(() => migrate('tool-document', { formatVersion: 7 })).toThrow(
      /newer version/,
    );
  });
});
