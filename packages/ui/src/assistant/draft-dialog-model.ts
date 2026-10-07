import {
  describeDraftChange,
  draftToCommands,
  safeMessage,
  type DraftKind,
  type DraftMap,
  type DraftOutcome,
} from '@metakit-app/assistant';
import type { ToolCommand, ToolLibrary } from '@metakit-app/core';
import type { AssistantPort } from './assistant-service';

export const KIND_NOUN: Record<DraftKind, string> = {
  rule: 'rule',
  script: 'script',
  shape: 'shape',
  class: 'class',
};

/** A sentence to show as the placeholder, taken from the examples of the plan. */
export const KIND_EXAMPLE: Record<DraftKind, string> = {
  rule: 'High-priority tasks need an owner',
  script: 'Renumber tasks by position, top to bottom',
  shape: 'A rounded blue task box showing its name',
  class: 'A Task with a name, a priority and an owner',
};

export type DraftStatus = 'idle' | 'drafting' | 'done';

/** Everything the dialog shows, as plain data. */
export interface DraftView {
  status: DraftStatus;
  /** The service could not be reached or refused (no key, bad key, offline). */
  error: string | null;
  hasDraft: boolean;
  /** The proposed change in plain English. */
  lines: string[];
  /** The draft as the read-only box shows it: JSON, or the script text. */
  raw: string;
  rawLabel: string;
  /** What is still wrong with the draft; empty when it passed every check. */
  problems: string[];
  attempts: number;
  /** A draft can be accepted only when it passed every check. */
  canAccept: boolean;
}

const EMPTY: DraftView = {
  status: 'idle',
  error: null,
  hasDraft: false,
  lines: [],
  raw: '',
  rawLabel: '',
  problems: [],
  attempts: 0,
  canAccept: false,
};

/**
 * The state behind the draft dialog: the sentence goes in, a checked draft comes out, and the
 * person accepts it (as commands) or discards it. Kept apart from Svelte so it can be tested.
 */
export class DraftDialogModel<K extends DraftKind> {
  sentence = '';
  private current: DraftView = EMPTY;
  private outcome: DraftOutcome<K> | null = null;
  private listeners: (() => void)[] = [];
  // A newer request makes an older answer stale.
  private serial = 0;

  constructor(
    readonly kind: K,
    private tool: ToolLibrary,
    private readonly assistant: AssistantPort,
    private readonly language?: string,
  ) {}

  get view(): DraftView {
    return this.current;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private set(view: DraftView): void {
    this.current = view;
    for (const l of [...this.listeners]) l();
  }

  /** The tool as it is now, so that the plain-English lines and the commands match it. */
  setTool(tool: ToolLibrary): void {
    this.tool = tool;
  }

  get canStart(): boolean {
    return this.sentence.trim() !== '' && this.current.status !== 'drafting';
  }

  async start(): Promise<void> {
    if (!this.canStart) return;
    const mine = ++this.serial;
    this.outcome = null;
    this.set({ ...EMPTY, status: 'drafting' });
    try {
      const outcome = await this.assistant.draft(
        this.kind,
        this.tool,
        this.sentence,
        this.language,
      );
      if (mine !== this.serial) return;
      this.outcome = outcome;
      this.set(this.viewOf(outcome));
    } catch (error) {
      if (mine !== this.serial) return;
      this.set({ ...EMPTY, status: 'done', error: safeMessage(error) });
    }
  }

  private viewOf(outcome: DraftOutcome<K>): DraftView {
    const d = outcome.draft as DraftMap[K] | null;
    let lines: string[] = [];
    if (d) {
      try {
        lines = describeDraftChange(this.kind, d, this.tool);
      } catch {
        // A draft that cannot be described is still shown raw, with its errors.
        lines = [];
      }
    }
    const raw = !d
      ? outcome.raw
      : this.kind === 'script'
        ? (d as DraftMap['script']).source
        : JSON.stringify(d, null, 2);
    return {
      status: 'done',
      error: null,
      hasDraft: d !== null,
      lines,
      raw,
      rawLabel: this.kind === 'script' ? 'TypeScript' : 'JSON',
      problems: outcome.errors,
      attempts: outcome.attempts,
      canAccept: d !== null && outcome.errors.length === 0,
    };
  }

  /**
   * The commands that apply the draft to the tool as it is now, or null when there is nothing
   * to accept. Applying them is one undo step; the caller runs them through Build mode.
   */
  accept(tool: ToolLibrary = this.tool): ToolCommand[] | null {
    if (!this.outcome?.draft || this.outcome.errors.length > 0) return null;
    return draftToCommands(this.kind, this.outcome.draft, tool);
  }

  /** Forgets the draft and the sentence, ready for a new one. */
  discard(): void {
    this.serial++;
    this.outcome = null;
    this.sentence = '';
    this.set(EMPTY);
  }
}
