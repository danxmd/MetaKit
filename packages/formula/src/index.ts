import { evaluate, type EvalResult, type Scope } from './eval';
import { parse } from './parser';

export { FormulaSyntaxError, tokenize, type Token } from './lexer';
export {
  namesIn,
  parse,
  renameName,
  type Expr,
  type ParseResult,
} from './parser';
export {
  evaluate,
  FUNCTION_NAMES,
  toText,
  truthy,
  type EvalResult,
  type Scope,
  type Value,
} from './eval';

/** Parses and evaluates formula text (without the leading `=`); a syntax error is reported like an evaluation error. */
export function run(source: string, scope: Scope): EvalResult {
  const parsed = parse(source);
  if (!parsed.ok)
    return {
      value: null,
      reads: [],
      error: `${parsed.error} (at ${parsed.at})`,
    };
  return evaluate(parsed.expr, scope);
}
