import type { Kit } from '@metakit-app/core';
import { parseDraftReply, validateDraft } from './check';
import { assertNoModelContent } from './outgoing';
import {
  AssistantError,
  type AssistantProvider,
  type CompletionRequest,
} from './provider';
import {
  MAX_SENTENCE_CHARS,
  buildRequest,
  retryMessages,
  type DraftKind,
} from './prompts';
import { safeMessage } from './settings';
import type { DraftMap, DraftOutcome, TypeCheck } from './types';

export interface DraftOptions<K extends DraftKind> {
  provider: AssistantProvider;
  /** The person's key, from `KeyStore.reveal`. It is passed to the provider and nowhere else. */
  key: string;
  kit: Kit;
  kind: K;
  /** What the person wants, in their own words. */
  sentence: string;
  /** The language code for labels and messages; the Kit's first language by default. */
  language?: string;
  /**
   * Type check for scripts (the TypeScript language service of the UI package). Without it a
   * script is only compiled, which finds syntax errors but not a wrong class name or attribute.
   */
  typeCheck?: TypeCheck;
}

/**
 * Asks the provider for a draft and checks it. An invalid reply is sent back once with the list
 * of problems; whatever comes back after that is returned, with its errors if it still has any.
 * The request holds the Kit definition and the sentence only (`assertNoModelContent` checks
 * every request before it goes out).
 */
export async function draft<K extends DraftKind>(
  options: DraftOptions<K>,
): Promise<DraftOutcome<K>> {
  const { provider, key, kit, kind } = options;
  const sentence = options.sentence.trim();
  if (sentence === '')
    throw new AssistantError('Describe what you want first.');
  if (sentence.length > MAX_SENTENCE_CHARS)
    throw new AssistantError(
      `Keep the description under ${MAX_SENTENCE_CHARS} characters.`,
    );

  const send = async (request: CompletionRequest): Promise<string> => {
    assertNoModelContent(request, kit);
    try {
      return await provider.complete(request, key);
    } catch (error) {
      throw error instanceof AssistantError
        ? error
        : new AssistantError(safeMessage(error, key));
    }
  };
  const check = async (
    reply: string,
  ): Promise<{ draft: DraftMap[K] | null; errors: string[] }> => {
    const parsed = parseDraftReply(kind, reply, kit, sentence);
    if (parsed.draft === null) return parsed;
    return {
      draft: parsed.draft,
      errors: await validateDraft(kind, parsed.draft, kit, {
        typeCheck: options.typeCheck,
      }),
    };
  };

  const first = buildRequest(kit, kind, sentence, options.language);
  const reply = await send(first);
  const one = await check(reply);
  if (one.errors.length === 0)
    return { draft: one.draft, raw: reply, errors: [], attempts: 1 };

  const retry: CompletionRequest = {
    ...first,
    messages: retryMessages(first, reply, one.errors, kind),
  };
  const reply2 = await send(retry);
  const two = await check(reply2);
  return {
    draft: two.draft,
    raw: reply2,
    errors: two.errors,
    attempts: 2,
  };
}
