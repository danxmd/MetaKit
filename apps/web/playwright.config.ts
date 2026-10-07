import { defineConfig } from '@playwright/test';

const port = 4173;
// Served from a sub-path on purpose: GitHub Pages hosts the app under /<repo>/.
export const basePath = '/MetaKit/';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: {
      // Lets an environment with a preinstalled Chromium skip the download.
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}${basePath}`,
    env: { BASE_PATH: basePath },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
