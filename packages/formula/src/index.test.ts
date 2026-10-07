import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  evaluate,
  parse,
  renameName,
  run,
  type Scope,
  type Value,
} from './index';

function scopeOf(values: Record<string, Value>): Scope {
  return { get: (name) => values[name] };
}
const val = (src: string, values: Record<string, Value> = {}) =>
  run(src, scopeOf(values));

describe('parse and evaluate', () => {
  it('does arithmetic with the usual precedence', () => {
    expect(val('1 + 2 * 3').value).toBe(7);
    expect(val('(1 + 2) * 3').value).toBe(9);
    expect(val('10 % 4 - -1').value).toBe(3);
    expect(val('7 / 2').value).toBe(3.5);
  });

  it('joins text and numbers with plus', () => {
    expect(val("'a' + 1 + 'b'").value).toBe('a1b');
    expect(val("Effort + ' h'", { Effort: 2.5 }).value).toBe('2.5 h');
    expect(val("'x' + Missing", { Missing: null }).value).toBe('x');
  });

  it('compares and combines', () => {
    expect(val("P == 'High'", { P: 'High' }).value).toBe(true);
    expect(val('1 < 2 && 2 <= 2').value).toBe(true);
    expect(val("'a' < 'b'").value).toBe(true);
    expect(val('1 < "b"').value).toBe(false);
    expect(val('null == null').value).toBe(true);
    expect(val('[1, 2] == [1, 2]').value).toBe(true);
    expect(val('0 || "x"').value).toBe('x');
    expect(val('!0').value).toBe(true);
  });

  it('picks with the conditional, nested to the right', () => {
    const src =
      "P == 'High' ? '#D93025' : P == 'Medium' ? '#F29900' : '#5F6368'";
    expect(val(src, { P: 'High' }).value).toBe('#D93025');
    expect(val(src, { P: 'Medium' }).value).toBe('#F29900');
    expect(val(src, { P: 'Low' }).value).toBe('#5F6368');
  });

  it('follows members and tolerates empty values', () => {
    const owner = { Name: 'Anna' };
    expect(val("'Owner: ' + Owner.Name", { Owner: owner }).value).toBe(
      'Owner: Anna',
    );
    expect(val('Owner.Name', { Owner: null }).value).toBeNull();
    expect(val('Owner != null', { Owner: null }).value).toBe(false);
  });

  it('uses the member hook for references', () => {
    const scope: Scope = {
      get: (n) => (n === 'Owner' ? 'el_1' : undefined),
      member: (v, key) => (v === 'el_1' ? { Name: 'Ben' }[key] : undefined),
    };
    expect(run('Owner.Name', scope).value).toBe('Ben');
  });

  it('has a small set of functions', () => {
    expect(val('round(2.456, 1)').value).toBe(2.5);
    expect(val("upper('ab') + len([1,2,3])").value).toBe('AB3');
    expect(val('coalesce(null, "", 4)').value).toBe(4);
    expect(val('open(X)', { X: 'el_9' }).value).toEqual({
      action: 'open',
      target: 'el_9',
    });
  });

  it('records which names it read, only on the path taken', () => {
    const r = val('A ? B : C', { A: true, B: 1, C: 2 });
    expect(r.reads).toEqual(['A', 'B']);
    expect(val('A && B', { A: false, B: 1 }).reads).toEqual(['A']);
  });

  it('reports problems with a null value instead of throwing', () => {
    expect(val('Nope').error).toMatch(/not known/);
    expect(val('Nope').value).toBeNull();
    expect(val('1 +').error).toMatch(/Unexpected the end/);
    expect(val('1 / 0').error).toMatch(/zero/);
    expect(val("'a' - 1").error).toMatch(/number/);
    expect(val('frob(1)').error).toMatch(/no function/);
    expect(val("'open").error).toMatch(/not closed/);
    expect(val('1 @ 2').error).toMatch(/Unexpected character/);
  });

  it('parses without evaluating', () => {
    expect(parse('A +').ok).toBe(false);
    expect(parse('A + B').ok).toBe(true);
  });
});

describe('renameName', () => {
  it('renames names but not strings, members, calls or longer names', () => {
    expect(
      renameName(
        "Priority == 'Priority' && PriorityX > 1",
        'Priority',
        'Urgency',
      ),
    ).toBe("Urgency == 'Priority' && PriorityX > 1");
    expect(renameName('Owner.Priority + Priority', 'Priority', 'P2')).toBe(
      'Owner.Priority + P2',
    );
    expect(renameName('round(round)', 'round', 'x')).toBe('round(x)');
    expect(renameName('broken (', 'a', 'b')).toBe('broken (');
  });

  it('keeps the result of a formula when a name is renamed in it and in the scope', () => {
    const names = ['Alpha', 'Beta', 'Gamma'];
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...names), { minLength: 1, maxLength: 5 }),
        fc.array(fc.integer({ min: -50, max: 50 }), {
          minLength: 3,
          maxLength: 3,
        }),
        (used, nums) => {
          const src = used.join(' + ');
          const values: Record<string, Value> = {
            Alpha: nums[0]!,
            Beta: nums[1]!,
            Gamma: nums[2]!,
          };
          const before = run(src, scopeOf(values)).value;
          const renamed = renameName(src, 'Beta', 'Delta');
          const after = run(
            renamed,
            scopeOf({ ...values, Delta: values.Beta! }),
          ).value;
          expect(after).toBe(before);
        },
      ),
    );
  });
});

describe('evaluate', () => {
  it('can be used with a parsed expression', () => {
    const p = parse('A * 2');
    if (!p.ok) throw new Error('parse');
    expect(evaluate(p.expr, scopeOf({ A: 4 })).value).toBe(8);
  });
});
