import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'spikes/*/src/**/*.test.ts',
      'kits/build/src/**/*.test.ts',
    ],
    environment: 'node',
  },
});
