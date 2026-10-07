import type {
  QuickJSContext,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSWASMModule,
} from 'quickjs-emscripten-core';

/**
 * The script sandbox: QuickJS compiled to WebAssembly, promoted from the phase 0 spike
 * (docs/spikes/behaviour.md). One Sandbox is one WebAssembly instance with its own capped memory,
 * one runtime and one context. Only JSON text crosses the boundary.
 */

export interface SandboxLimits {
  /** Time one event handler may run, in milliseconds. */
  handlerMs: number;
  /** Time one command or script run may run (loading a script included), in milliseconds. */
  runMs: number;
  /** What a script may allocate on top of the 16 MB the module needs to start. */
  memoryBytes: number;
  stackBytes: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  handlerMs: 100,
  runMs: 5000,
  memoryBytes: 16 * 1024 * 1024,
  stackBytes: 256 * 1024,
};

export type SandboxErrorCode =
  'timeout' | 'memory' | 'stack' | 'script' | 'disposed';

export class SandboxError extends Error {
  constructor(
    readonly code: SandboxErrorCode,
    message: string,
    /** The line in the script the error came from, when QuickJS says. */
    readonly line?: number,
    /** The file name given to `run`, such as the id of a script. */
    readonly file?: string,
  ) {
    super(message);
    this.name = 'SandboxError';
  }

  /** After these the VM is thrown away: a limit was hit and its state cannot be trusted. */
  get fatal(): boolean {
    return this.code === 'timeout' || this.code === 'memory';
  }
}

/** What the host answers to a call from the script: JSON data, or a promise of it. */
export type HostCall = (op: string, args: unknown[]) => unknown;

export type Budget = 'handler' | 'run';

export interface LoadOptions {
  /** URL of the WebAssembly file in a browser. Node finds it by itself. */
  wasmUrl?: string;
}

type VariantCode = typeof import('@jitl/quickjs-wasmfile-release-sync').default;
type Core = typeof import('quickjs-emscripten-core');

let codePromise: Promise<{ core: Core; variant: VariantCode }> | null = null;

/**
 * Loads QuickJS on first use. Nothing of it is imported or fetched until a tool has a script, so
 * an app that never runs one never pays for it.
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
 * One WebAssembly instance per sandbox, with its memory capped. QuickJS's own memory limit does
 * not measure allocation sizes in the WebAssembly builds (finding 1 of the spike), so this cap is
 * what stops a script that allocates without end; `setMemoryLimit` stays as a second guard.
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

export interface SandboxOptions {
  host: HostCall;
  limits?: Partial<SandboxLimits>;
  load?: LoadOptions;
  /** Trusted code that runs first and defines what scripts see. */
  prelude?: string;
  /** Called when a call that came back from the host (a settled promise) fails. */
  onError?: (error: SandboxError) => void;
  /** Wraps every call that starts from the host side (a settled promise), such as in an undo step. */
  around?: (run: () => void) => void;
}

interface Frame {
  deadline: number;
  timedOut: boolean;
}

interface Dumped {
  name?: string;
  message?: string;
  stack?: string;
}

const LIMIT_TEXT: Record<Budget, (ms: number) => string> = {
  handler: (ms) => `The script took longer than ${ms} ms and was stopped.`,
  run: (ms) =>
    `The script took longer than ${ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`} and was stopped.`,
};

export class Sandbox {
  private readonly frames: Frame[] = [];
  private disposed = false;
  /** Set after a limit error; the VM is freed when the outermost call has released its handles. */
  private doomed = false;

  private constructor(
    private readonly runtime: QuickJSRuntime,
    private readonly vm: QuickJSContext,
    private readonly limits: SandboxLimits,
    private readonly hostCall: HostCall,
    private readonly onError: (error: SandboxError) => void,
    private readonly around: (run: () => void) => void,
  ) {}

  static async create(options: SandboxOptions): Promise<Sandbox> {
    const limits = { ...DEFAULT_LIMITS, ...options.limits };
    const quickjs = await newModule(limits.memoryBytes, options.load ?? {});
    const runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    const vm = runtime.newContext();
    const sandbox = new Sandbox(
      runtime,
      vm,
      limits,
      options.host,
      options.onError ?? (() => undefined),
      options.around ?? ((run) => run()),
    );
    // The handler runs inside QuickJS bytecode, so a script cannot starve it.
    runtime.setInterruptHandler(() => {
      const frame = sandbox.frames.at(-1);
      if (frame && performance.now() > frame.deadline) {
        frame.timedOut = true;
        return true;
      }
      return false;
    });
    sandbox.install();
    if (options.prelude) sandbox.run(options.prelude, 'prelude.js', 'run');
    return sandbox;
  }

  get dead(): boolean {
    return this.disposed || this.doomed;
  }

  private install(): void {
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
    // A host failure comes back as data and the prelude throws it inside the VM, so the host never
    // throws through QuickJS frames.
    define('__host', (op, argsJson) => {
      try {
        const answer = this.hostCall(op!, JSON.parse(argsJson!) as unknown[]);
        if (isThenable(answer))
          throw new Error('That call is not available in this place.');
        return JSON.stringify({ v: answer === undefined ? null : answer });
      } catch (error) {
        return JSON.stringify({ e: messageOf(error) });
      }
    });
    define('__host_async', (op, argsJson, id) => {
      let promise: Promise<unknown>;
      try {
        promise = Promise.resolve(
          this.hostCall(op!, JSON.parse(argsJson!) as unknown[]),
        );
      } catch (error) {
        promise = Promise.reject(error);
      }
      void promise.then(
        (v) => this.settle(id!, { v: v === undefined ? null : v }),
        (e: unknown) => this.settle(id!, { e: messageOf(e) }),
      );
      return undefined;
    });
  }

  /** Hands the answer of an asynchronous host call to the script that waits for it. */
  private settle(id: string, answer: unknown): void {
    if (this.dead) return;
    try {
      this.around(() => {
        this.call('__settle', [id, answer], 'run');
      });
    } catch (error) {
      if (error instanceof SandboxError) this.onError(error);
      else throw error;
    }
  }

  /** Evaluates source (compiled JavaScript) and returns its value as JSON data. */
  run(source: string, filename: string, budget: Budget = 'run'): unknown {
    return this.enter(budget, filename, () =>
      this.dumpResult(this.vm.evalCode(source, filename)),
    );
  }

  /**
   * Calls a function that the prelude defined on the global object. The arguments go in as JSON
   * text and the result comes back as JSON data. Synchronous: a "before" handler is answered
   * before the host acts.
   */
  call(name: string, args: unknown[], budget: Budget = 'handler'): unknown {
    return this.enter(budget, name, () => {
      const fn = this.vm.getProp(this.vm.global, name);
      const handles = args.map((a) => this.vm.newString(JSON.stringify(a)));
      try {
        return this.dumpResult(
          this.vm.callFunction(fn, this.vm.undefined, ...handles),
        );
      } finally {
        fn.dispose();
        for (const h of handles) h.dispose();
      }
    });
  }

  private enter<T>(budget: Budget, file: string, body: () => T): T {
    if (this.dead)
      throw new SandboxError('disposed', 'The sandbox was stopped.');
    const ms = budget === 'handler' ? this.limits.handlerMs : this.limits.runMs;
    // A call made while another is running (a script changes the model, which fires an event, which
    // runs another handler) never gets more time than what is left of the outer one.
    const parent = this.frames.at(-1);
    const frame: Frame = {
      deadline: Math.min(parent?.deadline ?? Infinity, performance.now() + ms),
      timedOut: false,
    };
    this.frames.push(frame);
    try {
      const value = body();
      if (this.frames.length === 1) this.drainJobs(frame);
      return value;
    } catch (error) {
      throw error instanceof SandboxError
        ? error
        : this.toError(error, frame, budget, file);
    } finally {
      this.frames.pop();
      if (this.frames.length === 0 && this.doomed) this.dispose();
    }
  }

  /** Runs the promise callbacks the script queued, such as what follows an `await`. */
  private drainJobs(frame: Frame): void {
    const result = this.runtime.executePendingJobs();
    if ('error' in result && result.error) {
      const dumped = this.vm.dump(result.error) as Dumped | string | null;
      result.error.dispose();
      throw this.mapError(dumped, frame, 'run', 'promise');
    }
  }

  private dumpResult(result: ReturnType<QuickJSContext['evalCode']>): unknown {
    if (result.error) {
      const dumped = this.vm.dump(result.error) as Dumped | string | null;
      result.error.dispose();
      // Mapped by the caller's frame in `enter`; carried as a plain throw.
      throw new RawError(dumped);
    }
    const value: QuickJSHandle = result.value;
    try {
      if (this.vm.typeof(value) !== 'string') return this.vm.dump(value);
      // Entry functions answer with JSON text; any other string is returned as it is.
      const text = this.vm.getString(value);
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    } finally {
      value.dispose();
    }
  }

  private toError(
    error: unknown,
    frame: Frame,
    budget: Budget,
    file: string,
  ): SandboxError {
    if (error instanceof RawError)
      return this.mapError(error.dumped, frame, budget, file);
    return new SandboxError('script', messageOf(error));
  }

  private mapError(
    dumped: Dumped | string | null,
    frame: Frame,
    budget: Budget,
    file: string,
  ): SandboxError {
    if (frame.timedOut) {
      this.doomed = true;
      const ms =
        budget === 'handler' ? this.limits.handlerMs : this.limits.runMs;
      return new SandboxError(
        'timeout',
        LIMIT_TEXT[budget](ms),
        undefined,
        file,
      );
    }
    const message =
      dumped === null
        ? 'null'
        : typeof dumped === 'string'
          ? dumped
          : `${dumped.name ?? 'Error'}: ${dumped.message ?? ''}`;
    // An out-of-memory error can arrive as `null` when there was no room to build the Error.
    if (/out of memory/i.test(message) || dumped === null) {
      this.doomed = true;
      return new SandboxError(
        'memory',
        'The script used more memory than it is allowed and was stopped.',
        undefined,
        file,
      );
    }
    if (/stack overflow|too much recursion/i.test(message))
      return new SandboxError(
        'stack',
        'The script called itself too many times and was stopped.',
        lineOf(dumped),
        file,
      );
    const plain =
      typeof dumped === 'string' ? dumped : (dumped.message ?? message);
    const name =
      typeof dumped === 'string' ? 'Error' : (dumped.name ?? 'Error');
    return new SandboxError(
      'script',
      name === 'Error' ? plain : `${name}: ${plain}`,
      lineOf(dumped),
      file,
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.vm.dispose();
    this.runtime.dispose();
  }
}

class RawError extends Error {
  constructor(readonly dumped: Dumped | string | null) {
    super('script error');
  }
}

/** The first line number QuickJS names in a stack trace: `at f (scr_a.js:12)`. */
function lineOf(dumped: Dumped | string): number | undefined {
  if (typeof dumped === 'string') return undefined;
  const found = /\.js:(\d+)/.exec(dumped.stack ?? '');
  return found ? Number(found[1]) : undefined;
}

function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
