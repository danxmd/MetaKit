import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderKit } from './define';
import { KIT_SPECS } from './kits/index';

/**
 * The committed files are what the build script makes. After a change to a description, run
 * `pnpm kits:build` and commit the files it writes.
 */

const kitsFolder = (path: string) =>
  fileURLToPath(new URL(`../../${path}`, import.meta.url));

describe('pnpm kits:build', () => {
  it('has one description per folder', () => {
    const folders = KIT_SPECS.map((s) => s.folder);
    expect(new Set(folders).size).toBe(folders.length);
  });

  for (const spec of KIT_SPECS)
    it(`${spec.name}: building it again gives the committed files`, () => {
      // Twice, to show the ids do not depend on chance.
      const first = renderKit(spec);
      const second = renderKit(spec);
      expect(second.files).toEqual(first.files);
      for (const file of first.files) {
        // Compared as data: Prettier decides the layout of the committed text.
        const committed: unknown = JSON.parse(
          readFileSync(kitsFolder(file.path), 'utf8'),
        );
        expect(committed, file.path).toEqual(JSON.parse(file.text));
      }
    });
});
