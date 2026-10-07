import {
  LocalFolderAdapter,
  getInstanceId,
  recallWorkspaceFolder,
  rememberWorkspaceFolder,
  requestAccess,
  type StorageAdapter,
} from '@metakit-app/storage';

/**
 * A seam for end-to-end tests, which cannot drive the browser's folder dialog: they provide a
 * folder handle themselves, and can switch off remembering it (the headless browser used in CI
 * crashes when a handle of the browser's private file system is stored in IndexedDB).
 */
export interface TestHooks {
  pickFolder?: () => Promise<FileSystemDirectoryHandle>;
  remember?: boolean;
}

function hooks(): TestHooks | undefined {
  return (window as unknown as { __METAKIT_TEST__?: TestHooks })
    .__METAKIT_TEST__;
}

export interface RememberedFolder {
  handle: FileSystemDirectoryHandle;
  name: string;
  granted: boolean;
}

/** Lets the user pick a folder (must run inside a click) and remembers it for next time. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  const test = hooks();
  const handle = test?.pickFolder
    ? await test.pickFolder()
    : await window.showDirectoryPicker({ mode: 'readwrite' });
  if (test?.remember !== false) {
    try {
      await rememberWorkspaceFolder(handle);
    } catch {
      // Remembering is a convenience; the folder is open either way.
    }
  }
  return handle;
}

export async function rememberedFolder(): Promise<RememberedFolder | null> {
  if (hooks()?.remember === false) return null;
  try {
    const found = await recallWorkspaceFolder();
    return found
      ? {
          handle: found.handle,
          name: found.handle.name,
          granted: found.granted,
        }
      : null;
  } catch {
    return null;
  }
}

/** Asks for access to a remembered folder again; must run inside a click. */
export function askAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return requestAccess(handle);
}

export async function adapterFor(
  handle: FileSystemDirectoryHandle,
): Promise<StorageAdapter> {
  return new LocalFolderAdapter(handle, await getInstanceId());
}
