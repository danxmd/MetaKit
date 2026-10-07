import type { Expr } from './parser';

export type Value =
  null | boolean | number | string | Value[] | { [key: string]: Value };

/** What a formula can look at. `get` returns undefined for a name that does not exist. */
export interface Scope {
  get(name: string): Value | undefined;
  /** Follows `.key` on a value; the default reads a property of a plain object. */
  member?(value: Value, key: string): Value | undefined;
}

export interface EvalResult {
  value: Value;
  /** Names looked up while evaluating, in order of first use. */
  reads: string[];
  /** The first problem found, in plain English; the value is null when there is one. */
  error?: string;
}

class EvalError extends Error {}

export function truthy(v: Value): boolean {
  if (v === null || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function toText(v: Value): string {
  if (v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number')
    return Number.isInteger(v)
      ? String(v)
      : String(Math.round(v * 1e10) / 1e10);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return v.map(toText).join(', ');
  return JSON.stringify(v);
}

function equal(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => equal(x, b[i]!));
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ka = Object.keys(a);
    return (
      ka.length === Object.keys(b).length &&
      ka.every((k) => equal(a[k]!, b[k]!))
    );
  }
  return false;
}

function num(v: Value, what: string): number {
  if (typeof v === 'number') return v;
  throw new EvalError(`${what} needs a number, not ${describe(v)}.`);
}

function describe(v: Value): string {
  if (v === null) return 'an empty value';
  if (Array.isArray(v)) return 'a list';
  return typeof v === 'object' ? 'a record' : `${typeof v} "${toText(v)}"`;
}

type Fn = (args: Value[]) => Value;

const FUNCTIONS: Record<string, Fn> = {
  round: ([x, d]) => {
    const f = 10 ** (d === undefined ? 0 : num(d, 'round'));
    return Math.round(num(x ?? null, 'round') * f) / f;
  },
  floor: ([x]) => Math.floor(num(x ?? null, 'floor')),
  ceil: ([x]) => Math.ceil(num(x ?? null, 'ceil')),
  abs: ([x]) => Math.abs(num(x ?? null, 'abs')),
  min: (args) => Math.min(...args.map((a) => num(a, 'min'))),
  max: (args) => Math.max(...args.map((a) => num(a, 'max'))),
  len: ([x]) =>
    typeof x === 'string' || Array.isArray(x) ? x.length : x == null ? 0 : 1,
  upper: ([x]) => toText(x ?? null).toUpperCase(),
  lower: ([x]) => toText(x ?? null).toLowerCase(),
  trim: ([x]) => toText(x ?? null).trim(),
  str: ([x]) => toText(x ?? null),
  num: ([x]) => {
    const n = typeof x === 'number' ? x : Number(toText(x ?? null));
    return Number.isFinite(n) ? n : null;
  },
  contains: ([a, b]) => toText(a ?? null).includes(toText(b ?? null)),
  join: ([list, sep]) =>
    (Array.isArray(list) ? list : [])
      .map(toText)
      .join(sep == null ? ', ' : toText(sep)),
  coalesce: (args) => args.find((a) => a !== null && a !== '') ?? null,
  // The action a click runs; the app decides what "open" means for its target.
  open: ([target]) => ({ action: 'open', target: target ?? null }),
};

export const FUNCTION_NAMES: readonly string[] = Object.keys(FUNCTIONS);

/** Evaluates a parsed formula. It never throws: a problem gives a null value and a message. */
export function evaluate(expr: Expr, scope: Scope): EvalResult {
  const reads: string[] = [];
  const seen = new Set<string>();
  const lookup = (name: string): Value => {
    if (!seen.has(name)) {
      seen.add(name);
      reads.push(name);
    }
    const v = scope.get(name);
    if (v === undefined) throw new EvalError(`"${name}" is not known here.`);
    return v;
  };
  const member = (v: Value, key: string): Value => {
    if (v === null) return null;
    const m = scope.member?.(v, key);
    if (m !== undefined) return m;
    if (typeof v === 'object' && !Array.isArray(v)) return v[key] ?? null;
    return null;
  };
  const go = (e: Expr): Value => {
    switch (e.k) {
      case 'num':
      case 'str':
      case 'bool':
        return e.v;
      case 'null':
        return null;
      case 'list':
        return e.items.map(go);
      case 'name':
        return lookup(e.name);
      case 'member':
        return member(go(e.obj), e.key);
      case 'call': {
        const fn = FUNCTIONS[e.fn];
        if (!fn) throw new EvalError(`There is no function "${e.fn}".`);
        return fn(e.args.map(go));
      }
      case 'unary':
        return e.op === '!' ? !truthy(go(e.arg)) : -num(go(e.arg), 'Minus');
      case 'cond':
        return truthy(go(e.test)) ? go(e.a) : go(e.b);
      case 'binary': {
        if (e.op === '&&') {
          const l = go(e.l);
          return truthy(l) ? go(e.r) : l;
        }
        if (e.op === '||') {
          const l = go(e.l);
          return truthy(l) ? l : go(e.r);
        }
        const l = go(e.l);
        const r = go(e.r);
        switch (e.op) {
          case '==':
            return equal(l, r);
          case '!=':
            return !equal(l, r);
          case '+':
            if (typeof l === 'string' || typeof r === 'string')
              return toText(l) + toText(r);
            return num(l, 'Plus') + num(r, 'Plus');
          case '-':
            return num(l, 'Minus') - num(r, 'Minus');
          case '*':
            return num(l, 'Times') * num(r, 'Times');
          case '/': {
            const d = num(r, 'Divide');
            if (d === 0) throw new EvalError('Division by zero.');
            return num(l, 'Divide') / d;
          }
          case '%': {
            const d = num(r, 'Remainder');
            if (d === 0) throw new EvalError('Division by zero.');
            return num(l, 'Remainder') % d;
          }
          default: {
            // Comparisons: numbers with numbers, text with text; anything else is false.
            const ok =
              (typeof l === 'number' && typeof r === 'number') ||
              (typeof l === 'string' && typeof r === 'string');
            if (!ok) return false;
            const a = l as number | string;
            const b = r as number | string;
            return e.op === '<'
              ? a < b
              : e.op === '<='
                ? a <= b
                : e.op === '>'
                  ? a > b
                  : a >= b;
          }
        }
      }
    }
  };
  try {
    return { value: go(expr), reads };
  } catch (error) {
    if (error instanceof EvalError)
      return { value: null, reads, error: error.message };
    throw error;
  }
}
