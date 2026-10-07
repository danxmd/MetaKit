import type { PartChange } from '@metakit-app/storage';

/** What the commit dialog shows and checks. The dialog itself only draws this. */

export interface ChangeGroup {
  title: 'Added' | 'Changed' | 'Removed';
  changes: PartChange[];
}

const TITLES = {
  added: 'Added',
  changed: 'Changed',
  removed: 'Removed',
} as const;

/** The changed parts grouped as added, changed and removed; empty groups are left out. */
export function groupChanges(changes: readonly PartChange[]): ChangeGroup[] {
  return (['added', 'changed', 'removed'] as const)
    .map((kind) => ({
      title: TITLES[kind],
      changes: changes.filter((c) => c.change === kind),
    }))
    .filter((g) => g.changes.length > 0);
}

/** A first draft of the message: it names the first part and counts the rest. */
export function suggestMessage(changes: readonly PartChange[]): string {
  const first = changes[0];
  if (!first) return '';
  const verb = { added: 'Add', changed: 'Change', removed: 'Remove' }[
    first.change
  ];
  const subject = first.name ? `${first.part} ${first.name}` : first.part;
  const rest = changes.length - 1;
  return rest === 0
    ? `${verb} ${subject}`
    : `${verb} ${subject} and ${rest} more ${rest === 1 ? 'part' : 'parts'}`;
}

/** Why the commit cannot go yet, in plain English, or null. */
export function commitProblem(
  message: string,
  changes: readonly PartChange[],
): string | null {
  if (changes.length === 0)
    return 'Nothing has changed since the last pull or commit.';
  if (message.trim() === '')
    return 'Write a short message that says what you changed.';
  return null;
}

/** "3 changed parts" for the summary line. */
export function changeCountText(changes: readonly PartChange[]): string {
  const n = changes.length;
  return n === 0 ? 'No changes' : `${n} changed ${n === 1 ? 'part' : 'parts'}`;
}
