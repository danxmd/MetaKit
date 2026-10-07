import { FormulaSyntaxError, tokenize, type Token } from './lexer';

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'null' }
  | { k: 'list'; items: Expr[] }
  | { k: 'name'; name: string }
  | { k: 'member'; obj: Expr; key: string }
  | { k: 'call'; fn: string; args: Expr[] }
  | { k: 'unary'; op: '!' | '-'; arg: Expr }
  | { k: 'binary'; op: string; l: Expr; r: Expr }
  | { k: 'cond'; test: Expr; a: Expr; b: Expr };

export type ParseResult =
  { ok: true; expr: Expr } | { ok: false; error: string; at: number };

const BINARY_LEVELS: string[][] = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/', '%'],
];

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private get tok(): Token {
    return this.tokens[this.pos]!;
  }

  private isOp(text: string): boolean {
    return this.tok.kind === 'op' && this.tok.text === text;
  }

  private expect(text: string): void {
    if (!this.isOp(text))
      throw new FormulaSyntaxError(
        `Expected "${text}" but found ${this.describe()}.`,
        this.tok.start,
      );
    this.pos++;
  }

  private describe(): string {
    return this.tok.kind === 'end' ? 'the end' : `"${this.tok.text}"`;
  }

  parse(): Expr {
    const expr = this.conditional();
    if (this.tok.kind !== 'end')
      throw new FormulaSyntaxError(
        `Unexpected ${this.describe()}.`,
        this.tok.start,
      );
    return expr;
  }

  private conditional(): Expr {
    const test = this.binary(0);
    if (!this.isOp('?')) return test;
    this.pos++;
    const a = this.conditional();
    this.expect(':');
    const b = this.conditional();
    return { k: 'cond', test, a, b };
  }

  private binary(level: number): Expr {
    if (level >= BINARY_LEVELS.length) return this.unary();
    let left = this.binary(level + 1);
    while (
      this.tok.kind === 'op' &&
      BINARY_LEVELS[level]!.includes(this.tok.text)
    ) {
      const op = this.tok.text;
      this.pos++;
      left = { k: 'binary', op, l: left, r: this.binary(level + 1) };
    }
    return left;
  }

  private unary(): Expr {
    if (this.isOp('!') || this.isOp('-')) {
      const op = this.tok.text as '!' | '-';
      this.pos++;
      return { k: 'unary', op, arg: this.unary() };
    }
    return this.postfix();
  }

  private postfix(): Expr {
    let expr = this.primary();
    while (this.isOp('.')) {
      this.pos++;
      if (this.tok.kind !== 'name')
        throw new FormulaSyntaxError(
          `Expected a name after "." but found ${this.describe()}.`,
          this.tok.start,
        );
      expr = { k: 'member', obj: expr, key: this.tok.text };
      this.pos++;
    }
    return expr;
  }

  private primary(): Expr {
    const t = this.tok;
    if (t.kind === 'num') {
      this.pos++;
      return { k: 'num', v: t.value as number };
    }
    if (t.kind === 'str') {
      this.pos++;
      return { k: 'str', v: t.value as string };
    }
    if (t.kind === 'name') {
      this.pos++;
      if (t.text === 'true') return { k: 'bool', v: true };
      if (t.text === 'false') return { k: 'bool', v: false };
      if (t.text === 'null') return { k: 'null' };
      if (this.isOp('(')) {
        this.pos++;
        const args: Expr[] = [];
        if (!this.isOp(')')) {
          do args.push(this.conditional());
          while (this.isOp(',') && ++this.pos);
        }
        this.expect(')');
        return { k: 'call', fn: t.text, args };
      }
      return { k: 'name', name: t.text };
    }
    if (this.isOp('(')) {
      this.pos++;
      const inner = this.conditional();
      this.expect(')');
      return inner;
    }
    if (this.isOp('[')) {
      this.pos++;
      const items: Expr[] = [];
      if (!this.isOp(']')) {
        do items.push(this.conditional());
        while (this.isOp(',') && ++this.pos);
      }
      this.expect(']');
      return { k: 'list', items };
    }
    throw new FormulaSyntaxError(`Unexpected ${this.describe()}.`, t.start);
  }
}

/** Parses the text of a formula, without its leading `=`. */
export function parse(source: string): ParseResult {
  try {
    return { ok: true, expr: new Parser(tokenize(source)).parse() };
  } catch (error) {
    if (error instanceof FormulaSyntaxError)
      return { ok: false, error: error.message, at: error.at };
    throw error;
  }
}

/** The names a parsed formula reads at its top level (not `.` members or function names). */
export function namesIn(expr: Expr, out = new Set<string>()): Set<string> {
  switch (expr.k) {
    case 'name':
      out.add(expr.name);
      break;
    case 'member':
      namesIn(expr.obj, out);
      break;
    case 'call':
      for (const a of expr.args) namesIn(a, out);
      break;
    case 'list':
      for (const a of expr.items) namesIn(a, out);
      break;
    case 'unary':
      namesIn(expr.arg, out);
      break;
    case 'binary':
      namesIn(expr.l, out);
      namesIn(expr.r, out);
      break;
    case 'cond':
      namesIn(expr.test, out);
      namesIn(expr.a, out);
      namesIn(expr.b, out);
      break;
    default:
      break;
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
