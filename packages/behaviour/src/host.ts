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
  /** Runs a script of the tool library; the app answers that scripts are not available until phase 7. */
  runScript(script: string, target: string | null): void;
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
