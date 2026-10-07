import { tokenize, type Token } from '@metakit-app/formula';

export type MapValue = string | number | boolean;

export interface ColourMapping {
  value: MapValue;
  colour: string;
}

export interface ColourFormula {
  attribute: string;
  mapping: ColourMapping[];
  fallback: string;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Quotes text the way the formula lexer reads it back. */
function quote(text: string): string {
  const body = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `'${body}'`;
}

function literal(value: MapValue): string {
  return typeof value === 'string' ? quote(value) : String(value);
}

/**
 * Builds `= Key == 'A' ? '#111' : Key == 'B' ? '#222' : '#fallback'`, the one form the
 * "Colour by attribute" helper writes and can read back.
 */
export function buildColourFormula(
  attributeKey: string,
  mapping: readonly ColourMapping[],
  fallback: string,
): string {
  let out = quote(fallback);
  for (let i = mapping.length - 1; i >= 0; i--) {
    const m = mapping[i]!;
    out = `${attributeKey} == ${literal(m.value)} ? ${quote(m.colour)} : ${out}`;
  }
  return `= ${out}`;
}

/** Reads a number token with an optional minus sign; returns the next index too. */
function readValue(
  t: Token[],
  i: number,
): { value: MapValue; next: number } | null {
  const tok = t[i];
  if (!tok) return null;
  if (tok.kind === 'str') return { value: tok.value as string, next: i + 1 };
  if (tok.kind === 'num') return { value: tok.value as number, next: i + 1 };
  if (tok.kind === 'op' && tok.text === '-' && t[i + 1]?.kind === 'num')
    return { value: -(t[i + 1]!.value as number), next: i + 2 };
  if (tok.kind === 'name' && (tok.text === 'true' || tok.text === 'false'))
    return { value: tok.text === 'true', next: i + 1 };
  return null;
}

/**
 * Reads a formula written by `buildColourFormula`. Anything else, including a formula that only
 * looks similar, gives null so the editor shows it as a plain formula.
 */
export function parseColourFormula(source: string): ColourFormula | null {
  const text = source.trimStart();
  if (!text.startsWith('=')) return null;
  let t: Token[];
  try {
    t = tokenize(text.slice(1));
  } catch {
    return null;
  }
  const mapping: ColourMapping[] = [];
  let attribute: string | null = null;
  let i = 0;
  for (;;) {
    const tok = t[i];
    if (tok?.kind === 'str') {
      if (t[i + 1]?.kind !== 'end' || attribute === null) return null;
      return { attribute, mapping, fallback: tok.value as string };
    }
    if (tok?.kind !== 'name' || !IDENTIFIER.test(tok.text)) return null;
    if (attribute !== null && attribute !== tok.text) return null;
    attribute = tok.text;
    if (t[i + 1]?.text !== '==') return null;
    const v = readValue(t, i + 2);
    if (!v) return null;
    const q = t[v.next];
    const colour = t[v.next + 1];
    const colon = t[v.next + 2];
    if (q?.text !== '?' || colour?.kind !== 'str' || colon?.text !== ':')
      return null;
    mapping.push({ value: v.value, colour: colour.value as string });
    i = v.next + 3;
  }
}
