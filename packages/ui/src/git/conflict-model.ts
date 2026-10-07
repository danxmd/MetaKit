import type { Json } from '@metakit-app/core';
import {
  conflictKey,
  type Choice,
  type MergeConflict,
  type Resolutions,
} from '@metakit-app/storage';

/** What the conflict dialog shows and checks. The choices are kept by position in the list. */

const MAX_SHOWN = 600;

/** A value as the person reads it: text as it is, the rest as short JSON, a missing value as "(not there)". */
export function showValue(value: Json | undefined): string {
  if (value === undefined) return '(not there)';
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN)}...` : text;
}

/** Heading of one clash, such as `Class "Task": labels > en`. */
export function conflictTitle(c: MergeConflict): string {
  const part = c.part.charAt(0).toUpperCase() + c.part.slice(1);
  if (c.field === '')
    return c.ours === undefined || c.theirs === undefined
      ? `${part}: removed on one side, changed on the other`
      : `${part}: the whole file`;
  return `${part}: ${c.field}`;
}

/** `Keep mine` and `Take theirs` as the buttons say them. */
export const CHOICE_LABELS: Record<Choice, string> = {
  ours: 'Keep mine',
  theirs: 'Take theirs',
};

export function chosenCount(
  conflicts: readonly MergeConflict[],
  choices: Readonly<Record<number, Choice | undefined>>,
): number {
  return conflicts.filter((_, i) => choices[i] !== undefined).length;
}

export function allChosen(
  conflicts: readonly MergeConflict[],
  choices: Readonly<Record<number, Choice | undefined>>,
): boolean {
  return (
    conflicts.length > 0 && chosenCount(conflicts, choices) === conflicts.length
  );
}

/** The choices by position, turned into what `finishPull` takes. */
export function toResolutions(
  conflicts: readonly MergeConflict[],
  choices: Readonly<Record<number, Choice | undefined>>,
): Resolutions {
  const out: Resolutions = {};
  conflicts.forEach((c, i) => {
    const choice = choices[i];
    if (choice) out[conflictKey(c)] = choice;
  });
  return out;
}

export function conflictSummary(
  conflicts: readonly MergeConflict[],
  choices: Readonly<Record<number, Choice | undefined>>,
): string {
  const n = conflicts.length;
  const done = chosenCount(conflicts, choices);
  return `${done} of ${n} ${n === 1 ? 'clash' : 'clashes'} decided`;
}
