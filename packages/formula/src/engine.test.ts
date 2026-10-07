import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIMITS, run, type Scope, type Value } from './index';

const scopeOf = (
  values: Record<string, Value>,
  extra: Partial<Scope> = {},
): Scope => ({
  get: (n) => (Object.hasOwn(values, n) ? values[n] : undefined),
  ...extra,
});
const val = (
  src: string,
  values: Record<string, Value> = {},
  extra?: Partial<Scope>,
) => run(src, scopeOf(values, extra));

describe('language', () => {
  it('has the JavaScript operators and precedence', () => {
    expect(val('2 ** 3 ** 2').value).toBe(512);
    expect(val('-2 ** 2').value).toBe(4);
    expect(val('(-2) ** 2').value).toBe(4);
    expect(val('10 % 4 + 1').value).toBe(3);
    expect(val('null ?? "fallback"').value).toBe('fallback');
    expect(val('0 ?? "x"').value).toBe(0);
    expect(val('1 === 1 && 1 !== 2').value).toBe(true);
    expect(val('+"a"').error).toMatch(/Plus/);
  });

  it('reads members, indexes and projects over lists', () => {
    const o: Value = {
      name: 'Anna',
      tags: ['a', 'b'],
      rows: [{ x: 1 }, { x: 2 }, { y: 3 }],
    };
    expect(val('o.name', { o }).value).toBe('Anna');
    expect(val('o.tags[1]', { o }).value).toBe('b');
    expect(val('o.tags.length', { o }).value).toBe(2);
    expect(val('o["name"]', { o }).value).toBe('Anna');
    expect(val('o.missing', { o }).value).toBeNull();
    expect(val('o.rows.x', { o }).value).toEqual([1, 2, null]);
    expect(val('sum(o.rows.x)', { o }).value).toBe(3);
    expect(val('count(o.rows.x)', { o }).value).toBe(2);
  });

  it('has the Excel aliases in any case, with lazy IF, AND, OR and IFERROR', () => {
    expect(val('IF(1 > 2, "a", "b")').value).toBe('b');
    expect(val('if(true, 1, missing)').value).toBe(1);
    expect(val('IF(false, 1)').value).toBeNull();
    expect(val('AND(true, 2 > 1)').value).toBe(true);
    expect(val('and(false, missing)').value).toBe(false);
    expect(val('OR(true, missing)').value).toBe(true);
    expect(val('IFERROR(1 / 0, "none")').value).toBe('none');
    expect(val('IFERROR(5, "none")').value).toBe(5);
    expect(val('SUM(1, [2, 3], 4)').value).toBe(10);
    expect(val('AVERAGE(2, 4)').value).toBe(3);
    expect(val('MAX(1, 9, 3) + MIN(4, 2)').value).toBe(11);
    expect(val('CEILING(1.2) + FLOOR(1.8)').value).toBe(3);
    expect(val('ROUND(2.345, 2)').value).toBe(2.35);
    expect(val('UPPER("a") + LOWER("B") + TRIM("  c ")').value).toBe('Abc');
    expect(val('ISBLANK("")').value).toBe(true);
    expect(val('VALUE("12")').value).toBe(12);
    expect(val('NOT(false)').value).toBe(true);
    expect(val('CONCAT("a", ["b", "c"])').value).toBe('abc');
  });

  it('knows dates', () => {
    expect(val('today()').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(val('daysBetween("2026-10-01", "2026-10-08")').value).toBe(7);
    expect(val('addDays("2026-10-30", 3)').value).toBe('2026-11-02');
    expect(val('addDays("nope", 3)').error).toMatch(/date/);
  });

  it('asks the host for functions it does not have', () => {
    const call = (name: string, args: Value[]) =>
      name === 'objects'
        ? ['el_1', 'el_2']
        : name === 'double'
          ? (args[0] as number) * 2
          : undefined;
    expect(val('count(objects("Task"))', {}, { call }).value).toBe(2);
    expect(val('DOUBLE(4)', {}, { call }).value).toBe(8);
    expect(val('nothing(1)', {}, { call }).error).toMatch(/no function/);
  });

  it('takes the plan examples', () => {
    expect(
      val("Priority == 'High' && Owner == null", {
        Priority: 'High',
        Owner: null,
      }).value,
    ).toBe(true);
    expect(
      val("'Task \"' + Name + '\" is high priority.'", { Name: 'Pay' }).value,
    ).toBe('Task "Pay" is high priority.');
    expect(val('Effort * 85', { Effort: 3 }).value).toBe(255);
    expect(val("Effort ? Effort + ' h' : ''", { Effort: 2 }).value).toBe('2 h');
  });
});

describe('errors', () => {
  it('give codes and plain messages, never exceptions', () => {
    expect(val('Nope')).toMatchObject({ code: 'name', value: null });
    expect(val('1 +')).toMatchObject({ code: 'syntax' });
    expect(val('1 / 0')).toMatchObject({ code: 'zero' });
    expect(val('"a" - 1')).toMatchObject({ code: 'type' });
    expect(val('frob()')).toMatchObject({ code: 'name' });
  });
});

describe('hostile input', () => {
  const code = (src: string, values: Record<string, Value> = {}) =>
    val(src, values).code;

  it('limits nesting, length, chains, lists and text', () => {
    expect(code('('.repeat(1000) + '1' + ')'.repeat(1000))).toBe('limit');
    expect(code('('.repeat(5000))).toBe('limit');
    expect(code('-'.repeat(3000) + '1')).toBe('limit');
    expect(code('!'.repeat(3000) + '1')).toBe('limit');
    expect(code('['.repeat(3000))).toBe('limit');
    expect(code('f('.repeat(3000))).toBe('limit');
    expect(code(Array(1500).fill('1').join('+'))).toBe('limit');
    expect(code('1'.repeat(LIMITS.sourceLength + 1))).toBe('limit');
    expect(code(`"${'a'.repeat(LIMITS.stringLength + 1)}"`)).toBe('limit');
    expect(val(Array(990).fill('1').join('+')).value).toBe(990);
    expect(val('('.repeat(99) + '1' + ')'.repeat(99)).value).toBe(1);
  });

  it('limits the size of what a formula builds', () => {
    const s = 'x'.repeat(50_001);
    expect(code('s + s + s', { s })).toBe('limit');
    expect(code('upper(s + s)', { s })).toBe('limit');
    expect(code('join([s, s], "")', { s })).toBe('limit');
  });

  it('forbids the ways into the prototype chain and refuses everything that is not an expression', () => {
    const a: Value = { x: 1 };
    for (const src of [
      '__proto__',
      'a.__proto__',
      'a.constructor',
      'a.constructor.constructor',
      'a["constructor"]',
      'a.prototype',
    ])
      expect(val(src, { a }).code, src).toBe('forbidden');
    for (const src of [
      'toString',
      'hasOwnProperty',
      'valueOf()',
      'a.hasOwnProperty',
    ])
      expect(['name', undefined], src).toContain(val(src, { a }).code);
    for (const src of [
      's.toUpperCase()',
      'new Date()',
      'a = 1',
      '() => 1',
      'function(){}',
      '`x`',
      'a;b',
      'import("x")',
      'globalThis',
      'window',
      'process',
      'eval("1")',
      'Function("return 1")()',
      'require("fs")',
    ])
      expect(val(src, { a, s: 'x' }).error, src).toBeTruthy();
  });

  it('never throws, whatever it is given', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_ +\-*/%<>=!&|?:.,()[\]"'$]{0,80}$/),
        (src) => {
          const r = val(src, { a: 1, b: 'x' });
          expect(r).toHaveProperty('value');
        },
      ),
      { numRuns: 3000 },
    );
  });

  it('stays fast on deep input', () => {
    const t = Date.now();
    for (let i = 0; i < 50; i++) val('('.repeat(90) + '1' + ')'.repeat(90));
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
