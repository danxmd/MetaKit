import { evaluate, type EvalResult, type Scope } from './eval';
import { parse, type Expr } from './parser';

export { describeFormulaProblem, type FormulaProblem } from './describe';
export {
  FormulaSyntaxError,
  LIMITS,
  tokenize,
  type FormulaErrorCode,
  type Token,
} from './lexer';
export {
  callsIn,
  namesIn,
  parse,
  renameName,
  type Expr,
  type ParseResult,
} from './parser';
export {
  evaluate,
  FUNCTION_NAMES,
  isKnownFunction,
  toText,
  truthy,
  type EvalResult,
  type Scope,
  type Value,
} from './eval';

const parsed = new Map<
  string,
  Expr | { error: string; at: number; code: string }
>();

/** Parses formula text once and keeps the tree; a syntax error is kept as its message. */
export function parseCached(
  source: string,
): { expr: Expr } | { error: string; at: number; code: string } {
  let hit = parsed.get(source);
  if (hit === undefined) {
    const p = parse(source);
    hit = p.ok ? p.expr : { error: p.error, at: p.at, code: p.code };
    if (parsed.size > 5000) parsed.clear();
    parsed.set(source, hit);
  }
  return 'k' in hit ? { expr: hit } : hit;
}

/** Parses and evaluates formula text (without the leading `=`); a syntax error is reported like an evaluation error. */
export function run(source: string, scope: Scope): EvalResult {
  const p = parseCached(source);
  if ('error' in p)
    return {
      value: null,
      reads: [],
      error: `${p.error} (at ${p.at})`,
      code: p.code as EvalResult['code'] & string,
    };
  return evaluate(p.expr, scope);
}
