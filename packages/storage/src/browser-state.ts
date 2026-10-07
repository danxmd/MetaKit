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

/**
 * The instance id of this tab (ADR 0003). It is kept in `sessionStorage`, so a reload keeps it and
 * a new tab gets its own, which keeps two tabs of one profile from writing the same files.
 */
export function getTabInstanceId(
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
): string {
  const existing = storage.getItem('metakit.instanceId');
  if (existing && /^[0-9a-f]{8}$/.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const created = [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  storage.setItem('metakit.instanceId', created);
  return created;
}

/** How a person shows up to others: a display name and a colour, kept per browser profile. */
export interface Profile {
  name: string;
  colour: string;
}

/** Colours offered on the first visit; every one is readable with white initials. */
export const PROFILE_COLOURS = [
  '#e8590c',
  '#2f9e44',
  '#1971c2',
  '#9c36b5',
  '#c2255c',
  '#0c8599',
  '#5f3dc4',
  '#e67700',
] as const;

export async function getProfile(
  factory: IDBFactory = indexedDB,
): Promise<Profile | null> {
  const p = await kvGet<Profile>('profile', factory);
  return p && typeof p.name === 'string' && typeof p.colour === 'string'
    ? p
    : null;
}

export function setProfile(
  profile: Profile,
  factory: IDBFactory = indexedDB,
): Promise<void> {
  return kvSet('profile', profile, factory);
}

/**
 * What the person allowed the scripts of each tool to do in this browser. It lives in IndexedDB of
 * this browser profile and nowhere else: a permission is never written to the workspace folder or
 * the repository, so a shared tool cannot arrive with permissions already granted (rule 9).
 */
export interface ToolPermissionRecord {
  toolId: string;
  granted: { network: boolean; files: boolean };
  /** What was ever asked, so that a refusal is not asked again and a new permission is. */
  asked: { network: boolean; files: boolean };
  decidedAt: string;
}

export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

const PERMISSIONS_KEY = 'toolPermissions';

const isPermissionRecord = (r: unknown): r is ToolPermissionRecord => {
  const x = r as Partial<ToolPermissionRecord> | null;
  return (
    !!x &&
    typeof x.toolId === 'string' &&
    typeof x.decidedAt === 'string' &&
    typeof x.granted?.network === 'boolean' &&
    typeof x.granted.files === 'boolean' &&
    typeof x.asked?.network === 'boolean' &&
    typeof x.asked.files === 'boolean'
  );
};

/** The store that the permission logic of the behaviour package saves through. */
export function createToolPermissionBacking(
  kv: KeyValue = { get: (k) => kvGet(k), set: (k, v) => kvSet(k, v) },
): {
  load(): Promise<ToolPermissionRecord[]>;
  save(record: ToolPermissionRecord): Promise<void>;
  remove(toolId: string): Promise<void>;
} {
  const all = async (): Promise<Record<string, ToolPermissionRecord>> => {
    const stored = await kv.get<Record<string, unknown>>(PERMISSIONS_KEY);
    const out: Record<string, ToolPermissionRecord> = {};
    for (const [id, r] of Object.entries(stored ?? {}))
      if (isPermissionRecord(r) && r.toolId === id) out[id] = r;
    return out;
  };
  return {
    load: async () => Object.values(await all()),
    save: async (record) => {
      await kv.set(PERMISSIONS_KEY, {
        ...(await all()),
        [record.toolId]: record,
      });
    },
    remove: async (toolId) => {
      const rest = await all();
      delete rest[toolId];
      await kv.set(PERMISSIONS_KEY, rest);
    },
  };
}
