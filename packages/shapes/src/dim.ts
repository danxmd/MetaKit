/**
 * Resolves a dimension against the length of its parent. Accepts a number, `"50%"`, `"12"`, and
 * sums such as `"100% - 22"` or `"50% + 4"`. Returns null for anything else.
 */
export function resolveDim(dim: unknown, parent: number): number | null {
  if (typeof dim === 'number') return Number.isFinite(dim) ? dim : null;
  if (typeof dim !== 'string') return null;
  const text = dim.trim();
  if (text === '') return null;
  const terms = text.match(/[+-]?\s*\d+(?:\.\d+)?%?/g);
  if (!terms || terms.join('').replace(/\s/g, '') !== text.replace(/\s/g, ''))
    return null;
  let total = 0;
  for (const term of terms) {
    const clean = term.replace(/\s/g, '');
    const percent = clean.endsWith('%');
    const n = Number(percent ? clean.slice(0, -1) : clean);
    total += percent ? (n / 100) * parent : n;
  }
  return total;
}

export const FONT_PX = 12;
export const LINE_HEIGHT = 1.25;

/**
 * Splits text into lines that fit `maxWidth`, with a rough width of 0.55 em per character (the
 * draw list is built without a canvas so it can be tested and cached; the estimate is only used to
 * choose line breaks). At most `maxLines` lines are returned; the last gets an ellipsis if cut.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontPx: number,
  maxLines: number,
): string[] {
  const perLine = Math.max(1, Math.floor(maxWidth / (fontPx * 0.55)));
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter((w) => w !== '')) {
      let rest = word;
      while (rest.length > perLine) {
        if (line !== '') {
          lines.push(line);
          line = '';
        }
        lines.push(rest.slice(0, perLine));
        rest = rest.slice(perLine);
      }
      const candidate = line === '' ? rest : `${line} ${rest}`;
      if (candidate.length <= perLine) line = candidate;
      else {
        lines.push(line);
        line = rest;
      }
    }
    lines.push(line);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1]!;
  kept[maxLines - 1] = `${last.slice(0, Math.max(0, perLine - 1))}…`;
  return kept;
}
