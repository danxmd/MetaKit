import {
  newId,
  type Script,
  type ScriptId,
  type ToolLibrary,
  type ToolPermissions,
} from '@metakit-app/core';
import type {
  ConsoleLevel,
  ConsoleLine,
  ScriptStatus,
} from '@metakit-app/behaviour';

/**
 * The parts of the scripts section that are plain data, so that they can be tested without a
 * browser: the list, naming, new scripts, permissions, and how a console line reads.
 */

/** What the section needs from the running scripts; `ScriptsHandle` of the behaviour package fits. */
export interface ScriptsApi {
  readonly log: readonly ConsoleLine[];
  clearLog(): void;
  onLog(listener: () => void): () => void;
  status(id: ScriptId): ScriptStatus;
  onStatus(listener: () => void): () => void;
  /** Runs a script by hand, with the selected object as the target if there is one. */
  runScript(id: ScriptId, target: string | null): Promise<void>;
}

export const NEW_SCRIPT_TEMPLATE = `import { on, model, ui, commands } from "metakit";

// This part runs when the Kit is opened: say what should happen, and do the work
// in handlers and commands.

// on("object.created", { class: "Task" }, (event) => {
//   ui.message("A task was created.");
// });

commands.register({
  id: "count-objects",
  label: "Count objects",
  menu: "Model",
  run: () => {
    ui.message(\`There are \${model.objects().length} objects.\`);
  },
});
`;

const byName = (a: Script, b: Script) =>
  a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1);

export function sortedScripts(tool: ToolLibrary): Script[] {
  return Object.values(tool.scripts ?? {}).sort(byName);
}

/** A problem with a script name, in plain English, or null when it is fine. */
export function nameProblem(
  tool: ToolLibrary,
  name: string,
  ownId?: ScriptId,
): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'A script needs a name.';
  if (trimmed.length > 80) return 'Keep the name under 80 characters.';
  const clash = Object.values(tool.scripts ?? {}).find(
    (s) => s.id !== ownId && s.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return clash ? `There is already a script called "${clash.name}".` : null;
}

/** A new script with a name that no other script has, and the starting text. */
export function createScript(tool: ToolLibrary, base = 'New script'): Script {
  let name = base;
  for (let n = 2; nameProblem(tool, name) !== null; n++) name = `${base} ${n}`;
  return { id: newId('script'), name, source: NEW_SCRIPT_TEMPLATE };
}

export const putScript = (script: Script) =>
  ({ type: 'putScript', script }) as const;
export const removeScript = (id: ScriptId) =>
  ({ type: 'removeScript', id }) as const;

export const renameScript = (script: Script, name: string) =>
  putScript({ ...script, name: name.trim() });

export const setSource = (script: Script, source: string) =>
  putScript({ ...script, source });

/** Scripts are on unless `enabled` is false; the stored form leaves out the default. */
export function setEnabled(script: Script, enabled: boolean) {
  const next: Script = { ...script };
  if (enabled) delete next.enabled;
  else next.enabled = false;
  return putScript(next);
}

export const isEnabled = (script: Script): boolean => script.enabled !== false;

/** Whether the script registers a command, which makes a "Run" button useful. */
export const hasCommand = (source: string): boolean =>
  /\bcommands\s*\.\s*register\s*\(/.test(source);

export function setPermission(
  tool: ToolLibrary,
  key: keyof ToolPermissions,
  on: boolean,
) {
  const next: ToolPermissions = { ...tool.manifest.permissions };
  if (on) next[key] = true;
  else delete next[key];
  return { type: 'updateManifest', permissions: next } as const;
}

// -- the console ---------------------------------------------------------------------------------

const two = (n: number) => String(n).padStart(2, '0');

/** `09:30:05`, in the local time zone of the reader. */
export function clock(time: number): string {
  const d = new Date(time);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

export interface ConsoleRow {
  id: number;
  time: string;
  level: ConsoleLevel;
  /** `Renumber tasks, line 12`, or an empty text for lines that name no script. */
  origin: string;
  text: string;
}

export function consoleRows(
  lines: readonly ConsoleLine[],
  filter: 'all' | 'problems' = 'all',
): ConsoleRow[] {
  return lines
    .filter(
      (l) => filter === 'all' || l.level === 'error' || l.level === 'warn',
    )
    .map((l) => ({
      id: l.id,
      time: clock(l.time),
      level: l.level,
      origin: l.scriptName
        ? l.line !== undefined
          ? `${l.scriptName}, line ${l.line}`
          : l.scriptName
        : '',
      text: l.text,
    }));
}

/** What to show next to a script in the list, or null when there is nothing to say. */
export function statusNote(status: ScriptStatus): string | null {
  switch (status.state) {
    case 'running':
    case 'disabled':
      return null;
    case 'error':
      return status.line !== undefined
        ? `Problem on line ${status.line}: ${status.error ?? ''}`
        : (status.error ?? 'This script has a problem.');
    case 'stopped':
      return (
        status.error ??
        'This script was stopped because it used too much time or memory.'
      );
  }
}
