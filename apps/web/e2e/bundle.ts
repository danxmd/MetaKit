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
  await page.goto('/MetaKit/');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
}
