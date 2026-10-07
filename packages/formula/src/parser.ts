import {
  FormulaSyntaxError,
  LIMITS,
  tokenize,
  type FormulaErrorCode,
  type Token,
} from './lexer';

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'null' }
  | { k: 'list'; items: Expr[] }
  | { k: 'name'; name: string }
  | { k: 'member'; obj: Expr; key: string }
  | { k: 'index'; obj: Expr; index: Expr }
  | { k: 'call'; fn: string; args: Expr[] }
  | { k: 'unary'; op: '!' | '-' | '+'; arg: Expr }
  | { k: 'binary'; op: string; l: Expr; r: Expr }
  | { k: 'cond'; test: Expr; a: Expr; b: Expr };

export type ParseResult =
  | { ok: true; expr: Expr }
  | { ok: false; error: string; at: number; code: FormulaErrorCode };

/** Lowest precedence first. `**` is handled apart because it binds to the right. */
const BINARY_LEVELS: string[][] = [
  ['??'],
  ['||'],
  ['&&'],
  ['==', '!=', '===', '!=='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/', '%'],
];

export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

class Parser {
  private pos = 0;
  private depth = 0;
  private nodes = 0;
  constructor(private readonly tokens: Token[]) {}

  private get tok(): Token {
    return this.tokens[this.pos]!;
  }

  private isOp(text: string): boolean {
    return this.tok.kind === 'op' && this.tok.text === text;
  }

  private fail(
    message: string,
    at: number,
    code: FormulaErrorCode = 'syntax',
  ): never {
    throw new FormulaSyntaxError(message, at, code);
  }

  private expect(text: string): void {
    if (!this.isOp(text))
      this.fail(
        `Expected "${text}" but found ${this.describe()}.`,
        this.tok.start,
      );
    this.pos++;
  }

  private describe(): string {
    return this.tok.kind === 'end' ? 'the end' : `"${this.tok.text}"`;
  }

  private node<T extends Expr>(e: T): T {
    if (++this.nodes > LIMITS.nodes)
      this.fail(
        `This formula has more than ${LIMITS.nodes} parts.`,
        this.tok.start,
        'limit',
      );
    return e;
  }

  private nested<T>(run: () => T): T {
    if (++this.depth > LIMITS.depth)
      this.fail(
        `This formula is nested more than ${LIMITS.depth} levels deep.`,
        this.tok.start,
        'limit',
      );
    try {
      return run();
    } finally {
      this.depth--;
    }
  }

  parse(): Expr {
    const expr = this.conditional();
    if (this.tok.kind !== 'end')
      this.fail(`Unexpected ${this.describe()}.`, this.tok.start);
    return expr;
  }

  private conditional(): Expr {
    return this.nested(() => {
      const test = this.binary(0);
      if (!this.isOp('?')) return test;
      this.pos++;
      const a = this.conditional();
      this.expect(':');
      const b = this.conditional();
      return this.node({ k: 'cond', test, a, b });
    });
  }

  private binary(level: number): Expr {
    if (level >= BINARY_LEVELS.length) return this.power();
    let left = this.binary(level + 1);
    let chain = 0;
    while (
      this.tok.kind === 'op' &&
      BINARY_LEVELS[level]!.includes(this.tok.text)
    ) {
      if (++chain > LIMITS.chain)
        this.fail(
          `More than ${LIMITS.chain} operators in a row.`,
          this.tok.start,
          'limit',
        );
      const op = this.tok.text;
      this.pos++;
      left = this.node({ k: 'binary', op, l: left, r: this.binary(level + 1) });
    }
    return left;
  }

  /** `a ** b ** c` is `a ** (b ** c)`; a minus in front of the base binds first, as in Excel. */
  private power(): Expr {
    const base = this.unary();
    if (!this.isOp('**')) return base;
    this.pos++;
    return this.node({
      k: 'binary',
      op: '**',
      l: base,
      r: this.nested(() => this.power()),
    });
  }

  private unary(): Expr {
    if (this.isOp('!') || this.isOp('-') || this.isOp('+')) {
      const op = this.tok.text as '!' | '-' | '+';
      this.pos++;
      return this.nested(() =>
        this.node({ k: 'unary', op, arg: this.unary() }),
      );
    }
    return this.postfix();
  }

  private postfix(): Expr {
    let expr = this.primary();
    for (;;) {
      if (this.isOp('.')) {
        this.pos++;
        if (this.tok.kind !== 'name')
          this.fail(
            `Expected a name after "." but found ${this.describe()}.`,
            this.tok.start,
          );
        const key = this.tok.text;
        if (FORBIDDEN_KEYS.has(key))
          this.fail(
            `"${key}" cannot be used in a formula.`,
            this.tok.start,
            'forbidden',
          );
        const at = this.tok.start;
        this.pos++;
        if (this.isOp('('))
          this.fail(
            `Methods cannot be called here; use a function such as upper(text) instead of text.${key}().`,
            at,
            'forbidden',
          );
        expr = this.node({ k: 'member', obj: expr, key });
      } else if (this.isOp('[')) {
        this.pos++;
        const index = this.conditional();
        this.expect(']');
        expr = this.node({ k: 'index', obj: expr, index });
      } else return expr;
    }
  }

  private args(close: string): Expr[] {
    const out: Expr[] = [];
    if (!this.isOp(close)) {
      do {
        if (out.length >= LIMITS.arrayLength)
          this.fail(
            `More than ${LIMITS.arrayLength} items in a list.`,
            this.tok.start,
            'limit',
          );
        out.push(this.conditional());
      } while (this.isOp(',') && ++this.pos);
    }
    this.expect(close);
    return out;
  }

  private primary(): Expr {
    const t = this.tok;
    if (t.kind === 'num') {
      this.pos++;
      return this.node({ k: 'num', v: t.value as number });
    }
    if (t.kind === 'str') {
      this.pos++;
      if ((t.value as string).length > LIMITS.stringLength)
        this.fail('This text is too long.', t.start, 'limit');
      return this.node({ k: 'str', v: t.value as string });
    }
    if (t.kind === 'name') {
      this.pos++;
      if (t.text === 'true') return this.node({ k: 'bool', v: true });
      if (t.text === 'false') return this.node({ k: 'bool', v: false });
      if (t.text === 'null') return this.node({ k: 'null' });
      if (FORBIDDEN_KEYS.has(t.text))
        this.fail(
          `"${t.text}" cannot be used in a formula.`,
          t.start,
          'forbidden',
        );
      if (this.isOp('(')) {
        this.pos++;
        const args = this.args(')');
        return this.node({ k: 'call', fn: t.text, args });
      }
      return this.node({ k: 'name', name: t.text });
    }
    if (this.isOp('(')) {
      this.pos++;
      const inner = this.conditional();
      this.expect(')');
      return inner;
    }
    if (this.isOp('[')) {
      this.pos++;
      const items = this.args(']');
      return this.node({ k: 'list', items });
    }
    this.fail(`Unexpected ${this.describe()}.`, t.start);
  }
}

/** Parses the text of a formula, without its leading `=`. */
export function parse(source: string): ParseResult {
  try {
    return { ok: true, expr: new Parser(tokenize(source)).parse() };
  } catch (error) {
    if (error instanceof FormulaSyntaxError)
      return {
        ok: false,
        error: error.message,
        at: error.at,
        code: error.code,
      };
    throw error;
  }
}

/** The names a parsed formula reads at its top level (not `.` members or function names). */
export function namesIn(expr: Expr, out = new Set<string>()): Set<string> {
  const stack: Expr[] = [expr];
  while (stack.length > 0) {
    const e = stack.pop()!;
    switch (e.k) {
      case 'name':
        out.add(e.name);
        break;
      case 'member':
        stack.push(e.obj);
        break;
      case 'index':
        stack.push(e.obj, e.index);
        break;
      case 'call':
        stack.push(...e.args);
        break;
      case 'list':
        stack.push(...e.items);
        break;
      case 'unary':
        stack.push(e.arg);
        break;
      case 'binary':
        stack.push(e.l, e.r);
        break;
      case 'cond':
        stack.push(e.test, e.a, e.b);
        break;
      default:
        break;
    }
  }
  return out;
}

/** The functions a parsed formula calls, lower-cased. */
export function callsIn(expr: Expr, out = new Set<string>()): Set<string> {
  const stack: Expr[] = [expr];
  while (stack.length > 0) {
    const e = stack.pop()!;
    switch (e.k) {
      case 'call':
        out.add(e.fn.toLowerCase());
        stack.push(...e.args);
        break;
      case 'member':
        stack.push(e.obj);
        break;
      case 'index':
        stack.push(e.obj, e.index);
        break;
      case 'list':
        stack.push(...e.items);
        break;
      case 'unary':
        stack.push(e.arg);
        break;
      case 'binary':
        stack.push(e.l, e.r);
        break;
      case 'cond':
        stack.push(e.test, e.a, e.b);
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Renames a name in formula text, leaving strings, members after a dot, function names and longer
 * names alone. Returns the text unchanged when it does not parse.
 */
export function renameName(source: string, from: string, to: string): string {
  let tokens: Token[];
  try {
    tokens = tokenize(source);
  } catch {
    return source;
  }
  let out = '';
  let last = 0;
  tokens.forEach((t, i) => {
    if (t.kind !== 'name' || t.text !== from) return;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (prev?.kind === 'op' && prev.text === '.') return;
    if (next?.kind === 'op' && next.text === '(') return;
    out += source.slice(last, t.start) + to;
    last = t.end;
  });
  return out + source.slice(last);
}
