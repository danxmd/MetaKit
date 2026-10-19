import { readFileSync } from 'node:fs';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// The version shown in the footer and compared with GitHub's latest release (ADR 0015).
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  // GitHub Pages serves from /<repo>/, so the deploy job sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  define: { __METAKIT_VERSION__: JSON.stringify(version) },
  plugins: [svelte()],
});
