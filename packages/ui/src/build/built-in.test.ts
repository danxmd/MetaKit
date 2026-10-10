import { describe, expect, it } from 'vitest';
import { validateKit, type Kit } from '@metakit-app/core';
import { BUILT_IN_KITS, groupBuiltIns, searchBuiltIns } from './built-in';

describe('built-in Kits', () => {
  it('have unique ids', () => {
    const ids = BUILT_IN_KITS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const entry of BUILT_IN_KITS)
    it(`${entry.name}: the listed id, name and version match the file, which is valid`, async () => {
      const kit = JSON.parse(await entry.load()) as Kit;
      expect(kit.manifest.id).toBe(entry.id);
      expect(kit.manifest.name).toBe(entry.name);
      expect(kit.manifest.version).toBe(entry.version);
      expect(validateKit(kit)).toEqual([]);
    });
});

describe('finding a built-in Kit', () => {
  const names = (query: string) =>
    searchBuiltIns(BUILT_IN_KITS, query).map((k) => k.name);

  it('matches every word in the name or description, in any case', () => {
    expect(names('lineage')).toContain('Data and AI architecture');
    expect(names('lineage')).toContain('Data pipelines and lineage');
    expect(names('lineage')).not.toContain('ER lite');
    expect(names('MATURITY gap')).toEqual(['Data and AI maturity assessment']);
    expect(names('acceptance criteria')).toEqual([
      'Requirements and user stories',
    ]);
    expect(names('  ')).toHaveLength(BUILT_IN_KITS.length);
    expect(names('nothing like this')).toEqual([]);
  });

  it('groups by domain in the fixed order and leaves out empty headings', () => {
    expect(groupBuiltIns(BUILT_IN_KITS).map((g) => g.label)).toEqual([
      'Data and AI',
      'Business and strategy',
      'Delivery',
      'Architecture',
    ]);
    expect(
      groupBuiltIns(searchBuiltIns(BUILT_IN_KITS, 'entities')).map((g) => [
        g.id,
        g.kits.map((k) => k.name),
      ]),
    ).toEqual([
      ['data-ai', ['Data modelling']],
      ['architecture', ['ER lite']],
    ]);
  });
});
