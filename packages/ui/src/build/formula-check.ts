import { describeFormulaProblem, parse } from '@metakit-app/formula';

/**
 * Checks formula text as typed in a Build mode field: the problem in plain English, or undefined
 * when it reads correctly. Only the syntax can be checked here; names are checked against a model.
 * A leading `=` is accepted because rules and panels write formulas that way.
 */
export function formulaProblem(
  text: string,
  options: { required?: boolean } = {},
): string | undefined {
  const source = text.trim().replace(/^=/, '').trim();
  if (source === '') return options.required ? 'Write a formula.' : undefined;
  const parsed = parse(source);
  if (parsed.ok) return undefined;
  return describeFormulaProblem({
    error: `${parsed.error} (at ${parsed.at})`,
    code: parsed.code,
  });
}

/** A constraint message is plain text, or a formula when it starts with `=`. */
export function messageProblem(text: string): string | undefined {
  if (!text.trimStart().startsWith('=')) return undefined;
  return formulaProblem(text, { required: true });
}
