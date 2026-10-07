import { fromBytes, toBytes, type StorageAdapter } from '@metakit-app/storage';
import type {
  ScriptFiles,
  ScriptHttp,
  ScriptHttpRequest,
  ScriptHttpResponse,
} from '@metakit-app/behaviour';

/** Folders that belong to the sync machinery; scripts never see them. */
const hidden = (path: string): boolean =>
  path.split('/')[0]?.startsWith('_') ?? false;

/**
 * Files of the workspace for scripts. A script can create new files but not replace one: shared
 * files are write-once (architecture rule 6), so a second write to the same path says so instead.
 */
export function workspaceFiles(adapter: StorageAdapter): ScriptFiles {
  const check = (path: string): string => {
    if (hidden(path))
      throw new Error(
        `"${path}" belongs to MetaKit's own files, which scripts cannot use.`,
      );
    return path;
  };
  return {
    async read(path) {
      return fromBytes(await adapter.read(check(path)));
    },
    async write(path, text) {
      if (await adapter.exists(check(path)))
        throw new Error(
          `"${path}" already exists. Scripts can create new files but cannot replace existing ones; choose another name.`,
        );
      await adapter.writeNew(path, toBytes(text));
    },
    async list(folder) {
      if (folder !== '') check(folder);
      return (await adapter.list(folder))
        .filter((e) => !(folder === '' && e.name.startsWith('_')))
        .map((e) => e.name);
    },
    exists: (path) => adapter.exists(check(path)),
  };
}

/** `fetch` for scripts: no cookies and no credentials, so a script cannot act as the signed-in user. */
export function browserHttp(): ScriptHttp {
  return {
    async request(request: ScriptHttpRequest): Promise<ScriptHttpResponse> {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        credentials: 'omit',
        ...(request.body !== undefined ? { body: request.body } : {}),
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => (headers[key] = value));
      return { status: response.status, headers, text: await response.text() };
    },
  };
}
