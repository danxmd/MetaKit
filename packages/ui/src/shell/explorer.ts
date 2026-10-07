import type { ModelEntry } from '@metakit-app/storage';

export interface FolderNode {
  /** Display name; empty for the root. */
  name: string;
  /** Full path such as "Sales/2026"; empty for the root. */
  path: string;
  folders: FolderNode[];
  models: ModelEntry[];
}

/**
 * A folder path as the user types it: parts separated by `/`, trimmed, no empty parts, and no
 * `.` or `..` since a folder is only a label on the model, not a directory. Returns null for
 * "no folder".
 */
export function normalizeFolder(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const parts = input
    .split(/[\\/]+/)
    .map((p) => p.trim())
    .filter((p) => p !== '' && p !== '.' && p !== '..');
  return parts.length === 0 ? null : parts.join('/');
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, {
    sensitivity: 'base',
    numeric: true,
  });

/** Models grouped by their folder field, folders and models sorted by name. */
export function buildExplorerTree(models: readonly ModelEntry[]): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: [], models: [] };
  for (const model of models) {
    let node = root;
    const folder = normalizeFolder(model.folder);
    if (folder) {
      let path = '';
      for (const part of folder.split('/')) {
        path = path === '' ? part : `${path}/${part}`;
        let child = node.folders.find((f) => f.name === part);
        if (!child) {
          child = { name: part, path, folders: [], models: [] };
          node.folders.push(child);
        }
        node = child;
      }
    }
    node.models.push(model);
  }
  const sort = (node: FolderNode) => {
    node.folders.sort(byName);
    node.models.sort(byName);
    node.folders.forEach(sort);
  };
  sort(root);
  return root;
}

/** Every folder path in use, for the "move to folder" choice. */
export function folderPaths(models: readonly ModelEntry[]): string[] {
  const paths = new Set<string>();
  for (const m of models) {
    const folder = normalizeFolder(m.folder);
    if (!folder) continue;
    const parts = folder.split('/');
    for (let i = 1; i <= parts.length; i++)
      paths.add(parts.slice(0, i).join('/'));
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}
