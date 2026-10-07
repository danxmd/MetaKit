import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/** Bundles a harness module for the browser and runs it in the page. */
export async function loadHarness(page: Page, file: string): Promise<void> {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL(file, import.meta.url))],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  // The app asks for a name on the first visit; that dialog would sit over the harness.
  await page.addInitScript(() => {
    const w = window as unknown as { __METAKIT_TEST__?: object };
    w.__METAKIT_TEST__ ??= {
      remember: false,
      profile: { name: 'Tester', colour: '#1971c2' },
    };
  });
  await page.goto('/MetaKit/');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
}
