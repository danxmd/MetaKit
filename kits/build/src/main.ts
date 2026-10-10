import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { renderKit } from './define';
import { KIT_SPECS } from './kits/index';

/**
 * `pnpm kits:build`: writes `kits/<folder>/kit.json` and the sample model of every Kit in
 * `KIT_SPECS`. The files are formatted by Prettier, as `pnpm format` would.
 */

// dist/main.js and src/main.ts both sit two levels below kits/.
const kitsFolder = fileURLToPath(new URL('../../', import.meta.url));

for (const spec of KIT_SPECS) {
  const built = renderKit(spec);
  for (const file of built.files) {
    const path = join(kitsFolder, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await format(file.text, { parser: 'json' }));
    console.log(`Wrote kits/${file.path}`);
  }
}
