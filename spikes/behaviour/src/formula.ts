/**
 * Formula engine for the JavaScript expression subset, with the Excel aliases IF, SUM, AND, OR.
 * No eval and no `Function`: source is parsed to an AST and walked. Every limit below turns
 * hostile input into a typed error instead of a hang or a stack overflow.
 */

export const LIMITS = {
  sourceLength: 10_000,
  /** Syntactic nesting: parentheses, brackets, call arguments, chains of unary operators. */
  depth: 100,
  /** Height of the tree, which also counts a long flat chain such as a + b + c + ... */
  height: 1_000,
  nodes: 2_000,
  steps: 50_000,
  stringLength: 100_000,
  arrayLength: 10_000,
} as const;

export type FormulaErrorCode =
  'syntax' | 'limit' | 'name' | 'type' | 'forbidden';

export class FormulaError extends Error {
  constructor(
    readonly code: FormulaErrorCode,
    message: string,
    readonly position?: number,
  ) {
    super(position === undefined ? message : `${message} (at ${position})`);
    this.name = 'FormulaError';
  }
}

// --- tokens ---------------------------------------------------------------------------

type Token =
  | { type: 'number'; value: number; pos: number }
  | { type: 'string'; value: string; pos: number }
  | { type: 'ident'; value: string; pos: number }
  | { type: 'op'; value: string; pos: number }
  | { type: 'end'; pos: number };

const OPERATORS = [
  '===',
  '!==',
  '**',
  '<=',
  '>=',
  '==',
  '!=',
  '&&',
  '||',
  '??',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<',
  '>',
  '!',
  '?',
  ':',
  ',',
  '.',
  '(',
  ')',
  '[',
  ']',
];

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';

function tokenize(source: string): Token[] {
  if (source.length > LIMITS.sourceLength) {
    throw new FormulaError(
      'limit',
      `Formula is longer than ${LIMITS.sourceLength} characters`,
    );
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1;
    } else if (isDigit(c) || (c === '.' && isDigit(source[i + 1] ?? ''))) {
      const start = i;
      while (isDigit(source[i] ?? '')) i += 1;
      if (source[i] === '.') {
        i += 1;
        while (isDigit(source[i] ?? '')) i += 1;
      }
      if (source[i] === 'e' || source[i] === 'E') {
        const save = i;
        i += 1;
        if (source[i] === '+' || source[i] === '-') i += 1;
        if (isDigit(source[i] ?? '')) {
          while (isDigit(source[i] ?? '')) i += 1;
        } else {
          i = save;
        }
      }
      tokens.push({
        type: 'number',
        value: Number(source.slice(start, i)),
        pos: start,
      });
    } else if (c === '"' || c === "'") {
      const start = i;
      i += 1;
      let value = '';
      for (;;) {
        const ch = source[i];
        if (ch === undefined)
          throw new FormulaError('syntax', 'Unterminated string', start);
        if (ch === c) break;
        if (ch === '\\') {
          const next = source[i + 1];
          const map: Record<string, string> = {
            n: '\n',
            t: '\t',
            r: '\r',
            '\\': '\\',
            '"': '"',
            "'": "'",
          };
          if (next === undefined || !(next in map)) {
            throw new FormulaError('syntax', 'Unknown escape in string', i);
          }
          value += map[next];
          i += 2;
        } else {
          value += ch;
          i += 1;
        }
      }
      i += 1;
      tokens.push({ type: 'string', value, pos: start });
    } else if (isIdentStart(c)) {
      const start = i;
      while (
        i < source.length &&
        (isIdentStart(source[i]!) || isDigit(source[i]!))
      )
        i += 1;
      tokens.push({ type: 'ident', value: source.slice(start, i), pos: start });
    } else {
      const op = OPERATORS.find((candidate) => source.startsWith(candidate, i));
      if (!op)
        throw new FormulaError('syntax', `Unexpected character "${c}"`, i);
      tokens.push({ type: 'op', value: op, pos: i });
      i += op.length;
    }
  }
  tokens.push({ type: 'end', pos: source.length });
  return tokens;
}

// --- AST and parser -------------------------------------------------------------------

export type Node =
  | { kind: 'literal'; value: number | string | boolean | null; h: number }
  | { kind: 'name'; name: string; pos: number; h: number }
  | { kind: 'array'; items: Node[]; h: number }
  | { kind: 'member'; object: Node; property: string; pos: number; h: number }
  | { kind: 'index'; object: Node; index: Node; pos: number; h: number }
  | { kind: 'call'; callee: string; args: Node[]; pos: number; h: number }
  | { kind: 'unary'; op: string; operand: Node; h: number }
  | {
      kind: 'binary';
      op: string;
      left: Node;
      right: Node;
      pos: number;
      h: number;
    }
  | { kind: 'ternary'; test: Node; yes: Node; no: Node; h: number };

const BINARY_PRECEDENCE: Record<string, number> = {
  '??': 1,
  '||': 2,
  '&&': 3,
  '==': 4,
  '!=': 4,
  '===': 4,
  '!==': 4,
  '<': 5,
  '<=': 5,
  '>': 5,
  '>=': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
  '%': 7,
  '**': 8,
};

const height = (...children: Node[]) =>
  1 + Math.max(0, ...children.map((c) => c.h));

class Parser {
  private pos = 0;
  private nodes = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.expression(0, 0);
    const token = this.peek();
    if (token.type !== 'end') {
      throw new FormulaError(
        'syntax',
        'Unexpected input after the formula',
        token.pos,
      );
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private isOp(value: string): boolean {
    const t = this.peek();
    return t.type === 'op' && t.value === value;
  }

  private expectOp(value: string): void {
    if (!this.isOp(value)) {
      throw new FormulaError('syntax', `Expected "${value}"`, this.peek().pos);
    }
    this.pos += 1;
  }

  private make<T extends Node>(node: T): T {
    this.nodes += 1;
    if (this.nodes > LIMITS.nodes) {
      throw new FormulaError(
        'limit',
        `Formula has more than ${LIMITS.nodes} parts`,
      );
    }
    if (node.h > LIMITS.height) {
      throw new FormulaError(
        'limit',
        `Formula has more than ${LIMITS.height} chained operations`,
      );
    }
    return node;
  }

  private guard(depth: number): void {
    // Recursion depth is checked on the way in, so a hostile `((((...` never reaches the JS stack limit.
    if (depth > LIMITS.depth) {
      throw new FormulaError(
        'limit',
        `Formula is nested deeper than ${LIMITS.depth} levels`,
        this.peek().pos,
      );
    }
  }

  private expression(minPrecedence: number, depth: number): Node {
    this.guard(depth);
    let left = this.unary(depth);
    for (;;) {
      const token = this.peek();
      if (token.type !== 'op') break;
      if (token.value === '?' && minPrecedence === 0) {
        this.pos += 1;
        const yes = this.expression(0, depth + 1);
        this.expectOp(':');
        const no = this.expression(0, depth + 1);
        left = this.make({
          kind: 'ternary',
          test: left,
          yes,
          no,
          h: height(left, yes, no),
        });
        continue;
      }
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < Math.max(minPrecedence, 1))
        break;
      this.pos += 1;
      // `**` is right-associative, the rest left-associative.
      const right = this.expression(
        token.value === '**' ? precedence : precedence + 1,
        depth + 1,
      );
      left = this.make({
        kind: 'binary',
        op: token.value,
        left,
        right,
        pos: token.pos,
        h: height(left, right),
      });
    }
    return left;
  }

  private unary(depth: number): Node {
    this.guard(depth);
    const token = this.peek();
    if (
      token.type === 'op' &&
      (token.value === '!' || token.value === '-' || token.value === '+')
    ) {
      this.pos += 1;
      const operand = this.unary(depth + 1);
      return this.make({
        kind: 'unary',
        op: token.value,
        operand,
        h: height(operand),
      });
    }
    return this.postfix(depth);
  }

  private postfix(depth: number): Node {
    let node = this.primary(depth);
    for (;;) {
      const token = this.peek();
      if (token.type !== 'op') break;
      if (token.value === '.') {
        this.pos += 1;
        const name = this.peek();
        if (name.type !== 'ident')
          throw new FormulaError(
            'syntax',
            'Expected a name after "."',
            name.pos,
          );
        this.pos += 1;
        if (this.isOp('(')) {
          throw new FormulaError(
            'forbidden',
            'Methods cannot be called; use a function such as upper(x)',
            name.pos,
          );
        }
        node = this.make({
          kind: 'member',
          object: node,
          property: name.value,
          pos: name.pos,
          h: height(node),
        });
      } else if (token.value === '[') {
        this.pos += 1;
        const index = this.expression(0, depth + 1);
        this.expectOp(']');
        node = this.make({
          kind: 'index',
          object: node,
          index,
          pos: token.pos,
          h: height(node, index),
        });
      } else {
        break;
      }
    }
    return node;
  }

  private primary(depth: number): Node {
    this.guard(depth);
    const token = this.peek();
    if (token.type === 'number' || token.type === 'string') {
      this.pos += 1;
      if (token.type === 'string' && token.value.length > LIMITS.stringLength) {
        throw new FormulaError(
          'limit',
          'String literal is too long',
          token.pos,
        );
      }
      return this.make({ kind: 'literal', value: token.value, h: 1 });
    }
    if (token.type === 'ident') {
      this.pos += 1;
      if (token.value === 'true' || token.value === 'false') {
        return this.make({
          kind: 'literal',
          value: token.value === 'true',
          h: 1,
        });
      }
      if (token.value === 'null')
        return this.make({ kind: 'literal', value: null, h: 1 });
      if (this.isOp('(')) {
        this.pos += 1;
        const args: Node[] = [];
        if (!this.isOp(')')) {
          for (;;) {
            args.push(this.expression(0, depth + 1));
            if (this.isOp(',')) {
              this.pos += 1;
              continue;
            }
            break;
          }
        }
        this.expectOp(')');
        return this.make({
          kind: 'call',
          callee: token.value,
          args,
          pos: token.pos,
          h: height(...args),
        });
      }
      return this.make({
        kind: 'name',
        name: token.value,
        pos: token.pos,
        h: 1,
      });
    }
    if (token.type === 'op' && token.value === '(') {
      this.pos += 1;
      const inner = this.expression(0, depth + 1);
      this.expectOp(')');
      return inner;
    }
    if (token.type === 'op' && token.value === '[') {
      this.pos += 1;
      const items: Node[] = [];
      if (!this.isOp(']')) {
        for (;;) {
          items.push(this.expression(0, depth + 1));
          if (items.length > LIMITS.arrayLength)
            throw new FormulaError('limit', 'Array literal is too long');
          if (this.isOp(',')) {
            this.pos += 1;
            continue;
          }
          break;
        }
      }
      this.expectOp(']');
      return this.make({ kind: 'array', items, h: height(...items) });
    }
    throw new FormulaError(
      'syntax',
      token.type === 'end' ? 'Formula ends too early' : 'Unexpected input',
      token.pos,
    );
  }
}

export function parse(source: string): Node {
  return new Parser(tokenize(source)).parse();
}

// --- dependencies ---------------------------------------------------------------------

/**
 * Attribute keys a formula reads. Static: the untaken branch of IF still counts, because
 * dependency tracking must not change with the data.
 */
export function dependencies(node: Node): string[] {
  const found = new Set<string>();
  const stack: Node[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    switch (current.kind) {
      case 'name':
        found.add(current.name);
        break;
      case 'array':
        stack.push(...current.items);
        break;
      case 'member':
        stack.push(current.object);
        break;
      case 'index':
        stack.push(current.object, current.index);
        break;
      case 'call':
        stack.push(...current.args);
        break;
      case 'unary':
        stack.push(current.operand);
        break;
      case 'binary':
        stack.push(current.left, current.right);
        break;
      case 'ternary':
        stack.push(current.test, current.yes, current.no);
        break;
      case 'literal':
        break;
    }
  }
  return [...found].sort();
}

// --- evaluation -----------------------------------------------------------------------

export type Value =
  number | string | boolean | null | Value[] | { [key: string]: Value };
export type Scope = Readonly<Record<string, unknown>>;

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function checkString(s: string): string {
  if (s.length > LIMITS.stringLength) {
    throw new FormulaError(
      'limit',
      `Text is longer than ${LIMITS.stringLength} characters`,
    );
  }
  return s;
}

function num(v: unknown, what: string): number {
  if (typeof v !== 'number')
    throw new FormulaError('type', `${what} needs a number`);
  return v;
}

const flatten = (args: unknown[]): unknown[] =>
  args.flatMap((a) => (Array.isArray(a) ? flatten(a) : [a]));

const numbers = (args: unknown[], what: string): number[] =>
  flatten(args)
    .filter((v) => v !== null)
    .map((v) => num(v, what));

const truthy = (v: unknown): boolean => !!v;

type Fn = (...args: unknown[]) => unknown;

/** Every function a formula may call. Anything else is "Unknown function". */
const FUNCTIONS: Record<string, Fn> = {
  SUM: (...a) => numbers(a, 'SUM').reduce((x, y) => x + y, 0),
  min: (...a) => Math.min(...numbers(a, 'min')),
  max: (...a) => Math.max(...numbers(a, 'max')),
  avg: (...a) => {
    const n = numbers(a, 'avg');
    return n.length === 0 ? null : n.reduce((x, y) => x + y, 0) / n.length;
  },
  count: (...a) => flatten(a).filter((v) => v !== null).length,
  abs: (x) => Math.abs(num(x, 'abs')),
  floor: (x) => Math.floor(num(x, 'floor')),
  ceil: (x) => Math.ceil(num(x, 'ceil')),
  round: (x, digits = 0) => {
    const f = 10 ** Math.min(15, Math.max(0, num(digits, 'round')));
    return Math.round(num(x, 'round') * f) / f;
  },
  len: (x) => {
    if (typeof x === 'string' || Array.isArray(x)) return x.length;
    throw new FormulaError('type', 'len needs text or a list');
  },
  upper: (x) => checkString(String(x ?? '').toUpperCase()),
  lower: (x) => checkString(String(x ?? '').toLowerCase()),
  trim: (x) => String(x ?? '').trim(),
  concat: (...a) =>
    checkString(
      flatten(a)
        .map((v) => String(v ?? ''))
        .join(''),
    ),
  join: (list, sep = ',') => {
    if (!Array.isArray(list))
      throw new FormulaError('type', 'join needs a list');
    return checkString(list.map((v) => String(v ?? '')).join(String(sep)));
  },
  contains: (s, sub) => String(s ?? '').includes(String(sub ?? '')),
  startsWith: (s, sub) => String(s ?? '').startsWith(String(sub ?? '')),
  endsWith: (s, sub) => String(s ?? '').endsWith(String(sub ?? '')),
  isEmpty: (x) =>
    x === null || x === '' || (Array.isArray(x) && x.length === 0),
  number: (x) => {
    const n = typeof x === 'number' ? x : Number(String(x).trim());
    return Number.isNaN(n) ? null : n;
  },
  text: (x) => checkString(x === null ? '' : String(x)),
  coalesce: (...a) =>
    a.find((v) => v !== null && v !== undefined && v !== '') ?? null,
};

/** Excel aliases that need lazy evaluation are handled in the evaluator. */
const LAZY = new Set(['IF', 'AND', 'OR']);

export function isKnownFunction(name: string): boolean {
  return LAZY.has(name) || Object.hasOwn(FUNCTIONS, name);
}

class Evaluator {
  private steps = 0;

  constructor(private readonly scope: Scope) {}

  run(node: Node): unknown {
    this.steps += 1;
    if (this.steps > LIMITS.steps) {
      throw new FormulaError(
        'limit',
        'Formula took too many steps to evaluate',
      );
    }
    switch (node.kind) {
      case 'literal':
        return node.value;
      case 'name': {
        if (BLOCKED_KEYS.has(node.name)) {
          throw new FormulaError(
            'forbidden',
            `"${node.name}" is not available`,
            node.pos,
          );
        }
        if (!Object.hasOwn(this.scope, node.name)) {
          throw new FormulaError(
            'name',
            `Unknown name "${node.name}"`,
            node.pos,
          );
        }
        return this.scope[node.name] ?? null;
      }
      case 'array': {
        return node.items.map((i) => this.run(i));
      }
      case 'member':
        return this.read(this.run(node.object), node.property, node.pos);
      case 'index':
        return this.read(this.run(node.object), this.run(node.index), node.pos);
      case 'call':
        return this.call(node);
      case 'unary': {
        const v = this.run(node.operand);
        if (node.op === '!') return !truthy(v);
        const n = num(v, `Unary ${node.op}`);
        return node.op === '-' ? -n : n;
      }
      case 'binary':
        return this.binary(node);
      case 'ternary':
        return truthy(this.run(node.test))
          ? this.run(node.yes)
          : this.run(node.no);
    }
  }

  private read(target: unknown, key: unknown, pos: number): unknown {
    if (target === null || target === undefined) {
      throw new FormulaError(
        'type',
        'Cannot read a property of an empty value',
        pos,
      );
    }
    if (typeof key === 'string' && BLOCKED_KEYS.has(key)) {
      throw new FormulaError('forbidden', `"${key}" is not available`, pos);
    }
    if (typeof target === 'string' || Array.isArray(target)) {
      if (key === 'length') return target.length;
      if (typeof key === 'number' && Number.isInteger(key)) {
        return (target as ArrayLike<unknown>)[key] ?? null;
      }
      throw new FormulaError(
        'type',
        'Only length and a whole-number index can be read here',
        pos,
      );
    }
    if (isPlainObject(target)) {
      if (typeof key !== 'string' && typeof key !== 'number') {
        throw new FormulaError('type', 'A property name must be text', pos);
      }
      return Object.hasOwn(target, key) ? (target[key] ?? null) : null;
    }
    throw new FormulaError('type', 'Cannot read a property of this value', pos);
  }

  private call(node: Extract<Node, { kind: 'call' }>): unknown {
    const { callee, args } = node;
    if (callee === 'IF') {
      if (args.length !== 3)
        throw new FormulaError('type', 'IF needs 3 arguments', node.pos);
      return truthy(this.run(args[0]!))
        ? this.run(args[1]!)
        : this.run(args[2]!);
    }
    if (callee === 'AND') {
      for (const a of args) if (!truthy(this.run(a))) return false;
      return true;
    }
    if (callee === 'OR') {
      for (const a of args) if (truthy(this.run(a))) return true;
      return false;
    }
    if (!Object.hasOwn(FUNCTIONS, callee)) {
      throw new FormulaError('name', `Unknown function "${callee}"`, node.pos);
    }
    return FUNCTIONS[callee]!(...args.map((a) => this.run(a)));
  }

  private binary(node: Extract<Node, { kind: 'binary' }>): unknown {
    const { op } = node;
    if (op === '&&') {
      const l = this.run(node.left);
      return truthy(l) ? this.run(node.right) : l;
    }
    if (op === '||') {
      const l = this.run(node.left);
      return truthy(l) ? l : this.run(node.right);
    }
    if (op === '??') {
      const l = this.run(node.left);
      return l ?? this.run(node.right);
    }
    const l = this.run(node.left);
    const r = this.run(node.right);
    switch (op) {
      case '+':
        if (typeof l === 'string' || typeof r === 'string') {
          return checkString(`${l ?? ''}${r ?? ''}`);
        }
        return num(l, '+') + num(r, '+');
      case '-':
        return num(l, '-') - num(r, '-');
      case '*':
        return num(l, '*') * num(r, '*');
      case '/':
        return num(l, '/') / num(r, '/');
      case '%':
        return num(l, '%') % num(r, '%');
      case '**':
        return num(l, '**') ** num(r, '**');
      // `==` is strict, like Excel's `=`; nothing in a formula coerces silently.
      case '==':
      case '===':
        return l === r;
      case '!=':
      case '!==':
        return l !== r;
      case '<':
      case '<=':
      case '>':
      case '>=': {
        if (
          (typeof l === 'number' && typeof r === 'number') ||
          (typeof l === 'string' && typeof r === 'string')
        ) {
          if (op === '<') return l < r;
          if (op === '<=') return l <= r;
          if (op === '>') return l > r;
          return l >= r;
        }
        throw new FormulaError('type', `Cannot compare with ${op}`, node.pos);
      }
    }
    throw new FormulaError('syntax', `Unknown operator ${op}`, node.pos);
  }
}

export interface CompiledFormula {
  source: string;
  ast: Node;
  /** Attribute keys the formula reads. */
  dependencies: string[];
  evaluate(scope: Scope): unknown;
}

export function compile(source: string): CompiledFormula {
  const ast = parse(source);
  return {
    source,
    ast,
    dependencies: dependencies(ast),
    evaluate: (scope) => new Evaluator(scope).run(ast),
  };
}

/** One-shot convenience for tests and the demo page. */
export function evaluate(source: string, scope: Scope = {}): unknown {
  return compile(source).evaluate(scope);
}
