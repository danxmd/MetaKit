import type { ToolLibrary } from '@metakit-app/core';
import { AssistantError, type CompletionRequest } from './provider';
import { MAX_SENTENCE_CHARS, buildRequest, type DraftKind } from './prompts';

// Ids of things that only exist in models. A tool library never contains them.
const MODEL_ID = /\b(?:el|cn|mdl)_[0-9a-z]{4,}\b/;
// Any real id has exactly ten characters after its prefix (newId).
const ANY_ID =
  /\b(?:tool|cls|rel|att|mt|shp|rule|scr|vw)_[0-9a-hjkmnp-tv-z]{10}\b/g;

function toolIds(tool: ToolLibrary): Set<string> {
  const ids = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const m of value.matchAll(ANY_ID)) ids.add(m[0]);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        for (const m of k.matchAll(ANY_ID)) ids.add(m[0]);
        walk(v);
      }
    }
  };
  walk(tool);
  return ids;
}

const ALLOWED_FIELDS = new Set(['system', 'messages', 'maxTokens']);

/**
 * Refuses a request that could carry model content. The builders take only a tool library, so this
 * is a second line of defence: the request must have exactly the expected shape, hold no id of a
 * model object (`el_`, `cn_`, `mdl_`), no id that the tool library does not contain, and nothing
 * that looks like a model file. It throws `AssistantError`; it never returns false.
 */
export function assertNoModelContent(
  payload: unknown,
  tool: ToolLibrary,
): asserts payload is CompletionRequest {
  const fail = (why: string): never => {
    throw new AssistantError(
      `Nothing was sent. The request was stopped because ${why}. The assistant never sends models.`,
    );
  };
  if (payload === null || typeof payload !== 'object')
    return fail('it is not a request');
  const req = payload as Record<string, unknown>;
  for (const k of Object.keys(req))
    if (!ALLOWED_FIELDS.has(k)) fail(`it has an unexpected field "${k}"`);
  if (typeof req.system !== 'string' || !Array.isArray(req.messages))
    return fail('it has the wrong shape');

  const texts: string[] = [req.system];
  for (const m of req.messages as unknown[]) {
    const msg = m as { role?: unknown; content?: unknown };
    if (
      (msg?.role !== 'user' && msg?.role !== 'assistant') ||
      typeof msg.content !== 'string'
    )
      return fail('a message has the wrong shape');
    texts.push(msg.content);
  }
  const known = toolIds(tool);
  for (const text of texts) {
    if (MODEL_ID.test(text)) fail('it contains the id of a model object');
    if (/"elements"\s*:/.test(text) && /"connectors"\s*:/.test(text))
      fail('it looks like a model file');
    for (const m of text.matchAll(ANY_ID))
      if (!known.has(m[0]))
        fail(`it contains the id ${m[0]}, which is not in the Kit`);
  }
}

export interface OutgoingPreview {
  request: CompletionRequest;
  /** Exactly what would be sent, as one readable text. */
  text: string;
  /** The length of that text, to show how much is sent. */
  characters: number;
}

/**
 * The exact request for a description, built the same way as for a real draft, so that the
 * settings page can show it before anything is sent. Nothing is sent by calling this.
 */
export function describeOutgoing(
  tool: ToolLibrary,
  kind: DraftKind,
  sentence: string,
  language?: string,
): OutgoingPreview {
  if (sentence.length > MAX_SENTENCE_CHARS)
    throw new AssistantError(
      `Keep the description under ${MAX_SENTENCE_CHARS} characters.`,
    );
  const request = buildRequest(tool, kind, sentence, language);
  assertNoModelContent(request, tool);
  const text = `SYSTEM\n${request.system}\n\n${request.messages
    .map((m) => `${m.role.toUpperCase()}\n${m.content}`)
    .join('\n\n')}`;
  return { request, text, characters: text.length };
}
