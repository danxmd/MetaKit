// Bundled and run inside Chromium by model-mode.spec.ts. It makes a workspace with a Kit
// in the browser's private file system, and lets the app "pick" it without a folder dialog.
import { LocalFolderAdapter, Workspace } from '@metakit-app/storage';
import type { Kit } from '@metakit-app/core';

async function seed(kitJson: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const name = sessionStorage.getItem('e2e-folder')!;
  const dir = await root.getDirectoryHandle(name, { create: true });
  const ws = await Workspace.create(new LocalFolderAdapter(dir, 'seed0001'), {
    name: 'E2E workspace',
  });
  await ws.createKit(JSON.parse(kitJson) as Kit);
}

(window as unknown as { __seed: typeof seed }).__seed = seed;
