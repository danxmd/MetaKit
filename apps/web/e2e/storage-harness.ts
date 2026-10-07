// Bundled and run inside Chromium by storage.spec.ts. The contract cases are plain
// functions, so the same cases that run in Node run here against the real File System Access API
// (on the origin private file system, which has the same handle interface as a picked folder).
import {
  adapterContract,
  getInstanceId,
  kvGet,
  kvSet,
  LocalFolderAdapter,
  recallWorkspaceFolder,
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

async function handleStorage(): Promise<Record<string, unknown>> {
  // The headless Chromium used in CI crashes when a handle of the origin private file system is
  // stored in IndexedDB (a picked folder is not affected, but needs a dialog that tests cannot
  // drive). So this checks the storage round trip with a plain value and the "nothing remembered"
  // answer, and leaves the handle itself to manual testing.
  const before = await recallWorkspaceFolder();
  await kvSet('probe', { a: 1 });
  return {
    nothingRemembered: before === null,
    roundTrip: await kvGet('probe'),
  };
}

async function permission(): Promise<Record<string, unknown>> {
  return { requestAccess: await requestAccess(await freshFolder()) };
}

async function instance(): Promise<Record<string, unknown>> {
  const first = await getInstanceId();
  return {
    instanceStable:
      first === (await getInstanceId()) && /^[0-9a-f]{8}$/.test(first),
    stored: (await kvGet<string>('instanceId')) === first,
  };
}

async function workspace(): Promise<Record<string, unknown>> {
  // A whole workspace on a folder in the browser.
  const folder = await freshFolder();
  await Workspace.create(
    new LocalFolderAdapter(folder, 'aaaa0001', { pollIntervalMs: 40 }),
    { name: 'Browser workspace' },
  );
  const again = await Workspace.open(
    new LocalFolderAdapter(folder, 'cccc0003'),
  );
  return { workspaceName: again.info.name };
}

(window as unknown as { __storage: unknown }).__storage = {
  runContract,
  handleStorage,
  permission,
  instance,
  workspace,
};
