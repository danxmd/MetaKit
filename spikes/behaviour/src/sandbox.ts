import type {
  QuickJSContext,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSWASMModule,
} from 'quickjs-emscripten-core';

/** What the host offers to scripts. The real script API replaces this in phase 7. */
export interface StubApi {
  getAttr(id: string, key: string): unknown;
  setAttr(id: string, key: string, value: unknown): void;
  log(message: string): void;
}

export interface SandboxLimits {
  /** Wall-clock budget for every call into the VM, including loading the script. */
  timeMs: number;
  memoryBytes: number;
  stackBytes: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  timeMs: 200,
  memoryBytes: 16 * 1024 * 1024,
  stackBytes: 256 * 1024,
};

export type SandboxErrorCode =
  'timeout' | 'memory' | 'stack' | 'script' | 'disposed';

export class SandboxError extends Error {
  constructor(
    readonly code: SandboxErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

export interface FireResult {
  cancelled: boolean;
  reason?: string;
  /** Number of handlers that ran. */
  ran: number;
}

// --- lazy loading ---------------------------------------------------------------------

export interface LoadOptions {
  /** URL of the WASM file in a browser. Node finds it by itself. */
  wasmUrl?: string;
}

type VariantCode = typeof import('@jitl/quickjs-wasmfile-release-sync').default;
type Core = typeof import('quickjs-emscripten-core');

let codePromise: Promise<{ core: Core; variant: VariantCode }> | null = null;

/**
 * Loads QuickJS code on first use. Nothing from QuickJS is imported or fetched until this is
 * called, so an app that never runs a script never pays for it.
 */
export function loadQuickJSCode(): Promise<{
  core: Core;
  variant: VariantCode;
}> {
  codePromise ??= Promise.all([
    import('quickjs-emscripten-core'),
    import('@jitl/quickjs-wasmfile-release-sync'),
  ]).then(([core, { default: variant }]) => ({ core, variant }));
  return codePromise;
}

/** The module needs 16 MB (256 pages) before a script allocates anything. */
const BASELINE_PAGES = 256;
const PAGE_BYTES = 65536;

/**
 * One WebAssembly instance per sandbox, with its memory capped. QuickJS's own memory limit
 * does not measure allocation sizes in the WebAssembly builds (see docs/spikes/behaviour.md),
 * so this cap is what actually stops a script that allocates without end.
 */
async function newModule(
  memoryBytes: number,
  options: LoadOptions,
): Promise<QuickJSWASMModule> {
  const { core, variant } = await loadQuickJSCode();
  const memory = new WebAssembly.Memory({
    initial: BASELINE_PAGES,
    maximum: BASELINE_PAGES + Math.ceil(memoryBytes / PAGE_BYTES),
  });
  const resolved = core.newVariant(variant, {
    wasmMemory: memory,
    ...(options.wasmUrl ? { wasmLocation: options.wasmUrl } : {}),
  });
  return core.newQuickJSWASMModuleFromVariant(resolved);
}

/** TypeScript to JavaScript. Sucrase only strips types, so it is fast and does no type checking. */
export async function compileScript(typescript: string): Promise<string> {
  const { transform } = await import('sucrase');
  return transform(typescript, { transforms: ['typescript'] }).code;
}

// --- the prelude that runs inside the VM ----------------------------------------------

const PRELUDE = `
globalThis.__handlers = {};
globalThis.on = (name, fn) => { (__handlers[name] ??= []).push(fn); };
globalThis.cancel = (reason) => ({ cancel: reason === undefined ? true : String(reason) });
globalThis.model = {
  get: (id, key) => JSON.parse(__host_get(String(id), String(key))),
  set: (id, key, value) => { __host_set(String(id), String(key), JSON.stringify(value)); },
};
globalThis.log = (...args) => { __host_log(args.map(String).join(' ')); };
globalThis.__fire = (name, payloadJson) => {
  const payload = JSON.parse(payloadJson);
  const result = { cancelled: false, ran: 0 };
  for (const fn of __handlers[name] ?? []) {
    result.ran += 1;
    const answer = fn(payload);
    if (answer === false || (answer && answer.cancel)) {
      result.cancelled = true;
      result.reason = answer === false || answer.cancel === true ? 'Cancelled by a script' : answer.cancel;
      break;
    }
  }
  return JSON.stringify(result);
};
`;

// --- sandbox --------------------------------------------------------------------------

export class Sandbox {
  private deadline = Infinity;
  private timedOut = false;
  private disposed = false;
  /** Set after a limit error; the VM is freed once the caller's handles are released. */
  private doomed = false;

  private constructor(
    private readonly runtime: QuickJSRuntime,
    private readonly vm: QuickJSContext,
    private readonly limits: SandboxLimits,
  ) {}

  static async create(
    api: StubApi,
    limits: SandboxLimits = DEFAULT_LIMITS,
    load: LoadOptions = {},
  ): Promise<Sandbox> {
    const quickjs = await newModule(limits.memoryBytes, load);
    const runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    const vm = runtime.newContext();
    const sandbox = new Sandbox(runtime, vm, limits);
    // The handler runs inside QuickJS bytecode, so a script cannot starve it.
    runtime.setInterruptHandler(() => {
      if (performance.now() > sandbox.deadline) {
        sandbox.timedOut = true;
        return true;
      }
      return false;
    });
    sandbox.install(api);
    sandbox.exec(PRELUDE, 'prelude.js');
    return sandbox;
  }

  private install(api: StubApi): void {
    const { vm } = this;
    const define = (
      name: string,
      fn: (...args: string[]) => string | undefined,
    ) => {
      const handle = vm.newFunction(name, (...args) => {
        const result = fn(...args.map((a) => vm.getString(a)));
        return result === undefined ? vm.undefined : vm.newString(result);
      });
      vm.setProp(vm.global, name, handle);
      handle.dispose();
    };
    define('__host_get', (id, key) =>
      JSON.stringify(api.getAttr(id!, key!) ?? null),
    );
    define('__host_set', (id, key, json) => {
      api.setAttr(id!, key!, JSON.parse(json!));
      return undefined;
    });
    define('__host_log', (message) => {
      api.log(message!);
      return undefined;
    });
  }

  /** Runs a TypeScript script: compile, then evaluate. The script registers its handlers. */
  async load(typescript: string): Promise<void> {
    let javascript: string;
    try {
      javascript = await compileScript(typescript);
    } catch (error) {
      throw new SandboxError(
        'script',
        error instanceof Error ? error.message : String(error),
      );
    }
    this.exec(javascript, 'script.js');
  }

  /**
   * Synchronous: runs every handler for the event and returns before the host acts. The host
   * applies the action only if `cancelled` is false.
   */
  fire(event: string, payload: unknown): FireResult {
    this.assertAlive();
    const fire = this.vm.getProp(this.vm.global, '__fire');
    const name = this.vm.newString(event);
    const json = this.vm.newString(JSON.stringify(payload ?? null));
    try {
      return JSON.parse(
        this.callGuarded(() =>
          this.vm.callFunction(fire, this.vm.undefined, name, json),
        ),
      ) as FireResult;
    } finally {
      fire.dispose();
      name.dispose();
      json.dispose();
      this.finish();
    }
  }

  /** Evaluates source and returns its value as JSON-compatible data. */
  eval(source: string): unknown {
    return this.exec(source, 'eval.js');
  }

  private exec(source: string, filename: string): unknown {
    this.assertAlive();
    let text: string;
    try {
      text = this.callGuarded(() => this.vm.evalCode(source, filename));
    } finally {
      this.finish();
    }
    try {
      return text === 'undefined' ? undefined : JSON.parse(text);
    } catch {
      return text;
    }
  }

  private callGuarded(
    run: () => ReturnType<QuickJSContext['evalCode']>,
  ): string {
    this.deadline = performance.now() + this.limits.timeMs;
    this.timedOut = false;
    const result = run();
    this.deadline = Infinity;
    if (result.error) {
      const dumped = this.vm.dump(result.error) as
        { name?: string; message?: string } | string;
      result.error.dispose();
      throw this.toError(dumped);
    }
    const value: QuickJSHandle = result.value;
    const text =
      this.vm.typeof(value) === 'string'
        ? this.vm.getString(value)
        : (JSON.stringify(this.vm.dump(value)) ?? 'undefined');
    value.dispose();
    return text;
  }

  private toError(
    dumped: { name?: string; message?: string } | string | null,
  ): SandboxError {
    const message =
      dumped === null
        ? 'null'
        : typeof dumped === 'string'
          ? dumped
          : `${dumped.name ?? 'Error'}: ${dumped.message ?? ''}`;
    // After a limit the VM may be in a bad state, so it is not used again.
    if (this.timedOut) {
      this.doomed = true;
      return new SandboxError(
        'timeout',
        `Script ran longer than ${this.limits.timeMs} ms and was stopped`,
      );
    }
    // An out-of-memory error can arrive as `null` when there was no room to build the Error.
    if (
      /out of memory/i.test(message) ||
      dumped === null ||
      message === 'null'
    ) {
      this.doomed = true;
      return new SandboxError(
        'memory',
        'Script used more memory than allowed and was stopped',
      );
    }
    if (/stack overflow|too much recursion/i.test(message)) {
      return new SandboxError('stack', 'Script recursed too deeply');
    }
    return new SandboxError('script', message);
  }

  private finish(): void {
    if (this.doomed) this.dispose();
  }

  private assertAlive(): void {
    if (this.disposed)
      throw new SandboxError('disposed', 'The sandbox was stopped');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.vm.dispose();
    this.runtime.dispose();
  }
}
