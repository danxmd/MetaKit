import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  validateModel,
  type ElementId,
  type Model,
  type ValidationIssue,
} from '@metakit-app/core';
import { SAMPLE, emptySampleModel, sampleKit } from '@metakit-app/core/testing';
import {
  countBySeverity,
  describeTarget,
  filterIssues,
  groupIssues,
  rowsOf,
  summarise,
} from './validation-list';

const kit = sampleKit();

function fixture() {
  const store = createModelStore(emptySampleModel(), { kit });
  const make = (name: string) => {
    const r = store.execute({
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 0,
      attrs: { [SAMPLE.attName]: name },
    });
    if (!r.ok) throw new Error(r.reason);
    return r.value as ElementId;
  };
  return { store, make, model: () => store.state as Model };
}

const issue = (
  over: Partial<ValidationIssue> & Pick<ValidationIssue, 'id'>,
): ValidationIssue => ({
  severity: 'warning',
  code: 'required',
  message: 'Something is wrong.',
  ...over,
});

describe('describeTarget', () => {
  it('uses the first text value and the class label', () => {
    const f = fixture();
    const id = f.make('Review order');
    expect(describeTarget(id, f.model(), kit)).toEqual({
      kind: 'element',
      name: 'Review order',
      className: kit.classes[SAMPLE.task]!.labels.en ?? 'Task',
    });
  });

  it('falls back to the class name when there is no text', () => {
    const f = fixture();
    const id = f.make('');
    const t = describeTarget(id, f.model(), kit);
    expect(t.name).toBe(t.className);
  });

  it('names the model and survives a deleted object', () => {
    const f = fixture();
    expect(describeTarget('model', f.model(), kit).kind).toBe('model');
    expect(describeTarget('el_gone' as ElementId, f.model(), kit)).toEqual({
      kind: 'missing',
      name: 'el_gone',
      className: '',
    });
  });
});

describe('grouping and filtering', () => {
  const f = fixture();
  const a = f.make('Alpha');
  const b = f.make('Beta');
  const issues: ValidationIssue[] = [
    issue({ id: a, severity: 'warning', message: 'Priority is required.' }),
    issue({
      id: b,
      severity: 'error',
      code: 'constraint',
      message: 'Too big.',
    }),
    issue({ id: b, severity: 'info', code: 'future-code', message: 'FYI.' }),
    issue({ id: 'model', severity: 'warning', code: 'cardinality' }),
  ];
  const rows = rowsOf(issues, f.model(), kit);

  it('groups worst first and leaves empty groups out', () => {
    const groups = groupIssues(rows);
    expect(groups.map((g) => g.severity)).toEqual(['error', 'warning', 'info']);
    expect(groups[1]!.rows).toHaveLength(2);
    expect(
      groupIssues(rows.filter((r) => r.issue.severity === 'error')),
    ).toHaveLength(1);
    expect(groupIssues([])).toEqual([]);
  });

  it('keeps row keys unique', () => {
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('filters by words in message, code, name and class', () => {
    expect(filterIssues(rows, 'alpha')).toHaveLength(1);
    expect(filterIssues(rows, 'CONSTRAINT')).toHaveLength(1);
    expect(filterIssues(rows, 'beta big')).toHaveLength(1);
    expect(filterIssues(rows, 'nothing like this')).toHaveLength(0);
    expect(filterIssues(rows, '')).toHaveLength(4);
  });

  it('filters by severity', () => {
    expect(filterIssues(rows, '', new Set(['error']))).toHaveLength(1);
    expect(filterIssues(rows, '', new Set())).toHaveLength(0);
  });

  it('counts and summarises', () => {
    const counts = countBySeverity(issues);
    expect(counts).toEqual({ error: 1, warning: 2, info: 1 });
    expect(summarise(counts)).toBe('1 error, 2 warnings, 1 note');
    expect(summarise({ error: 0, warning: 0, info: 0 })).toBe(
      'No problems found.',
    );
  });

  it('works on real validation output', () => {
    const real = validateModel(kit, f.model());
    const out = rowsOf(real, f.model(), kit);
    expect(out).toHaveLength(real.length);
  });
});
