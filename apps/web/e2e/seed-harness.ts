// Bundled and run inside Chromium by model-mode.spec.ts. It makes a workspace with a tool library
// in the browser's private file system, and lets the app "pick" it without a folder dialog.
import { LocalFolderAdapter, Workspace } from '@metakit-app/storage';
import type { ToolLibrary } from '@metakit-app/core';

async function seed(toolJson: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const name = sessionStorage.getItem('e2e-folder')!;
  const dir = await root.getDirectoryHandle(name, { create: true });
  const ws = await Workspace.create(new LocalFolderAdapter(dir, 'seed0001'), {
    name: 'E2E workspace',
  });
  await ws.createTool(JSON.parse(toolJson) as ToolLibrary);
}

(window as unknown as { __seed: typeof seed }).__seed = seed;
