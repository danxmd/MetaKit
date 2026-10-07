/** What replaces a key in any text that leaves this package. */
export const REDACTED = '[key removed]';

// Anthropic keys look like sk-ant-...; the pattern catches one that came back in a message even
// when the exact key is not at hand.
const KEY_SHAPE = /\bsk-[A-Za-z0-9_-]{8,}/g;

/**
 * Removes the given keys, anything shaped like a key, and a header line that carries one from a
 * text. Every error that comes out of a provider passes through here (rule 9: secrets never reach
 * logs, messages or fixtures).
 */
export function redact(
  text: string,
  ...secrets: (string | undefined)[]
): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join(REDACTED);
  }
  return out
    .replace(KEY_SHAPE, REDACTED)
    .replace(/(x-api-key|authorization)\s*[:=]\s*\S+/gi, `$1: ${REDACTED}`);
}
