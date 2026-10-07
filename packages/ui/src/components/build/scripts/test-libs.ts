import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * The TypeScript library files, read from the installed compiler, for tests that run the language
 * service in Node. The app gets the same files through the bundler (ts-libs.ts).
 */
export function loadTestLibs(): Record<string, string> {
  const require = createRequire(import.meta.url);
  const dir = join(dirname(require.resolve('typescript/package.json')), 'lib');
  const wanted =
    /^lib\.(es5|es201[5-9](\..*)?|es202[0-2](\..*)?|decorators.*)\.d\.ts$/;
  const libs: Record<string, string> = {};
  for (const name of readdirSync(dir))
    if (wanted.test(name) && !/full|intl/.test(name))
      libs[`/lib/${name}`] = readFileSync(join(dir, name), 'utf8');
  return libs;
}
