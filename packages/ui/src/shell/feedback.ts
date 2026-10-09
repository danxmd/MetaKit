/**
 * Short feedback that any screen can raise: a toast (optionally with Undo) and a confirm dialog.
 * One of each is rendered by the app shell. The rule (ui-coherence): what can be undone happens
 * at once and offers Undo in a toast; what cannot be undone asks first in the confirm dialog.
 */

type Listener<T> = (value: T) => void;

class Store<T> {
  #value: T;
  #listeners = new Set<Listener<T>>();
  constructor(value: T) {
    this.#value = value;
  }
  get value(): T {
    return this.#value;
  }
  protected set(value: T) {
    this.#value = value;
    for (const l of this.#listeners) l(value);
  }
  /** Svelte store contract: called at once, then on every change. */
  subscribe(listener: Listener<T>): () => void {
    this.#listeners.add(listener);
    listener(this.#value);
    return () => this.#listeners.delete(listener);
  }
}

export interface Toast {
  id: number;
  text: string;
  /** Shown as an Undo button; the toast closes when it is used. */
  undo?: () => void;
  /** Called once when this toast goes away, however that happens. */
  onClose?: () => void;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class ToastStore extends Store<Toast | null> {
  #next = 1;
  #timer: unknown;
  constructor(private readonly timers: Timers = realTimers) {
    super(null);
  }

  /** Shows a toast in place of the current one and returns its id. Toasts with Undo stay longer. */
  show(
    text: string,
    options: { undo?: () => void; onClose?: () => void; ms?: number } = {},
  ): number {
    this.#close();
    const toast: Toast = {
      id: this.#next++,
      text,
      undo: options.undo,
      onClose: options.onClose,
    };
    this.set(toast);
    this.#timer = this.timers.set(
      () => this.dismiss(toast.id),
      options.ms ?? (options.undo ? 10_000 : 6000),
    );
    return toast.id;
  }

  /** Closes the toast; with an id, only if that toast is still showing. */
  dismiss(id?: number) {
    if (id !== undefined && this.value?.id !== id) return;
    this.#close();
    this.set(null);
  }

  #close() {
    this.timers.clear(this.#timer);
    this.value?.onClose?.();
  }

  /** Runs the Undo of the toast that is showing, then closes it. */
  undo() {
    const toast = this.value;
    this.dismiss();
    toast?.undo?.();
  }
}

/** What `offerUndo` needs from a document store. */
export interface UndoSource {
  undo(): boolean;
  /** Listens to changes made here (not those read from other instances); returns a stop function. */
  onLocalChange(listener: () => void): () => void;
}

/**
 * Shows `text` with Undo for the step that was just made. The offer is withdrawn as soon as the
 * document changes again, so Undo can never revert a different step than the one it names.
 */
export function offerUndo(
  text: string,
  source: UndoSource,
  store: ToastStore = toasts,
) {
  let stop = () => {};
  const id = store.show(text, {
    undo: () => {
      stop();
      source.undo();
    },
    onClose: () => stop(),
  });
  stop = source.onLocalChange(() => store.dismiss(id));
}

export interface ConfirmRequest {
  title: string;
  message: string;
  /** Label of the button that goes ahead, such as "Delete". */
  action: string;
  /** Styles the action as destructive. */
  danger?: boolean;
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

export class ConfirmStore extends Store<ConfirmRequest | null> {
  #queue: Pending[] = [];

  constructor() {
    super(null);
  }

  /** Asks the person; resolves `true` when they go ahead. Requests wait their turn. */
  ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise((resolve) => {
      this.#queue.push({ ...request, resolve });
      if (this.#queue.length === 1) this.set(this.#show(this.#queue[0]!));
    });
  }

  answer(ok: boolean) {
    const done = this.#queue.shift();
    if (!done) return;
    const next = this.#queue[0];
    this.set(next ? this.#show(next) : null);
    done.resolve(ok);
  }

  #show(pending: Pending): ConfirmRequest {
    const { title, message, action, danger } = pending;
    return { title, message, action, danger };
  }
}

export const toasts = new ToastStore();
export const confirms = new ConfirmStore();

/** Asks in the app's own confirm dialog. */
export const confirmAction = (request: ConfirmRequest) => confirms.ask(request);
