import {
  CANCELLABLE_EVENTS,
  type BatchCommand,
  type ModelCommand,
  EVENT_NAMES,
  type CommandPlace,
  type EventBus,
  type EventPayload,
  type ModelCalculator,
  type ModelStore,
  type Script,
  type ScriptId,
  type ToolLibrary,
} from '@metakit-app/core';
import type { CommandRegistry } from './commands';
import type { BehaviourHost } from './host';
import { NO_PERMISSIONS, type PermissionGrant } from './permissions';
import { PRELUDE } from './script-prelude';
import { createOps } from './script-ops';
import type { ScriptFiles, ScriptHttp } from './script-services';
import { compileScript, type ScriptDiagnostic } from './sandbox/compile';
import {
  Sandbox,
  SandboxError,
  type LoadOptions,
  type SandboxLimits,
} from './sandbox/sandbox';

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error';

/** One line of the script console. */
export interface ConsoleLine {
  /** Counts up for the life of the engine, so a view can tell new lines from old ones. */
  id: number;
  /** Milliseconds since 1970. */
  time: number;
  level: ConsoleLevel;
  scriptId?: ScriptId;
  scriptName?: string;
  /** The line of the script an error came from. */
  line?: number;
  text: string;
}

export const MAX_CONSOLE_LINES = 500;

/**
 * `running`: loaded and listening. `disabled`: switched off. `error`: it does not compile or its
 * top level failed. `stopped`: it hit a time or memory limit and stays off until its source changes
 * or it is run again by hand.
 */
export type ScriptState = 'running' | 'disabled' | 'error' | 'stopped';

export interface ScriptStatus {
  state: ScriptState;
  error?: string;
  line?: number;
}

export interface ScriptEngineOptions {
  store: ModelStore;
  bus: EventBus;
  calculator: ModelCalculator;
  /** The tool library as it is now; read again on every use. */
  tool: () => ToolLibrary;
  host: BehaviourHost;
  commands: CommandRegistry;
  files?: ScriptFiles;
  http?: ScriptHttp;
  /** What this browser allowed for the tool (see `PermissionStore.granted`). */
  permissions?: PermissionGrant | (() => PermissionGrant);
  /** The ids of the selected objects, for `model.selection()`. */
  selection?: () => string[];
  limits?: Partial<SandboxLimits>;
  load?: LoadOptions;
  now?: () => number;
}

interface Registration {
  index: number;
  scriptId: ScriptId;
  commandId?: string;
}

/** A run that waits for a script to finish, however long its awaits take, within this. */
const RUN_WALL_CLOCK_MS = 60_000;
const MAX_RELOAD_ATTEMPTS = 5;

/** Undo steps from scripts are labelled like any batch. */
const STEP: BatchCommand<ModelCommand> = { type: 'batch', commands: [] };

/**
 * Runs the scripts of a tool library for one open model. All scripts of the tool share one sandbox
 * (one WebAssembly instance), loaded only when there is a script to run. Scripts listen on the
 * event bus, which only sees changes made here, and change the model through the command API, so
 * what an event handler does undoes together with the action that triggered it.
 */
export class ScriptEngine {
  private sandbox: Sandbox | null = null;
  private generation = 0;
  private disposed = false;
  private reloading: Promise<void> | null = null;
  private restarting = false;
  private readonly registrations = new Map<number, Registration>();
  private readonly unsubscribers: (() => void)[] = [];
  private readonly lines: ConsoleLine[] = [];
  private lineId = 0;
  private readonly statuses = new Map<ScriptId, ScriptStatus>();
  /** Scripts stopped by a limit, with the source that did it. */
  private readonly faulted = new Map<ScriptId, string>();
  private readonly active: ScriptId[] = [];
  private loading: ScriptId | null = null;
  private loadError: { message: string; line?: number } | null = null;
  private readonly runs = new Map<number, (error: string | null) => void>();
  private runCounter = 0;
  private lastToast = { text: '', at: 0 };
  private readonly logListeners = new Set<() => void>();
  private readonly statusListeners = new Set<() => void>();
  private readonly now: () => number;

  constructor(private readonly options: ScriptEngineOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  // -- the console ----------------------------------------------------------------------------

  /** The console lines, oldest first, at most `MAX_CONSOLE_LINES`. */
  get log(): readonly ConsoleLine[] {
    return this.lines;
  }

  clearLog(): void {
    this.lines.length = 0;
    this.changedLog();
  }

  onLog(listener: () => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  status(id: ScriptId): ScriptStatus {
    const known = this.statuses.get(id);
    if (known) return known;
    return this.options.tool().scripts?.[id]?.enabled === false
      ? { state: 'disabled' }
      : { state: 'running' };
  }

  private changedLog(): void {
    for (const l of [...this.logListeners]) l();
  }

  private changedStatus(): void {
    for (const l of [...this.statusListeners]) l();
  }

  private addLine(
    level: ConsoleLevel,
    text: string,
    scriptId?: ScriptId,
    line?: number,
  ): void {
    const script = scriptId
      ? this.options.tool().scripts?.[scriptId]
      : undefined;
    this.lines.push({
      id: ++this.lineId,
      time: this.now(),
      level,
      ...(scriptId ? { scriptId } : {}),
      ...(script ? { scriptName: script.name } : {}),
      ...(line !== undefined ? { line } : {}),
      text,
    });
    if (this.lines.length > MAX_CONSOLE_LINES)
      this.lines.splice(0, this.lines.length - MAX_CONSOLE_LINES);
    this.changedLog();
  }

  /** An error: into the console, and as a message to the person unless the same one just showed. */
  private reportError(
    message: string,
    scriptId: ScriptId | undefined,
    line?: number,
  ): void {
    this.addLine('error', message, scriptId, line);
    const name = scriptId
      ? this.options.tool().scripts?.[scriptId]?.name
      : undefined;
    const text = name ? `${name}: ${message}` : message;
    const at = this.now();
    if (text === this.lastToast.text && at - this.lastToast.at < 2000) return;
    this.lastToast = { text, at };
    this.options.host.message('error', text);
  }

  private setStatus(id: ScriptId, status: ScriptStatus): void {
    this.statuses.set(id, status);
    this.changedStatus();
  }

  // -- permissions ----------------------------------------------------------------------------

  private grant(): PermissionGrant {
    const p = this.options.permissions;
    return (typeof p === 'function' ? p() : p) ?? NO_PERMISSIONS;
  }

  private requirePermission(kind: 'files' | 'network'): void {
    const what = kind === 'files' ? 'use files' : 'contact web services';
    const declared = this.options.tool().manifest.permissions?.[kind] === true;
    if (!declared)
      throw new Error(
        `This script tries to ${what}, but the tool does not say it needs to. Add the "${kind}" permission to the tool in Build mode.`,
      );
    if (!this.grant()[kind])
      throw new Error(
        `This script tries to ${what}, but you have not allowed that for this tool in this browser. Open the tool's permissions and allow it.`,
      );
  }

  // -- loading ----------------------------------------------------------------------------------

  /** Resolves when the scripts are loaded (or when loading failed, which is in the console). */
  ready(): Promise<void> {
    return this.reloading ?? Promise.resolve();
  }

  /**
   * Compiles every enabled script and runs its top level in a fresh sandbox, which collects the
   * handlers and commands. Scripts that were stopped by a limit stay off while their source is
   * unchanged, unless `force` is set.
   */
  reload(options: { force?: boolean } = {}): Promise<void> {
    const run = async () => {
      try {
        await this.loadAll(options.force === true);
      } finally {
        this.reloading = null;
      }
    };
    const previous = this.reloading ?? Promise.resolve();
    this.generation++;
    const next = previous.then(run, run);
    this.reloading = next;
    return next;
  }

  private teardown(): void {
    for (const u of this.unsubscribers.splice(0)) u();
    this.options.commands.clear('script');
    this.registrations.clear();
    this.sandbox?.dispose();
    this.sandbox = null;
  }

  private async loadAll(force: boolean): Promise<void> {
    const generation = this.generation;
    if (force) this.faulted.clear();
    for (let attempt = 0; attempt < MAX_RELOAD_ATTEMPTS; attempt++) {
      this.teardown();
      if (this.disposed || generation !== this.generation) return;
      const tool = this.options.tool();
      const scripts = Object.values(tool.scripts ?? {}).sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1,
      );
      this.statuses.clear();
      const todo: { script: Script; js: string }[] = [];
      for (const script of scripts) {
        if (script.enabled === false) {
          this.statuses.set(script.id, { state: 'disabled' });
          continue;
        }
        if (this.faulted.get(script.id) === script.source) {
          this.statuses.set(script.id, {
            state: 'stopped',
            error:
              'This script was stopped because it used too much time or memory. Change it, or run it again by hand.',
          });
          continue;
        }
        this.faulted.delete(script.id);
        const compiled = await compileScript(script.source);
        if ('errors' in compiled) {
          this.compileFailed(script, compiled.errors);
          continue;
        }
        todo.push({ script, js: compiled.js });
      }
      this.changedStatus();
      if (todo.length === 0) return;

      let sandbox: Sandbox;
      try {
        sandbox = await this.newSandbox(false);
      } catch (error) {
        this.reportError(
          `The scripts could not start: ${error instanceof Error ? error.message : String(error)}`,
          undefined,
        );
        return;
      }
      if (this.disposed || generation !== this.generation) {
        sandbox.dispose();
        return;
      }
      this.sandbox = sandbox;
      let restart = false;
      for (const { script, js } of todo) {
        try {
          this.loading = script.id;
          this.active.push(script.id);
          this.loadError = null;
          sandbox.run(wrap(script.id, js, false), `${script.id}.js`, 'run');
          const failed = this.loadError as {
            message: string;
            line?: number;
          } | null;
          if (failed) {
            this.dropRegistrations(script.id);
            this.statuses.set(script.id, { state: 'error', ...failed });
          } else this.statuses.set(script.id, { state: 'running' });
        } catch (error) {
          this.dropRegistrations(script.id);
          const e = this.explain(error, script.id);
          this.statuses.set(script.id, {
            state: e.fatal ? 'stopped' : 'error',
            error: e.message,
            ...(e.line !== undefined ? { line: e.line } : {}),
          });
          if (e.fatal) {
            this.faulted.set(script.id, script.source);
            restart = true;
          }
        } finally {
          this.active.pop();
          this.loading = null;
        }
        if (restart) break;
        if (generation !== this.generation) return;
      }
      this.changedStatus();
      // A limit hit while loading throws the whole sandbox away; the other scripts load again
      // into a new one, without the one that did it.
      if (!restart) return;
    }
  }

  private compileFailed(script: Script, errors: ScriptDiagnostic[]): void {
    const first = errors[0]!;
    this.setStatus(script.id, {
      state: 'error',
      error: first.message,
      line: first.line,
    });
    for (const e of errors)
      this.addLine(
        'error',
        `${e.message} (line ${e.line}, column ${e.column})`,
        script.id,
        e.line,
      );
  }

  private async newSandbox(oneShot: boolean): Promise<Sandbox> {
    const { store } = this.options;
    const sandbox = await Sandbox.create({
      host: createOps(this.context(oneShot)),
      limits: this.options.limits ?? {},
      load: this.options.load ?? {},
      prelude: PRELUDE,
      onError: (e) => this.explain(e, this.active.at(-1)),
      // What a script does after waiting for something is its own undo step.
      around: (run) => void store.transact(STEP, run),
    });
    if (oneShot) sandbox.run('__setOneShot()', 'setup.js', 'run');
    return sandbox;
  }

  /** Turns anything a script run threw into a console line and a message; says what it was. */
  private explain(
    error: unknown,
    scriptId: ScriptId | undefined,
  ): { message: string; line?: number; fatal: boolean } {
    if (error instanceof SandboxError) {
      if (error.code !== 'disposed')
        this.reportError(error.message, scriptId, error.line);
      if (error.fatal || this.sandbox?.dead) this.scheduleRestart();
      return {
        message: error.message,
        ...(error.line !== undefined ? { line: error.line } : {}),
        fatal: error.fatal,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    this.reportError(message, scriptId);
    return { message, fatal: false };
  }

  /** After a limit error: load the scripts into a new sandbox, leaving out the one that did it. */
  private scheduleRestart(): void {
    if (this.restarting || this.disposed) return;
    this.restarting = true;
    queueMicrotask(() => {
      this.restarting = false;
      if (this.sandbox?.dead && !this.disposed && this.loading === null)
        void this.reload();
    });
  }

  private dropRegistrations(scriptId: ScriptId): void {
    for (const [index, reg] of this.registrations)
      if (reg.scriptId === scriptId) this.registrations.delete(index);
  }

  // -- what the sandbox may ask of the engine -----------------------------------------------------

  private context(oneShot: boolean): Parameters<typeof createOps>[0] {
    const o = this.options;
    return {
      store: o.store,
      calculator: o.calculator,
      tool: o.tool,
      host: o.host,
      selection: o.selection ?? (() => []),
      files: o.files,
      http: o.http,
      require: (kind) => this.requirePermission(kind),
      log: (level, text, scriptId) =>
        this.addLine(
          level,
          text,
          (scriptId as ScriptId | null) ?? this.active.at(-1),
        ),
      scriptError: (message, stack, scriptId) => {
        const id = (scriptId as ScriptId | null) ?? this.active.at(-1);
        const line = lineOfStack(stack);
        // An error in the top level of a script that is being loaded fails the load.
        if (id !== undefined && id === this.loading && !this.loadError)
          this.loadError = { message, ...(line !== undefined ? { line } : {}) };
        this.reportError(message, id, line);
      },
      onRegister: (event, filter, index) => {
        if (oneShot) return;
        this.registerEvent(event, filter, index);
      },
      onCommand: (spec, index) => {
        if (oneShot) return;
        this.registerCommand(spec, index);
      },
      runDone: (runId, error) => {
        this.runs.get(runId)?.(error);
        this.runs.delete(runId);
      },
    };
  }

  private registerEvent(
    event: string,
    filter: Record<string, string>,
    index: number,
  ): void {
    const scriptId = this.loading;
    if (!scriptId)
      throw new Error('on() can only be used at the top level of a script.');
    const valid =
      (EVENT_NAMES as readonly string[]).includes(event) ||
      event === '*' ||
      /^(app|model|object|connector|attribute|table|view|selection)\.\*$/.test(
        event,
      );
    if (!valid)
      throw new Error(
        `"${event}" is not an event. The events are: ${EVENT_NAMES.join(', ')}.`,
      );
    const registration: Registration = { index, scriptId };
    this.registrations.set(index, registration);
    this.unsubscribers.push(
      this.options.bus.on(
        event,
        (payload) => this.dispatch(registration, payload),
        filter,
      ),
    );
  }

  private registerCommand(
    spec: { id: string; label: string; place: CommandPlace },
    index: number,
  ): void {
    const scriptId = this.loading;
    if (!scriptId)
      throw new Error(
        'commands.register() can only be used at the top level of a script.',
      );
    const registration: Registration = {
      index,
      scriptId,
      commandId: spec.id,
    };
    this.registrations.set(index, registration);
    this.unsubscribers.push(
      this.options.commands.register({
        id: `script:${spec.id}`,
        label: spec.label,
        place: spec.place,
        source: 'script',
        run: (target) => void this.runRegistered(registration, target),
      }),
    );
  }

  // -- events ----------------------------------------------------------------------------------------

  private dispatch(
    registration: Registration,
    payload: EventPayload,
  ): void | { cancel: string } {
    const sandbox = this.sandbox;
    if (!sandbox || sandbox.dead) return undefined;
    const cancellable = (CANCELLABLE_EVENTS as readonly string[]).includes(
      payload.event,
    );
    this.active.push(registration.scriptId);
    try {
      const answer = sandbox.call(
        '__fire',
        [registration.index, this.payloadFor(payload)],
        'handler',
      ) as { cancel?: string } | null;
      if (sandbox.dead) this.scheduleRestart();
      // An error in a handler is reported and does not cancel the action: a broken script must
      // not lock people out of their model.
      return cancellable && answer?.cancel !== undefined
        ? { cancel: answer.cancel }
        : undefined;
    } catch (error) {
      this.faultOnLimit(error, registration.scriptId);
      return undefined;
    } finally {
      this.active.pop();
    }
  }

  private faultOnLimit(error: unknown, scriptId: ScriptId): void {
    const e = this.explain(error, scriptId);
    if (e.fatal) {
      const source = this.options.tool().scripts?.[scriptId]?.source;
      if (source !== undefined) this.faulted.set(scriptId, source);
      this.setStatus(scriptId, { state: 'stopped', error: e.message });
    }
  }

  /** Class and relation ids become the keys scripts know; the rest is as the bus gave it. */
  private payloadFor(payload: EventPayload): unknown {
    const tool = this.options.tool();
    return {
      ...payload,
      ...(payload.class
        ? { class: tool.classes[payload.class]?.key ?? payload.class }
        : {}),
      ...(payload.relation
        ? {
            relation: tool.relations[payload.relation]?.key ?? payload.relation,
          }
        : {}),
    };
  }

  // -- running -------------------------------------------------------------------------------------------

  /**
   * Runs a script by hand, as the "Run" button, a rule action or an action attribute does: the
   * first command the script registers, on the target if there is one. A script without commands
   * runs its top level once, in a sandbox of its own, with no handlers or commands kept.
   */
  async runScript(
    id: ScriptId | string,
    target: string | null = null,
  ): Promise<void> {
    await this.ready();
    const script = this.options.tool().scripts?.[id as ScriptId];
    if (!script) {
      this.reportError(`The script ${id} does not exist.`, undefined);
      return;
    }
    // Running by hand gives a stopped script another go with the current source.
    if (this.faulted.has(script.id)) {
      this.faulted.delete(script.id);
      await this.reload();
    } else if (
      script.enabled !== false &&
      (!this.sandbox || this.sandbox.dead)
    ) {
      await this.reload();
    }
    const registration = [...this.registrations.values()].find(
      (r) => r.scriptId === script.id && r.commandId !== undefined,
    );
    if (registration) return this.runRegistered(registration, target);
    return this.runOnce(script);
  }

  private async runRegistered(
    registration: Registration,
    target: string | null,
  ): Promise<void> {
    const sandbox = this.sandbox;
    if (!sandbox || sandbox.dead) {
      this.reportError(
        'The scripts are not running. Try again in a moment.',
        registration.scriptId,
      );
      return;
    }
    const runId = ++this.runCounter;
    const finished = new Promise<string | null>((resolve) =>
      this.runs.set(runId, resolve),
    );
    this.active.push(registration.scriptId);
    try {
      this.options.store.transact(STEP, () =>
        sandbox.call('__run', [registration.index, target, runId], 'run'),
      );
    } catch (error) {
      this.runs.delete(runId);
      this.faultOnLimit(error, registration.scriptId);
      return;
    } finally {
      this.active.pop();
    }
    await this.within(finished, runId, registration.scriptId);
  }

  private async runOnce(script: Script): Promise<void> {
    const compiled = await compileScript(script.source);
    if ('errors' in compiled) {
      this.compileFailed(script, compiled.errors);
      this.options.host.message(
        'error',
        `${script.name}: ${compiled.errors[0]!.message} (line ${compiled.errors[0]!.line})`,
      );
      return;
    }
    let sandbox: Sandbox;
    try {
      sandbox = await this.newSandbox(true);
    } catch (error) {
      this.reportError(
        `The script could not start: ${error instanceof Error ? error.message : String(error)}`,
        script.id,
      );
      return;
    }
    const runId = ++this.runCounter;
    const finished = new Promise<string | null>((resolve) =>
      this.runs.set(runId, resolve),
    );
    this.active.push(script.id);
    try {
      this.options.store.transact(STEP, () =>
        sandbox.run(
          wrap(script.id, compiled.js, true, runId),
          `${script.id}.js`,
          'run',
        ),
      );
    } catch (error) {
      this.runs.delete(runId);
      this.explain(error, script.id);
      sandbox.dispose();
      return;
    } finally {
      this.active.pop();
    }
    try {
      await this.within(finished, runId, script.id);
    } finally {
      sandbox.dispose();
    }
  }

  /** Waits for a run to finish, but not forever. */
  private async within(
    finished: Promise<string | null>,
    runId: number,
    scriptId: ScriptId,
  ): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'late'>((resolve) => {
      timer = setTimeout(() => resolve('late'), RUN_WALL_CLOCK_MS);
    });
    const outcome = await Promise.race([finished, timeout]);
    clearTimeout(timer);
    if (outcome === 'late') {
      this.runs.delete(runId);
      this.reportError(
        `The script did not finish within ${RUN_WALL_CLOCK_MS / 1000} seconds. It may still be waiting for a file or a web service.`,
        scriptId,
      );
    }
  }

  // -- the end ---------------------------------------------------------------------------------------------

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.teardown();
    for (const resolve of this.runs.values()) resolve(null);
    this.runs.clear();
    this.logListeners.clear();
    this.statusListeners.clear();
  }
}

/** The script's code as one call, with its first line on the first line so that line numbers hold. */
function wrap(id: ScriptId, js: string, once: boolean, runId = 0): string {
  const fn = `async function (exports, require) {${js}\n}`;
  return once
    ? `__runOnce(${JSON.stringify(id)}, ${fn}, ${runId})`
    : `__loadScript(${JSON.stringify(id)}, ${fn})`;
}

function lineOfStack(stack: string): number | undefined {
  const found = /\.js:(\d+)/.exec(stack);
  return found ? Number(found[1]) : undefined;
}
