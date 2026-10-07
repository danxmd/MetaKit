import { describe, expect, it } from 'vitest';
import { AssistantError, ClaudeProvider } from './provider';
import { redact } from './redact';

const FAKE_KEY = 'sk-ant-fake-not-a-real-key-0002';

function reply(text: string): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/** A fetch that never reaches the network; it records what the SDK would have sent. */
function fakeFetch(respond: (body: Record<string, unknown>) => Response) {
  const calls: {
    url: string;
    headers: Headers;
    body: Record<string, unknown>;
  }[] = [];
  const fetchFn = (async (url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<
      string,
      unknown
    >;
    calls.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body,
    });
    return respond(body);
  }) as typeof fetch;
  return { fetch: fetchFn, calls };
}

describe('ClaudeProvider', () => {
  it('sends the request through the SDK with the model and the key', async () => {
    const f = fakeFetch(() => reply('hello'));
    const provider = new ClaudeProvider({ fetch: f.fetch });
    const text = await provider.complete(
      { system: 'sys', messages: [{ role: 'user', content: 'hi' }] },
      FAKE_KEY,
    );
    expect(text).toBe('hello');
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.body).toMatchObject({
      model: 'claude-sonnet-5-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(f.calls[0]!.headers.get('x-api-key')).toBe(FAKE_KEY);
  });

  it('tests a key with a request that holds no tool or model content', async () => {
    const f = fakeFetch(() => reply('ok'));
    const message = await new ClaudeProvider({
      fetch: f.fetch,
      model: 'claude-test',
    }).test(FAKE_KEY);
    expect(message).toContain('claude-test');
    expect(JSON.stringify(f.calls[0]!.body)).not.toMatch(/cls_|Task/);
  });

  it('explains a refused key without repeating it', async () => {
    const f = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            type: 'error',
            error: {
              type: 'authentication_error',
              message: `invalid x-api-key ${FAKE_KEY}`,
            },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    );
    const error = await new ClaudeProvider({ fetch: f.fetch })
      .test(FAKE_KEY)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AssistantError);
    const e = error as AssistantError;
    expect(e.status).toBe(401);
    expect(e.message).toContain('did not accept this key');
    expect(
      JSON.stringify({ m: e.message, s: e.stack, c: e.cause }),
    ).not.toContain(FAKE_KEY);
  });

  it('removes the key from any other error text', async () => {
    const f = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            type: 'error',
            error: {
              type: 'invalid_request_error',
              message: `bad ${FAKE_KEY}`,
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    const error = (await new ClaudeProvider({ fetch: f.fetch })
      .complete(
        { system: 's', messages: [{ role: 'user', content: 'x' }] },
        FAKE_KEY,
      )
      .catch((e: unknown) => e)) as AssistantError;
    expect(error.message).not.toContain(FAKE_KEY);
    expect(error.message).toContain('[key removed]');
  });

  it('loads the SDK only when it is used', async () => {
    let loads = 0;
    const provider = new ClaudeProvider({
      loadSdk: async () => {
        loads++;
        return class {
          messages = {
            create: async () => ({ content: [{ type: 'text', text: 'x' }] }),
          };
        } as never;
      },
    });
    expect(loads).toBe(0);
    await provider.complete(
      { system: 's', messages: [{ role: 'user', content: 'x' }] },
      FAKE_KEY,
    );
    expect(loads).toBe(1);
  });
});

describe('redact', () => {
  it('removes keys, key-shaped text and key headers', () => {
    const text = `a ${FAKE_KEY} b sk-ant-api03-ABCDEFGHIJKL c x-api-key: abc123 d`;
    const out = redact(text, FAKE_KEY);
    expect(out).not.toContain('sk-ant');
    expect(out).not.toContain('abc123');
  });
});
