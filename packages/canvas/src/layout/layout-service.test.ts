import { describe, expect, it, vi } from 'vitest';
import type { ElkNode } from 'elkjs/lib/elk-api';
import { WorkerEngine, type WorkerLike } from './layout-service';

function fakeWorker(reply: boolean) {
  const worker: WorkerLike & { terminated: number } = {
    terminated: 0,
    onmessage: null,
    onerror: null,
    postMessage(message) {
      if (reply)
        queueMicrotask(() =>
          worker.onmessage?.({
            data: {
              id: message.id,
              data: message.cmd === 'layout' ? message.graph : undefined,
            },
          }),
        );
    },
    terminate() {
      worker.terminated++;
    },
  };
  return worker;
}

const graph: ElkNode = { id: 'root' };

describe('WorkerEngine', () => {
  it('returns the worker answer and reuses the worker', async () => {
    const worker = fakeWorker(true);
    const factory = vi.fn(() => worker);
    const engine = new WorkerEngine(factory);
    await expect(engine.run(graph, { timeoutMs: 1000 })).resolves.toBe(graph);
    await engine.run(graph, { timeoutMs: 1000 });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('stops a slow layout and starts a fresh worker next time', async () => {
    const worker = fakeWorker(false);
    const factory = vi.fn(() => worker);
    const engine = new WorkerEngine(factory);
    await expect(engine.run(graph, { timeoutMs: 10 })).rejects.toMatchObject({
      reason: 'timeout',
    });
    expect(worker.terminated).toBe(1);
    await expect(engine.run(graph, { timeoutMs: 10 })).rejects.toBeTruthy();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('cancels on abort', async () => {
    const worker = fakeWorker(false);
    const engine = new WorkerEngine(() => worker);
    const controller = new AbortController();
    const run = engine.run(graph, {
      timeoutMs: 1000,
      signal: controller.signal,
    });
    controller.abort();
    await expect(run).rejects.toMatchObject({ reason: 'cancelled' });
    expect(worker.terminated).toBe(1);
  });
});
