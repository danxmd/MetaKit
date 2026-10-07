import { freezeCopy, type Json } from '../json';
import {
  applyPatchesChecked,
  CommandError,
  revertPatchesChecked,
  Tx,
  type Patch,
} from './tx';

export interface BaseCommand {
  type: string;
}

export interface BatchCommand<C extends BaseCommand> {
  type: 'batch';
  commands: C[];
}

/** What differs between a model and a tool library: the commands and how they change state. */
export interface DocumentKind<S, C extends BaseCommand, Ctx> {
  /** Applies one command (never a batch) through `tx` and returns what the caller may want back, such as a new id. */
  apply(tx: Tx<S>, command: C, context: Ctx): unknown;
}

export type ExecuteResult =
  | { ok: true; value: unknown; patches: readonly Patch[] }
  | { ok: false; cancelled: true; reason: string };

export interface ChangeEvent<S, C extends BaseCommand> {
  state: S;
  previous: S;
  patches: readonly Patch[];
  /** `remote` is a change read from another instance: not an undo step, no rules run. */
  origin: 'execute' | 'undo' | 'redo' | 'remote';
  /** For undo and redo: writes left out because someone else changed them since. */
  skipped?: number;
  user: string;
  command?: C;
}

export interface BeforeEvent<S, C extends BaseCommand> {
  command: C;
  state: S;
  user: string;
}

export interface AfterEvent<S, C extends BaseCommand> {
  command: C;
  patches: readonly Patch[];
  state: S;
  user: string;
}

export type BeforeHandler<S, C extends BaseCommand> = (
  event: BeforeEvent<S, C>,
) => void | { cancel: string };
export type AfterHandler<S, C extends BaseCommand> = (
  event: AfterEvent<S, C>,
) => void;

interface Step<C> {
  command: C;
  patches: Patch[];
}

interface Stacks<C> {
  undo: Step<C>[];
  redo: Step<C>[];
}

export interface StoreOptions<S, C extends BaseCommand, Ctx> {
  kind: DocumentKind<S, C, Ctx>;
  initial: S;
  context: Ctx;
  /** The local user; steps are tagged with it unless `execute` says otherwise. */
  user?: string;
  /** Steps kept per user. Older ones are dropped. */
  historyLimit?: number;
}

/** After-handlers may run commands which may trigger more after-handlers; this is how deep that may go. */
export const MAX_NESTING = 8;

/**
 * The one place state changes. Tool libraries and models both live in a store: commands go in,
 * recorded patches come out, and undo and redo replay those patches exactly.
 */
export class DocumentStore<S, C extends BaseCommand, Ctx = undefined> {
  private current: S;
  private readonly kind: DocumentKind<S, C, Ctx>;
  private readonly context: Ctx;
  private readonly defaultUser: string;
  private readonly historyLimit: number;
  private readonly stacks = new Map<string, Stacks<C>>();
  private readonly listeners = new Set<(event: ChangeEvent<S, C>) => void>();
  private readonly beforeHandlers = new Map<string, Set<BeforeHandler<S, C>>>();
  private readonly afterHandlers = new Map<string, Set<AfterHandler<S, C>>>();
  private active: { tx: Tx<S>; user: string; depth: number } | null = null;
  private inBefore = false;

  constructor(options: StoreOptions<S, C, Ctx>) {
    this.kind = options.kind;
    this.context = options.context;
    this.current = freezeCopy(
      options.initial as unknown as Json,
    ) as unknown as S;
    this.defaultUser = options.user ?? 'local';
    this.historyLimit = options.historyLimit ?? 500;
  }

  /** The current state. It is frozen: assigning to it throws. */
  /**
   * Changes what commands are checked against, for example the tool library of a model after the
   * tool was edited. The state and the undo history are left as they are.
   */
  updateContext(patch: Partial<Ctx>): void {
    Object.assign(this.context as object, patch);
  }

  get state(): S {
    return this.current;
  }

  /**
   * The state including the writes of the command in progress. An after handler or a script that
   * runs inside a step reads this, because `state` only changes when the whole step is done.
   */
  get working(): S {
    return this.active ? this.active.tx.state : this.current;
  }

  /**
   * Runs `fn`, which may call `execute` any number of times, as one undo step labelled `label`
   * (its type shows in the history). If `fn` throws nothing is kept. Inside a step already in
   * progress the commands simply join it, so a script started by an event undoes together with
   * the action that triggered it.
   */
  transact<T>(
    label: C | BatchCommand<C>,
    fn: () => T,
    options: { user?: string } = {},
  ): { ok: true; value: T } {
    if (this.inBefore)
      throw new CommandError(
        'A before handler cannot run commands; it can only cancel.',
      );
    if (this.active) return { ok: true, value: fn() };
    const user = options.user ?? this.defaultUser;
    const tx = new Tx(this.current);
    this.active = { tx, user, depth: 0 };
    let value: T;
    try {
      value = fn();
    } finally {
      this.active = null;
    }
    this.commit(tx, label as C, user);
    return { ok: true, value };
  }

  private commit(tx: Tx<S>, command: C, user: string): void {
    if (tx.patches.length === 0) return;
    const previous = this.current;
    this.current = tx.state;
    const stacks = this.stacksFor(user);
    stacks.undo.push({ command, patches: tx.patches });
    if (stacks.undo.length > this.historyLimit) stacks.undo.shift();
    stacks.redo.length = 0;
    this.notify({
      state: this.current,
      previous,
      patches: tx.patches,
      origin: 'execute',
      user,
      command,
    });
  }

  subscribe(listener: (event: ChangeEvent<S, C>) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** `type` is a command type, or `'*'` for all. The handler may return `{ cancel: reason }`. */
  before(type: C['type'] | '*', handler: BeforeHandler<S, C>): () => void {
    return this.register(this.beforeHandlers, type, handler);
  }

  after(type: C['type'] | '*', handler: AfterHandler<S, C>): () => void {
    return this.register(this.afterHandlers, type, handler);
  }

  private register<H>(
    table: Map<string, Set<H>>,
    type: string,
    handler: H,
  ): () => void {
    const set = table.get(type) ?? new Set<H>();
    set.add(handler);
    table.set(type, set);
    return () => void set.delete(handler);
  }

  private handlersFor<H>(table: Map<string, Set<H>>, type: string): H[] {
    return [...(table.get(type) ?? []), ...(table.get('*') ?? [])];
  }

  /**
   * Runs a command. Returns `{ ok: false, cancelled: true, reason }` if a before handler cancels;
   * throws `CommandError` if the command is invalid. Either way nothing has changed.
   */
  execute(
    command: C | BatchCommand<C>,
    options: { user?: string } = {},
  ): ExecuteResult {
    if (this.inBefore)
      throw new CommandError(
        'A before handler cannot run commands; it can only cancel.',
      );
    if (this.active) {
      // Called from an after handler: the command joins the step in progress.
      if (this.active.depth >= MAX_NESTING) {
        throw new CommandError(
          `Commands triggered each other more than ${MAX_NESTING} levels deep, so the step was undone. Check the rules for a loop.`,
        );
      }
      this.active.depth += 1;
      try {
        const outcome = this.run(this.active.tx, command, this.active.user);
        if (outcome.cancelled)
          return { ok: false, cancelled: true, reason: outcome.reason };
        return { ok: true, value: outcome.value, patches: [] };
      } finally {
        this.active.depth -= 1;
      }
    }

    const user = options.user ?? this.defaultUser;
    const tx = new Tx(this.current);
    this.active = { tx, user, depth: 0 };
    let outcome: Outcome;
    try {
      outcome = this.run(tx, command, user);
    } finally {
      this.active = null;
    }
    if (outcome.cancelled)
      return { ok: false, cancelled: true, reason: outcome.reason };
    if (tx.patches.length === 0)
      return { ok: true, value: outcome.value, patches: [] };
    this.commit(tx, command as C, user);
    return { ok: true, value: outcome.value, patches: tx.patches };
  }

  private run(tx: Tx<S>, command: C | BatchCommand<C>, user: string): Outcome {
    if (command.type === 'batch') {
      const batch = command as BatchCommand<C>;
      const cancelled = this.fireBefore(tx, batch as unknown as C, user);
      if (cancelled) return { cancelled: true, reason: cancelled };
      const start = tx.patches.length;
      const values: unknown[] = [];
      for (const inner of batch.commands) {
        const outcome = this.run(tx, inner, user);
        if (outcome.cancelled) return outcome;
        values.push(outcome.value);
      }
      this.fireAfter(tx, batch as unknown as C, start, user);
      return { cancelled: false, value: values };
    }
    const leaf = command as C;
    const cancelled = this.fireBefore(tx, leaf, user);
    if (cancelled) return { cancelled: true, reason: cancelled };
    const start = tx.patches.length;
    const value = this.kind.apply(tx, leaf, this.context);
    this.fireAfter(tx, leaf, start, user);
    return { cancelled: false, value };
  }

  private fireBefore(tx: Tx<S>, command: C, user: string): string | null {
    this.inBefore = true;
    try {
      for (const handler of this.handlersFor(
        this.beforeHandlers,
        command.type,
      )) {
        const answer = handler({ command, state: tx.state, user });
        if (answer && typeof answer === 'object' && 'cancel' in answer)
          return answer.cancel;
      }
    } finally {
      this.inBefore = false;
    }
    return null;
  }

  private fireAfter(
    tx: Tx<S>,
    command: C,
    patchStart: number,
    user: string,
  ): void {
    for (const handler of this.handlersFor(this.afterHandlers, command.type)) {
      handler({
        command,
        patches: tx.patches.slice(patchStart),
        state: tx.state,
        user,
      });
    }
  }

  private stacksFor(user: string): Stacks<C> {
    let stacks = this.stacks.get(user);
    if (!stacks) {
      stacks = { undo: [], redo: [] };
      this.stacks.set(user, stacks);
    }
    return stacks;
  }

  canUndo(user: string = this.defaultUser): boolean {
    return (this.stacks.get(user)?.undo.length ?? 0) > 0;
  }

  canRedo(user: string = this.defaultUser): boolean {
    return (this.stacks.get(user)?.redo.length ?? 0) > 0;
  }

  /**
   * Reverts the user's latest step, a whole batch at once, except for writes that someone else
   * changed since (those are left alone and counted in the event's `skipped`). Returns false if
   * there is nothing to undo.
   */
  undo(user: string = this.defaultUser): boolean {
    const stacks = this.stacks.get(user);
    const step = stacks?.undo.pop();
    if (!stacks || !step) return false;
    const previous = this.current;
    const result = revertPatchesChecked(this.current, step.patches);
    this.current = result.state;
    if (result.applied.length > 0)
      stacks.redo.push({ command: step.command, patches: result.applied });
    this.notify({
      state: this.current,
      previous,
      patches: result.applied,
      origin: 'undo',
      user,
      command: step.command,
      skipped: result.skipped,
    });
    return true;
  }

  redo(user: string = this.defaultUser): boolean {
    const stacks = this.stacks.get(user);
    const step = stacks?.redo.pop();
    if (!stacks || !step) return false;
    const previous = this.current;
    const result = applyPatchesChecked(this.current, step.patches);
    this.current = result.state;
    if (result.applied.length > 0)
      stacks.undo.push({ command: step.command, patches: result.applied });
    this.notify({
      state: this.current,
      previous,
      patches: result.applied,
      origin: 'redo',
      user,
      command: step.command,
      skipped: result.skipped,
    });
    return true;
  }

  /**
   * Takes in a change made by another instance. The new state is used as it is: it is not an
   * undo step, and before and after handlers do not run (rules apply to what a person does here).
   * `patches` say which paths changed, for listeners such as the canvas.
   */
  applyRemote(next: S, patches: readonly Patch[], user = 'remote'): void {
    const previous = this.current;
    this.current = next;
    this.notify({ state: next, previous, patches, origin: 'remote', user });
  }

  /** The command types of the user's undo stack, oldest first, for menus such as "Undo move". */
  history(user: string = this.defaultUser): string[] {
    return (this.stacks.get(user)?.undo ?? []).map((s) => s.command.type);
  }

  private notify(event: ChangeEvent<S, C>): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}

type Outcome =
  { cancelled: true; reason: string } | { cancelled: false; value: unknown };
