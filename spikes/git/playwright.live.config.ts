import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Real network, no token: read-only calls to public GitLab data. Run by hand.
export default defineConfig({
  ...base,
  testDir: './live',
  testMatch: '*.live.ts',
  timeout: 120_000,
});
