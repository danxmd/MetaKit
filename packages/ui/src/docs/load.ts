import type { DocsIndex } from '@metakit-app/docs';

let pending: Promise<DocsIndex> | null = null;

/**
 * The documentation index, fetched on first use. The docs code and the topics are separate
 * chunks, so people who never open Help never download them.
 */
export function loadDocsIndex(): Promise<DocsIndex> {
  pending ??= import('@metakit-app/docs').then((m) => m.loadDocs());
  // A failed fetch (offline after an update) must not stick: the next open tries again.
  pending.catch(() => (pending = null));
  return pending;
}
