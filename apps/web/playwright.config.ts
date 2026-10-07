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
      // Chromium maps file names through the locale; in a plain C locale it cannot store accented
      // or non-Latin names, which the storage tests need.
      env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } as Record<
        string,
        string
      >,
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
