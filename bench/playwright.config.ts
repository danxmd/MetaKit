import { defineConfig } from '@playwright/test';

// Headless Chromium rasterises in software, so the numbers are indicative; the limits in
// budget.json leave room for that and are what the build enforces.
export default defineConfig({
  testDir: '.',
  testMatch: '*.bench.ts',
  timeout: 600_000,
  workers: 1,
  reporter: 'list',
  use: {
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
