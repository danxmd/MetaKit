// What the browser remembers about this app instance. It lives only in IndexedDB of this browser
// profile, never in the workspace folder (rule 9).

const DB = 'metakit';
const STORE = 'kv';

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function kvGet<T>(
  key: string,
  factory: IDBFactory = indexedDB,
): Promise<T | undefined> {
  const db = await open(factory);
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function kvSet(
  key: string,
  value: unknown,
  factory: IDBFactory = indexedDB,
): Promise<void> {
  const db = await open(factory);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The id of this browser profile as an app instance; created once and kept. */
export async function getInstanceId(
  factory: IDBFactory = indexedDB,
): Promise<string> {
  const existing = await kvGet<string>('instanceId', factory);
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const created = [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await kvSet('instanceId', created, factory);
  return created;
}

export type FolderAccess = {
  handle: FileSystemDirectoryHandle;
  granted: boolean;
};

/** Lets the user pick a folder (needs a click) and remembers it. */
export async function pickWorkspaceFolder(
  factory: IDBFactory = indexedDB,
): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await kvSet('workspaceFolder', handle, factory);
  return handle;
}

/** Remembers a folder handle obtained some other way. */
export function rememberWorkspaceFolder(
  handle: FileSystemDirectoryHandle,
  factory: IDBFactory = indexedDB,
): Promise<void> {
  return kvSet('workspaceFolder', handle, factory);
}

/**
 * The remembered folder, if any, and whether the browser still lets us use it. Without a user
 * action it can only look: call `requestAccess` from a click when `granted` is false.
 */
export async function recallWorkspaceFolder(
  factory: IDBFactory = indexedDB,
): Promise<FolderAccess | null> {
  const handle = await kvGet<FileSystemDirectoryHandle>(
    'workspaceFolder',
    factory,
  );
  if (!handle) return null;
  return {
    handle,
    granted:
      (await handle.queryPermission({ mode: 'readwrite' })) === 'granted',
  };
}

/** Asks the browser for permission to use the folder again; must run inside a click or key press. */
export async function requestAccess(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted')
    return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}
