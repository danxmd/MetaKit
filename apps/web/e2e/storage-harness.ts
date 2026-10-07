// Bundled and run inside Chromium by storage.spec.ts. The contract cases are plain
// functions, so the same cases that run in Node run here against the real File System Access API
// (on the origin private file system, which has the same handle interface as a picked folder).
import {
  adapterContract,
  getInstanceId,
  kvGet,
  LocalFolderAdapter,
  recallWorkspaceFolder,
  rememberWorkspaceFolder,
  requestAccess,
  Workspace,
} from '@metakit-app/storage';

export interface CaseResult {
  name: string;
  ok: boolean;
  error?: string;
}

async function freshFolder(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(
    `contract-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    { create: true },
  );
}

async function runContract(useObserver: boolean): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of adapterContract()) {
    const folder = await freshFolder();
    const options = { pollIntervalMs: 40, useObserver };
    try {
      await c.run({
        one: new LocalFolderAdapter(folder, 'aaaa0001', options),
        two: new LocalFolderAdapter(folder, 'bbbb0002', options),
        close: async () => undefined,
      });
      results.push({ name: c.name, ok: true });
    } catch (error) {
      results.push({
        name: c.name,
        ok: false,
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
      });
    }
  }
  return results;
}

async function runExtras(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const folder = await freshFolder();
  // The folder handle and the instance id are kept in IndexedDB.
  await rememberWorkspaceFolder(folder);
  const recalled = await recallWorkspaceFolder();
  out.recalled =
    recalled !== null && (await recalled.handle.isSameEntry(folder));
  out.granted = recalled?.granted;
  out.requestAccess = await requestAccess(folder);
  const first = await getInstanceId();
  out.instanceStable =
    first === (await getInstanceId()) && /^[0-9a-f]{8}$/.test(first);
  out.stored = (await kvGet<string>('instanceId')) === first;

  // A whole workspace on a folder in the browser.
  const adapter = new LocalFolderAdapter(folder, first, { pollIntervalMs: 40 });
  await Workspace.create(adapter, { name: 'Browser workspace' });
  const again = await Workspace.open(
    new LocalFolderAdapter(folder, 'cccc0003'),
  );
  out.workspaceName = again.info.name;
  return out;
}

(window as unknown as { __storage: unknown }).__storage = {
  runContract,
  runExtras,
};
