import { describe, expect, it } from 'vitest';
import {
  conflictKey,
  type MergeConflict,
  type PartChange,
} from '@metakit-app/storage';
import {
  changeCountText,
  commitProblem,
  groupChanges,
  suggestMessage,
} from './commit-model';
import {
  allChosen,
  conflictSummary,
  conflictTitle,
  showValue,
  toResolutions,
} from './conflict-model';
import { releaseLabel, sortReleases } from './release-model';

const change = (
  c: PartChange['change'],
  part: string,
  name: string,
): PartChange => ({
  path: `${part}/${name}.json`,
  change: c,
  part,
  name,
  text: `${part} "${name}" ${c}`,
});

const clash = (
  field: string,
  ours?: string,
  theirs?: string,
): MergeConflict => ({
  path: 'classes/task.json',
  field,
  steps: field === '' ? [] : field.split(' > '),
  part: 'class "Task"',
  base: 'old',
  ours,
  theirs,
});

describe('commit model', () => {
  it('groups changes and drops empty groups', () => {
    const groups = groupChanges([
      change('changed', 'class', 'Task'),
      change('added', 'shape', 'Box'),
      change('changed', 'class', 'Lane'),
    ]);
    expect(groups.map((g) => [g.title, g.changes.length])).toEqual([
      ['Added', 1],
      ['Changed', 2],
    ]);
    expect(groupChanges([])).toEqual([]);
  });

  it('suggests a message from the first change', () => {
    expect(suggestMessage([])).toBe('');
    expect(suggestMessage([change('changed', 'class', 'Task')])).toBe(
      'Change class Task',
    );
    expect(
      suggestMessage([
        change('added', 'shape', 'Box'),
        change('changed', 'class', 'Task'),
      ]),
    ).toBe('Add shape Box and 1 more part');
    expect(
      suggestMessage([
        change('removed', 'script', 'S'),
        change('added', 'rule', 'R'),
        change('added', 'rule', 'Q'),
      ]),
    ).toBe('Remove script S and 2 more parts');
  });

  it('says why a commit cannot go', () => {
    const one = [change('changed', 'class', 'Task')];
    expect(commitProblem('x', [])).toMatch(/Nothing has changed/);
    expect(commitProblem('  ', one)).toMatch(/message/);
    expect(commitProblem('Fix', one)).toBeNull();
    expect(changeCountText(one)).toBe('1 changed part');
    expect(changeCountText([])).toBe('No changes');
  });
});

describe('conflict model', () => {
  it('shows values for people', () => {
    expect(showValue(undefined)).toBe('(not there)');
    expect(showValue('Name')).toBe('Name');
    expect(showValue({ en: 'A' })).toBe('{\n  "en": "A"\n}');
    expect(showValue('x'.repeat(700)).endsWith('...')).toBe(true);
  });

  it('titles clashes', () => {
    expect(conflictTitle(clash('labels > en', 'a', 'b'))).toBe(
      'Class "Task": labels > en',
    );
    expect(conflictTitle(clash('', undefined, 'b'))).toMatch(
      /removed on one side/,
    );
    expect(conflictTitle(clash('', 'a', 'b'))).toMatch(/whole file/);
  });

  it('tracks choices by position and turns them into resolutions', () => {
    const list = [clash('labels > en', 'a', 'b'), clash('help > en', 'c', 'd')];
    expect(allChosen(list, {})).toBe(false);
    expect(allChosen(list, { 0: 'ours' })).toBe(false);
    expect(allChosen(list, { 0: 'ours', 1: 'theirs' })).toBe(true);
    expect(allChosen([], {})).toBe(false);
    expect(conflictSummary(list, { 1: 'theirs' })).toBe(
      '1 of 2 clashes decided',
    );
    expect(toResolutions(list, { 0: 'ours', 1: 'theirs' })).toEqual({
      [conflictKey(list[0]!)]: 'ours',
      [conflictKey(list[1]!)]: 'theirs',
    });
  });
});

describe('release model', () => {
  const tag = (name: string) => ({ name, commit: '3fa9c21aabbcc' });

  it('sorts version tags newest first and keeps other orders', () => {
    expect(
      sortReleases([tag('v1.2.0'), tag('v1.10.0'), tag('2.0.0')]).map(
        (t) => t.name,
      ),
    ).toEqual(['2.0.0', 'v1.10.0', 'v1.2.0']);
    expect(
      sortReleases([tag('release-b'), tag('v1.0.0')]).map((t) => t.name),
    ).toEqual(['release-b', 'v1.0.0']);
    expect(sortReleases([])).toEqual([]);
  });

  it('labels a tag with a short commit', () => {
    expect(releaseLabel(tag('v1.0.0'))).toBe('v1.0.0 (commit 3fa9c21)');
  });
});
