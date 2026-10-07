import type { FormulaErrorCode } from './lexer';

/** The part of an evaluation or parse result that tells what went wrong. */
export interface FormulaProblem {
  error?: string;
  code?: FormulaErrorCode | string;
}

const lead: Record<string, string> = {
  syntax: 'The formula is not written correctly.',
  name: 'The formula uses a name that does not exist.',
  type: 'The formula mixes values that do not fit together.',
  zero: 'The formula divides by zero.',
  limit: 'The formula is too big or takes too long to calculate.',
  forbidden: 'The formula uses something that is not allowed.',
};

/**
 * Turns a failed result into one sentence a modeller can act on, or undefined when nothing went
 * wrong. The engine's own message follows the lead because it names the part that failed; the
 * lead alone would not say where to look.
 */
export function describeFormulaProblem(
  result: FormulaProblem,
): string | undefined {
  if (!result.error) return undefined;
  const detail = result.error.trim();
  const head = result.code ? lead[result.code] : undefined;
  if (!head) return detail;
  // The zero-division message says the same as its lead.
  if (result.code === 'zero') return head;
  return `${head} ${detail}${wordOperatorHint(detail)}`;
}

/** People who know spreadsheets write `or` and `and`; the formulas here use `||` and `&&`. */
function wordOperatorHint(detail: string): string {
  const word = /Unexpected "(or|and|not)"/i.exec(detail)?.[1]?.toLowerCase();
  if (!word) return '';
  const symbol = word === 'or' ? '||' : word === 'and' ? '&&' : '!';
  return ` Write ${symbol} instead of "${word}", or use ${word.toUpperCase()}(...) as a function.`;
}
