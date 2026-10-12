import { describe, expect, it } from 'vitest';
import { generateDeclarations } from '@metakit-app/behaviour';
import { sampleKit } from '@metakit-app/core/testing';
import {
  createLanguageClient,
  type LanguageRequest,
  type LanguageResponse,
  type WorkerLike,
} from './script-language-client';
import { createLanguageServer } from './script-language';
import { loadTestLibs } from './test-libs';

/** A worker in the same thread, answering later like a real one, and out of order if asked to. */
function fakeWorker(
  handle: (request: LanguageRequest) => unknown,
  options: { reverse?: boolean } = {},
): WorkerLike & { terminated: boolean; sent: LanguageRequest[] } {
  const queue: LanguageRequest[] = [];
  const worker: WorkerLike & { terminated: boolean; sent: LanguageRequest[] } =
    {
      terminated: false,
      sent: [],
      onmessage: null,
      postMessage(request) {
        worker.sent.push(request);
        queue.push(request);
        queueMicrotask(() => {
          const batch = queue.splice(0);
          if (options.reverse) batch.reverse();
          for (const r of batch) {
            let response: LanguageResponse;
            try {
              response = { id: r.id, result: handle(r) };
            } catch (e) {
              response = { id: r.id, error: (e as Error).message };
            }
            worker.onmessage?.({ data: response });
          }
        });
      },
      terminate() {
        worker.terminated = true;
      },
    };
  return worker;
}

describe('the language client', () => {
  it('asks the language service through messages and gets typed answers back', async () => {
    const server = createLanguageServer(loadTestLibs());
    const worker = fakeWorker((r) => {
      switch (r.op) {
        case 'declarations':
          return void server.setDeclarations(r.text);
        case 'diagnostics':
          return server.diagnostics(r.source);
        case 'completions':
          return server.completions(r.source, r.position);
        case 'details':
          return server.details(r.source, r.position, r.name);
        case 'quickInfo':
          return server.quickInfo(r.source, r.position);
      }
    });
    const client = createLanguageClient(worker);
    await client.declarations(generateDeclarations(sampleKit()));
    expect(
      await client.diagnostics(
        'import { model } from "metakit";\nmodel.objects("Nope");',
      ),
    ).toHaveLength(1);
    const src = 'import { model } from "metakit";\nmodel.';
    const found = await client.completions(src, src.length);
    expect(found?.items.map((i) => i.label)).toContain('objects');
    expect(worker.sent.map((r) => r.op)).toEqual([
      'declarations',
      'diagnostics',
      'completions',
    ]);
  });

  it('matches answers to requests by id, whatever order they come in', async () => {
    const worker = fakeWorker(
      (r) =>
        r.op === 'quickInfo'
          ? { from: r.position, to: r.position, text: r.source, docs: '' }
          : null,
      { reverse: true },
    );
    const client = createLanguageClient(worker);
    const [a, b, c] = await Promise.all([
      client.quickInfo('one', 1),
      client.quickInfo('two', 2),
      client.quickInfo('three', 3),
    ]);
    expect([a?.text, b?.text, c?.text]).toEqual(['one', 'two', 'three']);
  });

  it('turns an error in the worker into a rejected promise', async () => {
    const client = createLanguageClient(
      fakeWorker(() => {
        throw new Error('boom');
      }),
    );
    await expect(client.diagnostics('x')).rejects.toThrow('boom');
  });

  it('stops the worker and rejects what is still waiting when disposed', async () => {
    const worker = fakeWorker(() => null);
    const client = createLanguageClient(worker);
    const waiting = client.diagnostics('x');
    client.dispose();
    await expect(waiting).rejects.toThrow('The editor was closed.');
    expect(worker.terminated).toBe(true);
  });
});
