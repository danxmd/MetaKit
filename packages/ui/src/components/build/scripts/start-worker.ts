import {
  createLanguageClient,
  type LanguageClient,
  type WorkerLike,
} from './script-language-client';

/**
 * Starts the language worker. Kept apart from the editor because `import.meta.url` is what the
 * bundler looks for to make the worker its own file; the end-to-end harness passes its own worker.
 */
export function startLanguageClient(): LanguageClient {
  const worker = new Worker(
    new URL('./script-language-worker.ts', import.meta.url),
    { type: 'module' },
  );
  return createLanguageClient(worker as unknown as WorkerLike);
}
