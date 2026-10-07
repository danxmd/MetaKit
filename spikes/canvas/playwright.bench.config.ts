import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Headless Chromium rasterises in software, so these numbers are indicative only. The bench
// page (`?bench`) runs the same code in a real browser for the numbers that decide the spike.
export default defineConfig({
  ...base,
  testDir: './bench',
  testMatch: '*.bench.ts',
  timeout: 300_000,
  use: { ...base.use, viewport: { width: 1600, height: 900 } },
});
