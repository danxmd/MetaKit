import { describe, expect, it } from 'vitest';
import {
  FormulaError,
  LIMITS,
  compile,
  dependencies,
  evaluate,
  parse,
} from './formula';

const fails = (source: string, scope = {}) => {
  try {
    evaluate(source, scope);
  } catch (e) {
    if (e instanceof FormulaError) return e;
    throw e;
  }
  throw new Error(`"${source.slice(0, 40)}" did not fail`);
};

describe('evaluation', () => {
  it('follows JavaScript operator precedence', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7);
    expect(evaluate('(1 + 2) * 3')).toBe(9);
    expect(evaluate('2 ** 3 ** 2')).toBe(512);
    expect(evaluate('(-2) ** 2')).toBe(4);
    expect(evaluate('10 % 4 + 1')).toBe(3);
    expect(evaluate('1 < 2 && 2 < 3')).toBe(true);
    expect(evaluate('null ?? "fallback"')).toBe('fallback');
  });

  it('reads attribute keys and nested data', () => {
    const scope = {
      cost: 40,
      qty: 3,
      owner: { name: 'Anna', tags: ['a', 'b'] },
    };
    expect(evaluate('cost * qty', scope)).toBe(120);
    expect(evaluate('owner.name', scope)).toBe('Anna');
    expect(evaluate('owner.tags[1]', scope)).toBe('b');
    expect(evaluate('owner.tags.length', scope)).toBe(2);
    expect(evaluate('owner.missing', scope)).toBeNull();
  });

  it('supports ternary and the Excel aliases', () => {
    const scope = { priority: 'High', cost: 120 };
    expect(evaluate('priority == "High" ? "urgent" : "normal"', scope)).toBe(
      'urgent',
    );
    expect(evaluate('IF(cost > 100, "big", "small")', scope)).toBe('big');
    expect(evaluate('SUM(1, 2, 3)')).toBe(6);
    expect(evaluate('SUM([1, 2], 3)')).toBe(6);
    expect(evaluate('AND(true, cost > 100)', scope)).toBe(true);
    expect(evaluate('OR(false, cost < 100)', scope)).toBe(false);
  });

  it('evaluates only the branch it takes', () => {
    expect(evaluate('IF(true, 1, missing)')).toBe(1);
    expect(evaluate('false && missing')).toBe(false);
    expect(evaluate('true || missing')).toBe(true);
    expect(fails('IF(false, 1, missing)').code).toBe('name');
  });

  it('has helper functions', () => {
    expect(evaluate('round(3.14159, 2)')).toBe(3.14);
    expect(evaluate('upper(trim("  ab "))')).toBe('AB');
    expect(evaluate('concat("a", 1, "b")')).toBe('a1b');
    expect(evaluate('max(1, 5, 3) - min(4, 2)')).toBe(3);
    expect(evaluate('coalesce(null, "", "x")')).toBe('x');
    expect(evaluate('len("abc") + count([1, null, 2])')).toBe(5);
    expect(evaluate('join(["a", "b"], "-")')).toBe('a-b');
    expect(evaluate('isEmpty("") && !isEmpty("x")')).toBe(true);
  });

  it('compares strictly and refuses silent coercion', () => {
    expect(evaluate('1 == "1"')).toBe(false);
    expect(fails('"a" - 1').code).toBe('type');
    expect(fails('1 < "2"').code).toBe('type');
  });

  it('reports unknown names and functions with a position', () => {
    const name = fails('1 + nope');
    expect(name.code).toBe('name');
    expect(name.position).toBe(4);
    expect(fails('nope(1)').code).toBe('name');
  });

  it('reports syntax errors', () => {
    for (const source of [
      '1 +',
      '(1',
      'a b',
      '"open',
      '1 @ 2',
      'IF(',
      '[1,',
      'a.',
    ]) {
      expect(fails(source, { a: {} }).code).toBe('syntax');
    }
  });
});

describe('dependencies', () => {
  it('lists attribute keys, not functions, and includes untaken branches', () => {
    const f = compile(
      'IF(priority == "High", cost * qty, owner.name) + SUM(a, b[0])',
    );
    expect(f.dependencies).toEqual([
      'a',
      'b',
      'cost',
      'owner',
      'priority',
      'qty',
    ]);
  });

  it('is empty for constants', () => {
    expect(dependencies(parse('1 + 2 * round(3.5)'))).toEqual([]);
  });

  it('does not change with the data', () => {
    const f = compile('flag ? a : b');
    expect(f.dependencies).toEqual(['a', 'b', 'flag']);
    expect(f.evaluate({ flag: true, a: 1, b: 2 })).toBe(1);
    expect(f.evaluate({ flag: false, a: 1, b: 2 })).toBe(2);
  });
});

describe('hostile input', () => {
  it('rejects deep nesting without overflowing the stack', () => {
    expect(fails(`${'('.repeat(1000)}1${')'.repeat(1000)}`).code).toBe('limit');
    expect(fails(`${'('.repeat(9000)}1${')'.repeat(9000)}`).code).toBe('limit');
    // Nesting up to the limit is fine.
    expect(evaluate(`${'('.repeat(99)}1${')'.repeat(99)}`)).toBe(1);
    expect(fails('('.repeat(5000)).code).toBe('limit');
    expect(fails(`${'-'.repeat(3000)}1`).code).toBe('limit');
    expect(fails(`${'!'.repeat(3000)}true`).code).toBe('limit');
    expect(fails(`${'['.repeat(3000)}${']'.repeat(3000)}`).code).toBe('limit');
    expect(fails(`${'f('.repeat(3000)}${')'.repeat(3000)}`).code).toBe('limit');
  });

  it('rejects long operator chains and huge formulas', () => {
    expect(fails(Array(1500).fill('1').join('+')).code).toBe('limit');
    // A long but sensible sum is fine.
    expect(evaluate(Array(300).fill('1').join('+'))).toBe(300);
    // The deepest tree the limits allow still evaluates without touching the stack limit.
    expect(evaluate(Array(990).fill('1').join('+'))).toBe(990);
    expect(fails('1+'.repeat(6000) + '1').code).toBe('limit');
    expect(fails(`"${'a'.repeat(LIMITS.sourceLength)}"`).code).toBe('limit');
    expect(fails(`[${Array(3000).fill('1').join(',')}]`).code).toBe('limit');
  });

  it('blocks prototype access in every form', () => {
    const scope = { a: {}, s: 'text', arr: [1] };
    for (const source of [
      '__proto__',
      'a.__proto__',
      'a.constructor',
      'a.constructor.constructor',
      'a["constructor"]',
      'a["__proto__"]',
      's.constructor',
      'arr.constructor',
      'a.prototype',
    ]) {
      expect(fails(source, scope).code, source).toBe('forbidden');
    }
  });

  it('does not see inherited properties of the scope or of data', () => {
    expect(fails('toString').code).toBe('name');
    expect(fails('hasOwnProperty').code).toBe('name');
    expect(evaluate('a.toString', { a: {} })).toBeNull();
    expect(fails('valueOf()').code).toBe('name');
  });

  it('refuses methods, new, assignment, functions and templates', () => {
    expect(fails('s.toUpperCase()', { s: 'x' }).code).toBe('forbidden');
    for (const source of [
      'new Date()',
      'a = 1',
      '() => 1',
      'function(){}',
      '`x`',
      'a;b',
      'import("x")',
    ]) {
      expect(() => evaluate(source, { a: 1 }), source).toThrow(FormulaError);
    }
  });

  it('cannot reach globals', () => {
    for (const source of [
      'globalThis',
      'window',
      'process',
      'eval("1")',
      'Function("return 1")()',
      'require("fs")',
    ]) {
      expect(() => evaluate(source), source).toThrow(FormulaError);
    }
  });

  it('limits string size, in literals and in results', () => {
    const half = 'a'.repeat(LIMITS.stringLength / 2 + 1);
    expect(fails('s + s + s', { s: half }).code).toBe('limit');
    expect(fails('upper(s + s)', { s: half }).code).toBe('limit');
    expect(fails('join([s, s], "")', { s: half }).code).toBe('limit');
    expect(fails(`"${'a'.repeat(LIMITS.stringLength + 1)}"`).code).toBe(
      'limit',
    );
  });

  it('stays fast on pathological but legal input', () => {
    const started = performance.now();
    for (let i = 0; i < 50; i++) {
      fails('('.repeat(90) + '1' + ')'.repeat(89));
      evaluate('('.repeat(90) + '1' + ')'.repeat(90));
    }
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('survives random garbage without anything but FormulaError', () => {
    let seed = 12345;
    const rand = () =>
      (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const alphabet = '()[]{}+-*/%<>=!&|?:,.\'" 0123456789abcXYZ_$;`@#';
    for (let i = 0; i < 3000; i++) {
      const source = Array.from(
        { length: Math.floor(rand() * 40) },
        () => alphabet[Math.floor(rand() * alphabet.length)],
      ).join('');
      try {
        evaluate(source, { a: 1, b: 'x', c: [1, 2] });
      } catch (e) {
        expect(e).toBeInstanceOf(FormulaError);
      }
    }
  });
});
