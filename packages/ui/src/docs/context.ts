import type { DocContext } from '@metakit-app/docs';

// Only types come from the docs package here: its code and content load when Help first opens.

type Listener<T> = (value: T) => void;

class Store<T> {
  private listeners = new Set<Listener<T>>();
  constructor(protected value: T) {}
  subscribe = (listener: Listener<T>): (() => void) => {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  };
  get(): T {
    return this.value;
  }
  protected set(value: T): void {
    this.value = value;
    for (const listener of [...this.listeners]) listener(value);
  }
}

// Which page is the person on? ------------------------------------------------------------------

/** A higher layer wins: a dialog over a build section over the page the app shows. */
export const DocsLayer = { base: 0, view: 1, area: 2, dialog: 3 } as const;

interface ContextEntry {
  key: symbol;
  level: number;
  context: DocContext;
}

class ContextStore extends Store<DocContext> {
  private base: DocContext = 'start';
  private entries: ContextEntry[] = [];

  constructor() {
    super('start');
  }

  setBase(context: DocContext): void {
    this.base = context;
    this.recompute();
  }

  push(context: DocContext, level: number): () => void {
    const key = Symbol(context);
    this.entries.push({ key, level, context });
    this.recompute();
    return () => {
      this.entries = this.entries.filter((e) => e.key !== key);
      this.recompute();
    };
  }

  private recompute(): void {
    let best: ContextEntry | undefined;
    // The latest entry of the highest level wins, so a section that changes does not hide a dialog.
    for (const entry of this.entries) {
      if (!best || entry.level >= best.level) best = entry;
    }
    const next = best && best.level > DocsLayer.base ? best.context : this.base;
    if (next !== this.value) this.set(next);
  }
}

const contextStore = new ContextStore();

/** The page the person is on, for the Help side bar. */
export const docsContext: {
  subscribe: (listener: Listener<DocContext>) => () => void;
  get: () => DocContext;
} = { subscribe: contextStore.subscribe, get: () => contextStore.get() };

/** Sets the page the app itself shows (start, models, model, ...). */
export function setDocsContext(context: DocContext): void {
  contextStore.setBase(context);
}

/**
 * Reports a finer context while something is open, such as a build section or a dialog. Returns
 * the function that takes it back, so it fits `$effect(() => pushDocsContext('dialog.export'))`.
 */
export function pushDocsContext(
  context: DocContext,
  level: number = DocsLayer.view,
): () => void {
  return contextStore.push(context, level);
}

// History of one reader ---------------------------------------------------------------------------

/** The category overview, shown when the page has no topic. */
export const OVERVIEW = '@overview';

export interface DocsEntry {
  /** A topic id, or OVERVIEW. */
  id: string;
  anchor: string | null;
}

export interface NavState {
  current: DocsEntry | null;
  canBack: boolean;
  canForward: boolean;
  /** True while the reader follows the page: the topic changes with the context. */
  following: boolean;
}

/** Back and Forward through the topics a person visited. */
export class DocsNav extends Store<NavState> {
  private entries: DocsEntry[] = [];
  private pos = -1;
  private follows = false;
  private wantPage = false;

  constructor(follows = false) {
    super({ current: null, canBack: false, canForward: false, following: false });
    this.follows = follows;
    this.wantPage = follows;
    this.publish();
  }

  private publish(): void {
    this.set({
      current: this.entries[this.pos] ?? null,
      canBack: this.pos > 0,
      canForward: this.pos >= 0 && this.pos < this.entries.length - 1,
      following: this.follows,
    });
  }

  /** Go to a topic by link or search. The topic the person came from stays one Back away. */
  navigate(id: string, anchor: string | null = null): void {
    const here = this.entries[this.pos];
    if (here && here.id === id && here.anchor === anchor && !this.follows) {
      return;
    }
    this.entries = [...this.entries.slice(0, this.pos + 1), { id, anchor }];
    this.pos = this.entries.length - 1;
    this.follows = false;
    this.publish();
  }

  /** Start following the page: the current entry is the page's topic from now on. */
  followPage(id: string): void {
    const here = this.entries[this.pos];
    if (!this.follows) {
      if (!(here && here.id === id && here.anchor === null)) {
        this.entries = [
          ...this.entries.slice(0, this.pos + 1),
          { id, anchor: null },
        ];
        this.pos = this.entries.length - 1;
      }
      this.follows = true;
    } else if (here) {
      this.entries[this.pos] = { id, anchor: null };
    } else {
      this.entries = [{ id, anchor: null }];
      this.pos = 0;
    }
    this.publish();
  }

  /**
   * The reader should open at the current page's topic the next time it knows it: Help was just
   * opened with F1 or the Help button, not at a topic of its own.
   */
  requestPage(): void {
    this.wantPage = true;
  }

  cancelPageRequest(): void {
    this.wantPage = false;
  }

  /**
   * Called with the topic of the current page when the reader starts and whenever the page
   * changes. It moves the reader along only when it was asked to, or is following the page.
   */
  syncPage(id: string): void {
    if (this.wantPage || this.follows) this.followPage(id);
    this.wantPage = false;
  }

  setFollowing(on: boolean): void {
    this.follows = on;
    this.publish();
  }

  back(): void {
    if (this.pos <= 0) return;
    this.pos -= 1;
    this.follows = false;
    this.publish();
  }

  forward(): void {
    if (this.pos >= this.entries.length - 1) return;
    this.pos += 1;
    this.follows = false;
    this.publish();
  }
}

// The side bar ------------------------------------------------------------------------------------

export const DOCS_MIN_WIDTH = 300;
export const DOCS_DEFAULT_WIDTH = 380;
const KEY = 'metakit.docs.panel';

export interface PanelState {
  open: boolean;
  width: number;
}

export function clampDocsWidth(width: number, viewport: number): number {
  const max = Math.max(DOCS_MIN_WIDTH, Math.floor(viewport * 0.6));
  return Math.min(max, Math.max(DOCS_MIN_WIDTH, Math.round(width)));
}

function readStored(): PanelState {
  const fallback = { open: false, width: DOCS_DEFAULT_WIDTH };
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<PanelState>;
    return {
      open: data.open === true,
      width:
        typeof data.width === 'number' && Number.isFinite(data.width)
          ? Math.max(DOCS_MIN_WIDTH, data.width)
          : DOCS_DEFAULT_WIDTH,
    };
  } catch {
    return fallback;
  }
}

function writeStored(state: PanelState): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private windows and blocked storage: the bar simply does not remember.
  }
}

class PanelStore extends Store<PanelState> {
  /** History of the side bar. It lives for the session, not in storage. */
  readonly nav = new DocsNav(true);

  constructor() {
    super(readStored());
  }

  private update(patch: Partial<PanelState>): void {
    const next = { ...this.value, ...patch };
    if (next.open === this.value.open && next.width === this.value.width) return;
    this.set(next);
    writeStored(next);
  }

  open(): void {
    this.update({ open: true });
  }

  close(): void {
    this.update({ open: false });
  }

  toggle(): void {
    this.update({ open: !this.value.open });
  }

  setWidth(width: number): void {
    this.update({ width: Math.max(DOCS_MIN_WIDTH, Math.round(width)) });
  }

  /** Opens the bar at a topic. */
  openTopic(id: string, anchor: string | null = null): void {
    this.nav.cancelPageRequest();
    this.nav.navigate(id, anchor);
    this.update({ open: true });
  }
}

const panel = new PanelStore();

/** Whether the side bar is open, and how wide. Saved in this browser. */
export const docsOpen: {
  subscribe: (listener: Listener<PanelState>) => () => void;
  get: () => PanelState;
} = { subscribe: panel.subscribe, get: () => panel.get() };

/** Back and Forward of the side bar. */
export const docsPanelNav: DocsNav = panel.nav;

/** Opens the side bar, at a topic when one is given, otherwise at the current page's topic. */
export function openDocs(topicId?: string, anchor: string | null = null): void {
  if (topicId) panel.openTopic(topicId, anchor);
  else {
    panel.nav.requestPage();
    panel.open();
  }
}

export function closeDocs(): void {
  panel.close();
}

export function toggleDocs(): void {
  if (panel.get().open) panel.close();
  else openDocs();
}

export function setDocsWidth(width: number): void {
  panel.setWidth(width);
}

/** Is the keyboard focus somewhere the person types text? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'range'].includes(type);
  }
  return false;
}
