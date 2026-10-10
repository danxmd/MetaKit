// Bundled and run inside Chromium by model-mode.spec.ts. It makes a workspace with a Kit
// in the browser's private file system, and lets the app "pick" it without a folder dialog.
import { LocalFolderAdapter, Workspace } from '@metakit-app/storage';
import type { Kit } from '@metakit-app/core';

async function folder(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const name = sessionStorage.getItem('e2e-folder')!;
  return root.getDirectoryHandle(name, { create: true });
}

/** A workspace as this release makes it: the Kit in `kits/<slug>/`. */
async function seed(kitJson: string): Promise<void> {
  const ws = await Workspace.create(
    new LocalFolderAdapter(await folder(), 'seed0001'),
    { name: 'E2E workspace' },
  );
  await ws.createKit(JSON.parse(kitJson) as Kit);
}

/** Writes files as they are, such as a workspace written by an older release. */
async function seedFiles(files: Record<string, string>): Promise<void> {
  const top = await folder();
  for (const [path, text] of Object.entries(files)) {
    const parts = path.split('/');
    let dir = top;
    for (const part of parts.slice(0, -1))
      dir = await dir.getDirectoryHandle(part, { create: true });
    const handle = await dir.getFileHandle(parts.at(-1)!, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }
}

Object.assign(window, { __seed: seed, __seedFiles: seedFiles });
