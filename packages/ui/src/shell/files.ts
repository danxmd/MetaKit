/** The kinds of file MetaKit can import, told apart by the file name. */
export type ImportKind = 'model' | 'bundle' | 'tool';

const EXTENSIONS: readonly (readonly [string, ImportKind])[] = [
  ['.mkmodel.json', 'model'],
  ['.mkbundle', 'bundle'],
  ['.mktool', 'tool'],
];

/** What the file chooser should offer. */
export const IMPORT_ACCEPT = EXTENSIONS.map(([ext]) => ext).join(',');

export function importKindOf(fileName: string): ImportKind | null {
  const lower = fileName.toLowerCase();
  return EXTENSIONS.find(([ext]) => lower.endsWith(ext))?.[1] ?? null;
}

/** One importer per kind. A model file is text; bundles and tool packages are zip files. */
export interface FileImporters<M, B, T> {
  model(text: string, fileName: string): Promise<M>;
  bundle(bytes: Uint8Array, fileName: string): Promise<B>;
  tool(bytes: Uint8Array, fileName: string): Promise<T>;
}

export type FileImportResult<M, B, T> =
  | { fileName: string; kind: 'model'; ok: true; value: M }
  | { fileName: string; kind: 'bundle'; ok: true; value: B }
  | { fileName: string; kind: 'tool'; ok: true; value: T }
  | { fileName: string; kind: ImportKind | null; ok: false; message: string };

/**
 * Hands each file to the importer for its kind, one after the other (so that a bundle's tool is
 * there before the model file that follows it). A file that fails does not stop the others; its
 * result says why in plain English.
 */
export async function importFiles<M, B, T>(
  files: readonly File[],
  importers: FileImporters<M, B, T>,
): Promise<FileImportResult<M, B, T>[]> {
  const results: FileImportResult<M, B, T>[] = [];
  for (const file of files) {
    const fileName = file.name;
    const kind = importKindOf(fileName);
    if (kind === null) {
      results.push({
        fileName,
        kind,
        ok: false,
        message: `"${fileName}" is not a file MetaKit can import. Choose a .mkmodel.json, .mkbundle or .mktool file.`,
      });
      continue;
    }
    try {
      if (kind === 'model')
        results.push({
          fileName,
          kind,
          ok: true,
          value: await importers.model(await file.text(), fileName),
        });
      else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (kind === 'bundle')
          results.push({
            fileName,
            kind,
            ok: true,
            value: await importers.bundle(bytes, fileName),
          });
        else
          results.push({
            fileName,
            kind,
            ok: true,
            value: await importers.tool(bytes, fileName),
          });
      }
    } catch (error) {
      results.push({
        fileName,
        kind,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

/** Runs the file through the browser's download, for the exports. */
export function downloadFile(
  fileName: string,
  data: Uint8Array | string,
  mime = 'application/octet-stream',
): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked later because some browsers start the download after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
