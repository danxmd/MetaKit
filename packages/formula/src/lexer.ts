export type TokenKind = 'num' | 'str' | 'name' | 'op' | 'end';

export interface Token {
  kind: TokenKind;
  text: string;
  /** The value of a number or string token. */
  value?: number | string;
  start: number;
  end: number;
}

export type FormulaErrorCode =
  'syntax' | 'limit' | 'name' | 'type' | 'forbidden' | 'zero';

/** Limits that turn hostile input into an error instead of a hang or a stack overflow. */
export const LIMITS = {
  sourceLength: 10_000,
  /** Nesting of brackets, calls and chains of unary operators. */
  depth: 100,
  /** Operators chained in a row, such as `1 + 1 + 1 + ...`. */
  chain: 1_000,
  nodes: 2_000,
  steps: 50_000,
  stringLength: 100_000,
  arrayLength: 10_000,
} as const;

export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly at: number,
    readonly code: FormulaErrorCode = 'syntax',
  ) {
    super(message);
    this.name = 'FormulaSyntaxError';
  }
}

const OPERATORS = [
  '===',
  '!==',
  '**',
  '??',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
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
  '(',
  ')',
  '[',
  ']',
  ',',
  '.',
];

const isDigit = (c: string) => c >= '0' && c <= '9';
const isNameStart = (c: string) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
const isNamePart = (c: string) => isNameStart(c) || isDigit(c);

/** Splits formula text into tokens; the positions let callers rewrite names in place. */
export function tokenize(source: string): Token[] {
  if (source.length > LIMITS.sourceLength)
    throw new FormulaSyntaxError(
      `This formula is longer than ${LIMITS.sourceLength} characters.`,
      0,
      'limit',
    );
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    const start = i;
    if (isDigit(c) || (c === '.' && isDigit(source[i + 1] ?? ''))) {
      while (isDigit(source[i] ?? '')) i++;
      if (source[i] === '.' && isDigit(source[i + 1] ?? '')) {
        i++;
        while (isDigit(source[i] ?? '')) i++;
      }
      const text = source.slice(start, i);
      tokens.push({ kind: 'num', text, value: Number(text), start, end: i });
      continue;
    }
    if (c === "'" || c === '"') {
      i++;
      let value = '';
      for (;;) {
        if (i >= source.length)
          throw new FormulaSyntaxError('This text is not closed.', start);
        const d = source[i]!;
        if (d === '\\' && i + 1 < source.length) {
          const n = source[i + 1]!;
          value += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          i += 2;
          continue;
        }
        i++;
        if (d === c) break;
        value += d;
      }
      tokens.push({
        kind: 'str',
        text: source.slice(start, i),
        value,
        start,
        end: i,
      });
      continue;
    }
    if (isNameStart(c)) {
      while (i < source.length && isNamePart(source[i]!)) i++;
      tokens.push({
        kind: 'name',
        text: source.slice(start, i),
        start,
        end: i,
      });
      continue;
    }
    const op = OPERATORS.find((o) => source.startsWith(o, i));
    if (!op)
      throw new FormulaSyntaxError(`Unexpected character "${c}".`, start);
    i += op.length;
    tokens.push({ kind: 'op', text: op, start, end: i });
  }
  tokens.push({
    kind: 'end',
    text: '',
    start: source.length,
    end: source.length,
  });
  return tokens;
}
