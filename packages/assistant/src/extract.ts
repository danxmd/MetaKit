/**
 * The code in a reply: the first fenced block in one of `langs` (or any fenced block), or the
 * whole reply when there is no fence. A fence that was never closed (a reply cut short) is read
 * to the end so that the checks can say what is wrong with it.
 */
export function extractCode(text: string, langs: readonly string[]): string {
  const fences = [
    ...text.matchAll(/```([A-Za-z0-9_-]*)[^\S\n]*\n([\s\S]*?)```/g),
  ];
  const pick =
    fences.find((f) => langs.includes((f[1] ?? '').toLowerCase())) ?? fences[0];
  if (pick) return (pick[2] ?? '').trim();
  const open = /```[A-Za-z0-9_-]*[^\S\n]*\n([\s\S]*)$/.exec(text);
  if (open) return (open[1] ?? '').trim();
  return text.trim();
}

/** A JSON object from reply text, or the reason it cannot be read. */
export function parseJsonObject(
  text: string,
): { value: Record<string, unknown> } | { error: string } {
  const attempt = (source: string) => {
    try {
      const value: unknown = JSON.parse(source);
      return value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
        ? { value: value as Record<string, unknown> }
        : { error: 'The reply is JSON but not an object.' };
    } catch (error) {
      return {
        error: `The reply is not valid JSON (${(error as Error).message}).`,
      };
    }
  };
  const first = attempt(text);
  if ('value' in first) return first;
  // Explanatory text around the object is common; take from the first brace to the last.
  const from = text.indexOf('{');
  const to = text.lastIndexOf('}');
  if (from >= 0 && to > from) {
    const inner = attempt(text.slice(from, to + 1));
    if ('value' in inner) return inner;
  }
  return first;
}
