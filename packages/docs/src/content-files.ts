// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the d.ts must travel with this file into packages that import it
/// <reference path="./vite-env.d.ts" />

// Loaded only through a dynamic import (see content.ts), so Vite puts all topics into one lazy
// chunk and the first download of the app does not carry the documentation. Eager inside that
// chunk keeps it one request instead of one per topic.
export const files: Record<string, string> = import.meta.glob(
  '../content/**/*.md',
  { query: '?raw', import: 'default', eager: true },
);
