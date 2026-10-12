import { describe, expect, it } from 'vitest';
import { createKitStore } from '@metakit-app/core';
import { sampleKit } from '@metakit-app/core/testing';
import type { ConsoleLine } from '@metakit-app/behaviour';
import {
  consoleRows,
  createScript,
  hasCommand,
  isEnabled,
  nameProblem,
  putScript,
  removeScript,
  renameScript,
  setEnabled,
  setPermission,
  setSource,
  sortedScripts,
  statusNote,
} from './scripts-model';

function store() {
  return createKitStore(sampleKit());
}

describe('the list of scripts', () => {
  it('adds scripts with names that do not clash, and sorts them by name', () => {
    const s = store();
    const first = createScript(s.state);
    expect(first.name).toBe('New script');
    s.execute(putScript(first));
    const second = createScript(s.state);
    expect(second.name).toBe('New script 2');
    s.execute(putScript(second));
    s.execute(putScript({ ...createScript(s.state, 'Alpha') }));
    expect(sortedScripts(s.state).map((x) => x.name)).toEqual([
      'Alpha',
      'New script',
      'New script 2',
    ]);
    expect(first.id).toMatch(/^scr_/);
    expect(first.source).toContain('commands.register');
  });

  it('renames, switches on and off, edits and deletes through Kit commands, each undoable', () => {
    const s = store();
    const script = createScript(s.state);
    s.execute(putScript(script));
    s.execute(renameScript(script, '  Renumber  '));
    expect(s.state.scripts[script.id]?.name).toBe('Renumber');
    s.execute(setEnabled(s.state.scripts[script.id]!, false));
    expect(s.state.scripts[script.id]?.enabled).toBe(false);
    expect(isEnabled(s.state.scripts[script.id]!)).toBe(false);
    s.execute(setEnabled(s.state.scripts[script.id]!, true));
    // The default is not stored.
    expect('enabled' in s.state.scripts[script.id]!).toBe(false);
    s.execute(setSource(s.state.scripts[script.id]!, '// nothing'));
    expect(s.state.scripts[script.id]?.source).toBe('// nothing');
    s.execute(removeScript(script.id));
    expect(Object.keys(s.state.scripts)).toEqual([]);
    s.undo();
    expect(s.state.scripts[script.id]?.source).toBe('// nothing');
  });

  it('rejects empty, long and duplicate names, but not the own name', () => {
    const s = store();
    const a = createScript(s.state, 'A');
    s.execute(putScript(a));
    expect(nameProblem(s.state, '   ')).toMatch(/needs a name/);
    expect(nameProblem(s.state, 'x'.repeat(81))).toMatch(/under 80/);
    expect(nameProblem(s.state, 'a')).toBe(
      'There is already a script called "A".',
    );
    expect(nameProblem(s.state, 'a', a.id)).toBeNull();
    expect(nameProblem(s.state, 'B')).toBeNull();
  });

  it('shows a Run button only for scripts that register a command', () => {
    expect(hasCommand('commands.register({ id: "x" })')).toBe(true);
    expect(hasCommand('commands . register (')).toBe(true);
    expect(hasCommand('on("object.created", () => {})')).toBe(false);
    expect(hasCommand(createScript(sampleKit()).source)).toBe(true);
  });
});

describe('permissions', () => {
  it('are declared in the manifest and can be taken back', () => {
    const s = store();
    s.execute(setPermission(s.state, 'network', true));
    s.execute(setPermission(s.state, 'files', true));
    expect(s.state.manifest.permissions).toEqual({
      network: true,
      files: true,
    });
    s.execute(setPermission(s.state, 'network', false));
    expect(s.state.manifest.permissions).toEqual({ files: true });
  });
});

describe('the console view', () => {
  const lines: ConsoleLine[] = [
    {
      id: 1,
      time: new Date(2026, 9, 7, 9, 5, 3).getTime(),
      level: 'log',
      text: 'hello',
    },
    {
      id: 2,
      time: new Date(2026, 9, 7, 9, 5, 4).getTime(),
      level: 'error',
      scriptId: 'scr_a',
      scriptName: 'Renumber',
      line: 12,
      text: 'went wrong',
    },
    {
      id: 3,
      time: new Date(2026, 9, 7, 23, 59, 59).getTime(),
      level: 'warn',
      scriptId: 'scr_a',
      scriptName: 'Renumber',
      text: 'careful',
    },
  ];

  it('shows time, script and line, and the text', () => {
    expect(consoleRows(lines)).toEqual([
      { id: 1, time: '09:05:03', level: 'log', origin: '', text: 'hello' },
      {
        id: 2,
        time: '09:05:04',
        level: 'error',
        origin: 'Renumber, line 12',
        text: 'went wrong',
      },
      {
        id: 3,
        time: '23:59:59',
        level: 'warn',
        origin: 'Renumber',
        text: 'careful',
      },
    ]);
  });

  it('can show only the problems', () => {
    expect(consoleRows(lines, 'problems').map((r) => r.id)).toEqual([2, 3]);
  });

  it('says what is wrong with a script in plain English', () => {
    expect(statusNote({ state: 'running' })).toBeNull();
    expect(statusNote({ state: 'disabled' })).toBeNull();
    expect(
      statusNote({ state: 'error', error: 'Unexpected token', line: 3 }),
    ).toBe('Problem on line 3: Unexpected token');
    expect(statusNote({ state: 'stopped' })).toMatch(/too much time or memory/);
  });
});
