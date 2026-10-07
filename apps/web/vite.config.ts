import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves from /<repo>/, so the deploy job sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [svelte()],
});
