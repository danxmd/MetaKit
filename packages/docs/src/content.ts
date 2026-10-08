import { DocsIndex } from './docs-index';

/** Builds an index from raw files keyed by path. Tests use this with fixtures. */
export function docsFromFiles(files: Readonly<Record<string, string>>): DocsIndex {
  return DocsIndex.fromFiles(files);
}

let loading: Promise<DocsIndex> | null = null;

/**
 * The documentation shipped with the app. The topics are fetched on the first call only, so the
 * app's first download stays small; later calls return the same index.
 */
export function loadDocs(): Promise<DocsIndex> {
  loading ??= import('./content-files').then(({ files }) =>
    DocsIndex.fromFiles(files),
  );
  return loading;
}
