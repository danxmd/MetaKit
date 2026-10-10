import { DEFAULT_MODEL, DEFAULT_PROVIDER_ID } from './settings';
import { redact } from './redact';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Everything that leaves the browser in one call. Nothing else is ever sent. */
export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

/**
 * A service that can answer a request with text. Claude is the first; another provider only has
 * to implement this. A provider never logs, stores or returns the key, and every error it throws
 * is an `AssistantError` with the key already removed.
 */
export interface AssistantProvider {
  readonly id: string;
  /** Makes a tiny request to check the key; resolves with a short sentence for the person. */
  test(key: string): Promise<string>;
  complete(request: CompletionRequest, key: string): Promise<string>;
}

/** A problem to show to the person, in plain English, with no secret in it. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

/** Minimal shape of the SDK that the provider uses, so that a test can stand in for it. */
interface SdkClient {
  messages: {
    create(body: {
      model: string;
      max_tokens: number;
      system: string;
      messages: ChatMessage[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}
type SdkConstructor = new (options: {
  apiKey: string;
  dangerouslyAllowBrowser: boolean;
  fetch?: typeof fetch;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
}) => SdkClient;

export interface ClaudeProviderOptions {
  model?: string;
  /** For tests: the SDK sends its requests through this instead of the network. */
  fetch?: typeof fetch;
  baseURL?: string;
  /** For tests: replaces the dynamic import of the SDK. */
  loadSdk?: () => Promise<SdkConstructor>;
}

const DEFAULT_MAX_TOKENS = 4096;

async function importSdk(): Promise<SdkConstructor> {
  // A dynamic import keeps the SDK out of the main bundle; it is fetched only when the assistant
  // is used.
  const mod = await import('@anthropic-ai/sdk');
  return mod.default as unknown as SdkConstructor;
}

function friendly(error: unknown, key: string): AssistantError {
  const e = error as { status?: unknown; message?: unknown } | null;
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const raw = redact(
    typeof e?.message === 'string' ? e.message : String(error),
    key,
  );
  if (status === 401 || status === 403)
    return new AssistantError(
      'The service did not accept this key. Check that it is complete and still active.',
      status,
    );
  if (status === 429)
    return new AssistantError(
      'The service says there were too many requests or the account is out of credit. Try again in a moment.',
      status,
    );
  if (status === undefined && /fetch|network|connection/i.test(raw))
    return new AssistantError(
      'The service could not be reached. Check the internet connection.',
    );
  // The original error is not kept as a cause: it can carry the request headers.
  return new AssistantError(raw, status);
}

/** Claude through Anthropic's TypeScript SDK, called straight from the browser with the person's own key. */
export class ClaudeProvider implements AssistantProvider {
  readonly id = DEFAULT_PROVIDER_ID;
  readonly model: string;

  constructor(private readonly options: ClaudeProviderOptions = {}) {
    this.model = options.model?.trim() || DEFAULT_MODEL;
  }

  private async client(key: string): Promise<SdkClient> {
    const Anthropic = await (this.options.loadSdk ?? importSdk)();
    return new Anthropic({
      apiKey: key,
      // The person's own key is used from their own page; the settings page says so (ADR 0008).
      dangerouslyAllowBrowser: true,
      maxRetries: 1,
      timeout: 120_000,
      ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
      ...(this.options.baseURL ? { baseURL: this.options.baseURL } : {}),
    });
  }

  async complete(request: CompletionRequest, key: string): Promise<string> {
    try {
      const client = await this.client(key);
      const reply = await client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: request.system,
        messages: request.messages,
      });
      return reply.content
        .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
        .join('');
    } catch (error) {
      throw friendly(error, key);
    }
  }

  async test(key: string): Promise<string> {
    // No Kit or model content: this request only proves that the key works.
    await this.complete(
      {
        system: 'You check that an API key works.',
        messages: [{ role: 'user', content: 'Reply with the word ok.' }],
        maxTokens: 16,
      },
      key,
    );
    return `The key works with ${this.model}.`;
  }
}
