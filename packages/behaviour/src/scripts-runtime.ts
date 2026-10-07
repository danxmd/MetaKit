import type { ModelStore, ScriptId, ToolLibrary } from '@metakit-app/core';
import type { Behaviour } from './runtime';
import { NO_PERMISSIONS, type PermissionStore } from './permissions';
import type { ConsoleLine, ScriptEngine, ScriptStatus } from './scripts';
import type { ScriptFiles, ScriptHttp } from './script-services';
import type { SandboxLimits } from './sandbox/sandbox';

export interface AttachScriptsOptions {
  store: ModelStore;
  /** The tool library as it is now. */
  tool: () => ToolLibrary;
  files?: ScriptFiles;
  http?: ScriptHttp;
  /** What this browser allowed; without it scripts have no files and no network. */
  permissions?: PermissionStore;
  /** The ids of the selected objects. */
  selection?: () => string[];
  /** Where the WebAssembly file is. A browser build finds it by itself; Node needs nothing. */
  wasmUrl?: string;
  limits?: Partial<SandboxLimits>;
}

/**
 * What the app holds on to for the scripts of the open model. The engine behind it exists only
 * while the tool has scripts: until then nothing of QuickJS, the compiler or the script API has
 * been downloaded.
 */
export interface ScriptsHandle {
  /** The engine, or null while the tool has no enabled script. */
  readonly engine: ScriptEngine | null;
  /** Run a script by hand: a rule action, an action attribute or the Run button. */
  runScript(id: ScriptId | string, target: string | null): Promise<void>;
  /** Call after Build mode (or a remote change) changed the tool library. Reloads only if scripts or permissions changed. */
  setTool(tool: ToolLibrary): Promise<void>;
  /** Load the scripts again; `force` also retries scripts that were stopped by a limit. */
  reload(options?: { force?: boolean }): Promise<void>;
  readonly log: readonly ConsoleLine[];
  clearLog(): void;
  onLog(listener: () => void): () => void;
  status(id: ScriptId): ScriptStatus;
  onStatus(listener: () => void): () => void;
  dispose(): void;
}

const hasScripts = (tool: ToolLibrary): boolean =>
  Object.values(tool.scripts ?? {}).some((s) => s.enabled !== false);

const fingerprint = (tool: ToolLibrary): string =>
  JSON.stringify([tool.scripts ?? {}, tool.manifest.permissions ?? {}]);

/**
 * Starts the scripts of a tool for an open model. `await` it before showing the model if scripts
 * should be in place for the first change; it resolves at once for a tool without scripts.
 *
 * Wiring: pass `handle.runScript` as the `runScript` of the behaviour host, keep calling
 * `handle.setTool` when the tool changes, and `handle.dispose()` with the behaviour.
 */
export async function attachScripts(
  behaviour: Behaviour,
  options: AttachScriptsOptions,
): Promise<ScriptsHandle> {
  let engine: ScriptEngine | null = null;
  let current = fingerprint(options.tool());
  let disposed = false;
  const logListeners = new Set<() => void>();
  const statusListeners = new Set<() => void>();
  const stops: (() => void)[] = [];

  async function start(): Promise<ScriptEngine> {
    const [{ ScriptEngine: Engine }, wasm] = await Promise.all([
      import('./scripts'),
      options.wasmUrl === undefined && typeof document !== 'undefined'
        ? import('./sandbox/wasm-url')
        : Promise.resolve(null),
    ]);
    const wasmUrl = options.wasmUrl ?? wasm?.wasmUrl;
    const created = new Engine({
      store: options.store,
      bus: behaviour.bus,
      calculator: behaviour.calculator,
      tool: options.tool,
      host: behaviour.host,
      commands: behaviour.commands,
      ...(options.files ? { files: options.files } : {}),
      ...(options.http ? { http: options.http } : {}),
      permissions: () =>
        options.permissions?.granted(options.tool().manifest.id) ??
        NO_PERMISSIONS,
      ...(options.selection ? { selection: options.selection } : {}),
      ...(options.limits ? { limits: options.limits } : {}),
      ...(wasmUrl ? { load: { wasmUrl } } : {}),
    });
    stops.push(
      created.onLog(() => logListeners.forEach((l) => l())),
      created.onStatus(() => statusListeners.forEach((l) => l())),
    );
    return created;
  }

  async function sync(force = false): Promise<void> {
    if (disposed) return;
    if (hasScripts(options.tool())) {
      engine ??= await start();
      await engine.reload(force ? { force } : {});
    } else if (engine) {
      await engine.reload();
    }
  }

  await sync();

  return {
    get engine() {
      return engine;
    },
    async runScript(id, target) {
      if (!engine) engine = await start();
      await engine.runScript(id, target);
    },
    async setTool(tool) {
      const next = fingerprint(tool);
      if (next === current) return;
      current = next;
      await sync();
    },
    reload: (o) => sync(o?.force === true),
    get log() {
      return engine?.log ?? [];
    },
    clearLog: () => engine?.clearLog(),
    onLog(listener) {
      logListeners.add(listener);
      return () => logListeners.delete(listener);
    },
    status: (id) => engine?.status(id) ?? { state: 'running' },
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    dispose() {
      disposed = true;
      for (const s of stops.splice(0)) s();
      engine?.dispose();
      engine = null;
      logListeners.clear();
      statusListeners.clear();
    },
  };
}
