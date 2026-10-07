import { LIMITS, type FormulaErrorCode } from './lexer';
import { FORBIDDEN_KEYS, type Expr } from './parser';

export type Value =
  null | boolean | number | string | Value[] | { [key: string]: Value };

/** What a formula can look at. `get` returns undefined for a name that does not exist. */
export interface Scope {
  get(name: string): Value | undefined;
  /** Follows `.key` on a value; undefined means "not mine", and the engine reads plain objects itself. */
  member?(value: Value, key: string): Value | undefined;
  /**
   * Answers a function the engine does not have, such as `objects("Task")`. Return undefined when
   * the host does not know the function either.
   */
  call?(name: string, args: Value[]): Value | undefined;
}

export interface EvalResult {
  value: Value;
  /** Names looked up while evaluating, in order of first use. */
  reads: string[];
  /** The first problem found, in plain English; the value is null when there is one. */
  error?: string;
  code?: FormulaErrorCode;
}

class EvalError extends Error {
  constructor(
    message: string,
    readonly code: FormulaErrorCode = 'type',
  ) {
    super(message);
  }
}

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

function checkText(s: string): string {
  if (s.length > LIMITS.stringLength)
    throw new EvalError(
      `A text longer than ${LIMITS.stringLength} characters is not allowed.`,
      'limit',
    );
  return s;
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

function describe(v: Value): string {
  if (v === null) return 'an empty value';
  if (Array.isArray(v)) return 'a list';
  return typeof v === 'object' ? 'a record' : `${typeof v} "${toText(v)}"`;
}

function num(v: Value | undefined, what: string): number {
  if (typeof v === 'number') return v;
  throw new EvalError(`${what} needs a number, not ${describe(v ?? null)}.`);
}

/** Numbers from arguments, with lists flattened; empty values are skipped like blank cells. */
function numbers(args: Value[], what: string): number[] {
  const out: number[] = [];
  const visit = (v: Value) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v !== null && v !== '') out.push(num(v, what));
  };
  args.forEach(visit);
  return out;
}

function flat(args: Value[]): Value[] {
  const out: Value[] = [];
  const visit = (v: Value) =>
    Array.isArray(v) ? v.forEach(visit) : out.push(v);
  args.forEach(visit);
  return out;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(v: Value | undefined, what: string): number {
  const text = toText(v ?? null);
  const t = Date.parse(text.length === 10 ? `${text}T00:00:00Z` : text);
  if (Number.isNaN(t))
    throw new EvalError(
      `${what} needs a date such as 2026-10-07, not "${text}".`,
    );
  return t;
}

type Fn = (args: Value[]) => Value;

/** Functions with Excel names and the helpers of the plan; names are matched in lower case. */
const FUNCTIONS: Record<string, Fn> = {
  sum: (a) => numbers(a, 'sum').reduce((x, y) => x + y, 0),
  min: (a) => {
    const n = numbers(a, 'min');
    return n.length === 0 ? null : Math.min(...n);
  },
  max: (a) => {
    const n = numbers(a, 'max');
    return n.length === 0 ? null : Math.max(...n);
  },
  avg: (a) => {
    const n = numbers(a, 'avg');
    return n.length === 0 ? null : n.reduce((x, y) => x + y, 0) / n.length;
  },
  count: (a) => flat(a).filter((v) => v !== null && v !== '').length,
  abs: ([x]) => Math.abs(num(x, 'abs')),
  floor: ([x]) => Math.floor(num(x, 'floor')),
  ceil: ([x]) => Math.ceil(num(x, 'ceil')),
  round: ([x, d]) => {
    const f =
      10 ** Math.min(15, Math.max(0, d === undefined ? 0 : num(d, 'round')));
    return Math.round(num(x, 'round') * f) / f;
  },
  len: ([x]) => {
    if (typeof x === 'string' || Array.isArray(x)) return x.length;
    if (x === null || x === undefined) return 0;
    throw new EvalError('len needs text or a list.');
  },
  upper: ([x]) => checkText(toText(x ?? null).toUpperCase()),
  lower: ([x]) => checkText(toText(x ?? null).toLowerCase()),
  trim: ([x]) => toText(x ?? null).trim(),
  concat: (a) => checkText(flat(a).map(toText).join('')),
  join: ([list, sep]) => {
    if (!Array.isArray(list)) throw new EvalError('join needs a list.');
    return checkText(
      list.map(toText).join(sep === undefined ? ', ' : toText(sep)),
    );
  },
  contains: ([a, b]) => toText(a ?? null).includes(toText(b ?? null)),
  startswith: ([a, b]) => toText(a ?? null).startsWith(toText(b ?? null)),
  endswith: ([a, b]) => toText(a ?? null).endsWith(toText(b ?? null)),
  isempty: ([x]) =>
    x === null ||
    x === undefined ||
    x === '' ||
    (Array.isArray(x) && x.length === 0),
  number: ([x]) => {
    const n = typeof x === 'number' ? x : Number(toText(x ?? null).trim());
    return Number.isFinite(n) && toText(x ?? null).trim() !== '' ? n : null;
  },
  text: ([x]) => checkText(toText(x ?? null)),
  str: ([x]) => checkText(toText(x ?? null)),
  num: (a) => FUNCTIONS.number!(a),
  coalesce: (a) => a.find((v) => v !== null && v !== '') ?? null,
  not: ([x]) => !truthy(x ?? null),
  today: () => isoDay(new Date()),
  now: () => new Date().toISOString(),
  daysbetween: ([a, b]) =>
    Math.round(
      (parseDay(b, 'daysBetween') - parseDay(a, 'daysBetween')) / 86_400_000,
    ),
  adddays: ([d, n]) =>
    isoDay(new Date(parseDay(d, 'addDays') + num(n, 'addDays') * 86_400_000)),
  // The action a click or a rule runs; the app decides what "open" means for its target.
  open: ([target]) => ({ action: 'open', target: target ?? null }),
};

/** Excel names for functions that exist under another name here. */
const ALIASES: Record<string, string> = {
  average: 'avg',
  ceiling: 'ceil',
  isblank: 'isempty',
  value: 'number',
  counta: 'count',
};

/** Functions that evaluate only the arguments they need. */
const LAZY = new Set(['if', 'and', 'or', 'iferror']);

/** The names of the functions a formula may call, for completion. */
export const FUNCTION_NAMES: readonly string[] = [
  ...new Set([
    'IF',
    'AND',
    'OR',
    'IFERROR',
    ...Object.keys(FUNCTIONS).map((n) => n.toLowerCase()),
    ...Object.keys(ALIASES),
    'objects',
    'incoming',
    'outgoing',
    'children',
  ]),
];

export function isKnownFunction(name: string): boolean {
  const n = name.toLowerCase();
  return (
    LAZY.has(n) || Object.hasOwn(FUNCTIONS, n) || Object.hasOwn(ALIASES, n)
  );
}

/** Evaluates a parsed formula. It never throws: a problem gives a null value, a message and a code. */
export function evaluate(expr: Expr, scope: Scope): EvalResult {
  const reads: string[] = [];
  const seen = new Set<string>();
  let steps = 0;
  const lookup = (name: string): Value => {
    if (!seen.has(name)) {
      seen.add(name);
      reads.push(name);
    }
    const v = scope.get(name);
    if (v === undefined)
      throw new EvalError(`"${name}" is not known here.`, 'name');
    return v;
  };
  const member = (v: Value, key: string): Value => {
    if (FORBIDDEN_KEYS.has(key))
      throw new EvalError(`"${key}" cannot be used in a formula.`, 'forbidden');
    if (v === null) return null;
    if (Array.isArray(v)) {
      if (key === 'length') return v.length;
      // `list.Key` reads Key from every item, so sum(objects("Task").Effort) works.
      return v.map((item) => member(item, key));
    }
    const m = scope.member?.(v, key);
    if (m !== undefined) return m;
    if (typeof v === 'object') return Object.hasOwn(v, key) ? v[key]! : null;
    if (typeof v === 'string' && key === 'length') return v.length;
    return null;
  };
  const go = (e: Expr): Value => {
    if (++steps > LIMITS.steps)
      throw new EvalError('This formula takes too many steps.', 'limit');
    switch (e.k) {
      case 'num':
      case 'str':
      case 'bool':
        return e.v;
      case 'null':
        return null;
      case 'list': {
        if (e.items.length > LIMITS.arrayLength)
          throw new EvalError('This list is too long.', 'limit');
        return e.items.map(go);
      }
      case 'name':
        return lookup(e.name);
      case 'member':
        return member(go(e.obj), e.key);
      case 'index': {
        const obj = go(e.obj);
        const i = go(e.index);
        if (Array.isArray(obj))
          return typeof i === 'number' ? (obj[i] ?? null) : null;
        if (typeof i === 'string') return member(obj, i);
        return null;
      }
      case 'call':
        return call(e);
      case 'unary': {
        const v = go(e.arg);
        if (e.op === '!') return !truthy(v);
        return e.op === '-' ? -num(v, 'Minus') : num(v, 'Plus');
      }
      case 'cond':
        return truthy(go(e.test)) ? go(e.a) : go(e.b);
      case 'binary':
        return binary(e);
    }
  };
  const call = (e: Extract<Expr, { k: 'call' }>): Value => {
    const raw = e.fn.toLowerCase();
    const name = ALIASES[raw] ?? raw;
    if (LAZY.has(name)) {
      switch (name) {
        case 'if': {
          if (e.args.length < 2)
            throw new EvalError('IF needs a condition and a value.');
          return truthy(go(e.args[0]!))
            ? go(e.args[1]!)
            : e.args[2]
              ? go(e.args[2])
              : null;
        }
        case 'and':
          for (const a of e.args) if (!truthy(go(a))) return false;
          return true;
        case 'or':
          for (const a of e.args) if (truthy(go(a))) return true;
          return false;
        default: {
          // IFERROR(value, fallback): the fallback is used when the value gives a problem.
          try {
            return go(e.args[0]!);
          } catch (error) {
            if (error instanceof EvalError && error.code !== 'limit')
              return e.args[1] ? go(e.args[1]) : null;
            throw error;
          }
        }
      }
    }
    const args = e.args.map(go);
    if (Object.hasOwn(FUNCTIONS, name)) return FUNCTIONS[name]!(args);
    const hosted = scope.call?.(name, args);
    if (hosted !== undefined) return hosted;
    throw new EvalError(`There is no function "${e.fn}".`, 'name');
  };
  const binary = (e: Extract<Expr, { k: 'binary' }>): Value => {
    if (e.op === '&&') {
      const l = go(e.l);
      return truthy(l) ? go(e.r) : l;
    }
    if (e.op === '||') {
      const l = go(e.l);
      return truthy(l) ? l : go(e.r);
    }
    if (e.op === '??') {
      const l = go(e.l);
      return l === null ? go(e.r) : l;
    }
    const l = go(e.l);
    const r = go(e.r);
    switch (e.op) {
      case '==':
      case '===':
        return equal(l, r);
      case '!=':
      case '!==':
        return !equal(l, r);
      case '+':
        if (typeof l === 'string' || typeof r === 'string')
          return checkText(toText(l) + toText(r));
        return num(l, 'Plus') + num(r, 'Plus');
      case '-':
        return num(l, 'Minus') - num(r, 'Minus');
      case '*':
        return num(l, 'Times') * num(r, 'Times');
      case '**':
        return num(l, 'Power') ** num(r, 'Power');
      case '/': {
        const d = num(r, 'Divide');
        if (d === 0) throw new EvalError('Division by zero.', 'zero');
        return num(l, 'Divide') / d;
      }
      case '%': {
        const d = num(r, 'Remainder');
        if (d === 0) throw new EvalError('Division by zero.', 'zero');
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
  };
  try {
    return { value: go(expr), reads };
  } catch (error) {
    if (error instanceof EvalError)
      return { value: null, reads, error: error.message, code: error.code };
    if (error instanceof RangeError)
      return {
        value: null,
        reads,
        error: 'This formula is too deep to evaluate.',
        code: 'limit',
      };
    throw error;
  }
}
