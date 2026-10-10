import { describe, expect, it } from 'vitest';
import { validateKit, type Kit } from '@metakit-app/core';
import { BUILT_IN_KITS } from './built-in';

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
