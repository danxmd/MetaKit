import type { Json } from '@metakit-app/core';

/** One field of a script's form dialog (`ui.form`). */
export interface FormField {
  /** The name the answer is stored under. */
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'choice';
  /** The choices of a `choice` field. */
  options?: string[];
  default?: Json;
  required?: boolean;
  multiline?: boolean;
}

export interface FormSpec {
  title?: string;
  fields: FormField[];
}

/** A progress display that a script updates while it works (`ui.progress`). */
export interface ProgressHandle {
  /** `fraction` is 0 to 1, or null when it is not known. */
  update(fraction: number | null, text?: string): void;
  done(): void;
}

/**
 * What rules and scripts need from the app that runs them. The app (or a test) implements it;
 * nothing here touches the DOM. Dialogs are synchronous so that a "before" event can wait for the
 * answer before it decides whether to cancel (ADR 0005).
 */
export interface BehaviourHost {
  /** Shows a message to the user: a toast, a note in the status line, or both. */
  message(kind: 'info' | 'warning' | 'error', text: string): void;
  /** Asks a yes or no question. */
  confirm(text: string): boolean;
  /** Asks to pick one of the options; null when the user cancels. */
  choose(text: string, options: readonly string[]): string | null;
  /** Opens another model of the workspace, by name or folder name. */
  openModel(model: string): void;
  /** Runs a command (a rule with the event "command", or a script command) on the object, if any. */
  runCommand(command: string, target: string | null): void;
  /** Runs a script of the Kit (by id), on the object if there is one. */
  runScript(script: string, target: string | null): void;
  /** Asks for a line of text; null when the user cancels. Scripts only (`ui.prompt`). */
  prompt?(text: string, initial?: string): string | null;
  /** Shows a form and returns what was entered; null when the user cancels. Scripts only (`ui.form`). */
  form?(spec: FormSpec): Record<string, Json> | null;
  /** Starts a progress display. Scripts only (`ui.progress`). */
  progress?(label: string): ProgressHandle;
  /** The "open file" dialog: the file chosen by the person, or null. Scripts with the files permission only. */
  openFile?(options?: {
    accept?: string[];
  }): Promise<{ name: string; text: string } | null>;
  /** The "save as" dialog: false when the person cancels. Scripts with the files permission only. */
  saveFile?(name: string, text: string): Promise<boolean>;
}

/** A host that does nothing and answers "no" to every question, for tests and headless runs. */
export function silentHost(
  overrides: Partial<BehaviourHost> = {},
): BehaviourHost {
  return {
    message: () => undefined,
    confirm: () => false,
    choose: () => null,
    openModel: () => undefined,
    runCommand: () => undefined,
    runScript: () => undefined,
    ...overrides,
  };
}
