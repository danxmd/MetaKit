import { describe, expect, it } from 'vitest';
import { validateToolLibrary, type ToolLibrary } from '@metakit-app/core';
import { BUILT_IN_TOOLS } from './built-in';

describe('built-in tool libraries', () => {
  it('have unique ids', () => {
    const ids = BUILT_IN_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const entry of BUILT_IN_TOOLS)
    it(`${entry.name}: the listed id, name and version match the file, which is valid`, async () => {
      const tool = JSON.parse(await entry.load()) as ToolLibrary;
      expect(tool.manifest.id).toBe(entry.id);
      expect(tool.manifest.name).toBe(entry.name);
      expect(tool.manifest.version).toBe(entry.version);
      expect(validateToolLibrary(tool)).toEqual([]);
    });
});
