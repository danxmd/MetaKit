import {
  LocalFolderAdapter,
  getProfile,
  getTabInstanceId,
  recallWorkspaceFolder,
  rememberWorkspaceFolder,
  requestAccess,
  setProfile,
  type GitRemote,
  type Profile,
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
  /** Skips the first-visit question about name and colour. */
  profile?: Profile;
  /** Replaces GitHub and GitLab with a remote the test provides. */
  gitRemote?: (
    service: 'github' | 'gitlab',
    host: string,
    repo: string,
    folder: string,
    token: string,
  ) => GitRemote;
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
  // One id per tab (ADR 0003), so that two tabs never write the same files.
  return new LocalFolderAdapter(handle, getTabInstanceId());
}

/** The name and colour kept for this browser profile, or null on the first visit. */
export async function loadProfile(): Promise<Profile | null> {
  const test = hooks()?.profile;
  if (test) return test;
  try {
    return await getProfile();
  } catch {
    return null;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  if (hooks()?.profile) return;
  try {
    await setProfile(profile);
  } catch (error) {
    // Without storage the question is asked again next time.
    console.warn('The name and colour could not be stored.', error);
  }
}

/** The remote that e2e tests put in place of the real services, if any. */
export const testGitRemote = (): TestHooks['gitRemote'] => hooks()?.gitRemote;
