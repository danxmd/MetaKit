import { build, type Plugin } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/**
 * What Vite does for `import text from 'file?raw'`: the file's text. The script editor's language
 * worker reads the TypeScript library declarations this way.
 */
const rawText: Plugin = {
  name: 'raw-text',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (args) => {
      const file = args.path.replace(/\?raw$/, '');
      const resolved = createRequire(args.importer || import.meta.url).resolve(
        file,
      );
      return { path: resolved, namespace: 'raw' };
    });
    b.onLoad({ filter: /.*/, namespace: 'raw' }, async (args) => ({
      contents: await readFile(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

async function bundle(file: string, format: 'iife'): Promise<string> {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(file, import.meta.url))],
    bundle: true,
    format,
    platform: 'browser',
    target: 'es2022',
    write: false,
    plugins: [rawText],
    // The TypeScript compiler checks `process` and friends; in a worker none of them exist.
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  return result.outputFiles[0]!.text;
}

/** Bundles a module that runs inside a Web Worker, as text to start a worker from. */
export const bundleWorker = (file: string): Promise<string> =>
  bundle(file, 'iife');

/** Bundles a harness module for the browser and runs it in the page. */
export async function loadHarness(page: Page, file: string): Promise<void> {
  const text = await bundle(file, 'iife');
  // The app asks for a name on the first visit; that dialog would sit over the harness.
  await page.addInitScript(() => {
    const w = window as unknown as { __METAKIT_TEST__?: object };
    w.__METAKIT_TEST__ ??= {
      remember: false,
      profile: { name: 'Tester', colour: '#1971c2' },
    };
  });
  await page.goto('/MetaKit/');
  await page.addScriptTag({ content: text });
}
