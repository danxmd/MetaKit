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
