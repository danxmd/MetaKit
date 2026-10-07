import type { Model } from '@metakit-app/core';
import type { ElkNode } from 'elkjs/lib/elk-api';
import {
  LayoutError,
  layoutModel,
  type LayoutEngine,
  type LayoutOptions,
  type LayoutResult,
} from './elk-layout';

/** The elk-api worker protocol: a layout command in, the laid-out graph or an error out. */
export type LayoutCommand =
  | { cmd: 'register'; algorithms: string[] }
  | { cmd: 'layout'; graph: ElkNode; layoutOptions: Record<string, string> };
export type LayoutRequest = { id: number } & LayoutCommand;
export type LayoutResponse =
  { id: number; data?: ElkNode } | { id: number; error: unknown };

export interface WorkerLike {
  postMessage(message: LayoutRequest): void;
  terminate(): void;
  onmessage: ((event: { data: LayoutResponse }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
}

/** The app's worker. Vite recognises this exact form and bundles the worker file. */
function defaultWorker(): WorkerLike {
  return new Worker(new URL('./elk-worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

/**
 * Runs ELK in a Web Worker. The worker starts on first use and stops when a layout is cancelled
 * or times out (ELK cannot be interrupted from inside), so the next layout starts a fresh one.
 */
export class WorkerEngine implements LayoutEngine {
  private worker: WorkerLike | null = null;
  private ready: Promise<unknown> | null = null;
  private next = 1;
  private readonly pending = new Map<
    number,
    { resolve(value: ElkNode | undefined): void; reject(error: Error): void }
  >();

  constructor(private readonly factory: () => WorkerLike = defaultWorker) {}

  /** Sends one message and waits for the answer with the same id. */
  private request(
    worker: WorkerLike,
    message: LayoutCommand,
  ): Promise<ElkNode | undefined> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id });
    });
  }

  private start(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.factory();
    worker.onmessage = (event) => {
      const data = event.data;
      const waiting = this.pending.get(data.id);
      if (!waiting) return;
      this.pending.delete(data.id);
      if ('error' in data)
        waiting.reject(new LayoutError('failed', describeError(data.error)));
      else waiting.resolve(data.data);
    };
    worker.onerror = (event) => this.fail(event.message);
    // The elk worker only knows the algorithms it was told about.
    this.ready = this.request(worker, {
      cmd: 'register',
      algorithms: ['layered'],
    });
    this.worker = worker;
    return worker;
  }

  /** Ends the worker and rejects everything waiting on it. */
  private fail(reason: string | undefined, error?: LayoutError): void {
    const failure =
      error ??
      new LayoutError(
        'failed',
        reason ?? 'The layout worker stopped unexpectedly.',
      );
    const waiting = [...this.pending.values()];
    this.pending.clear();
    this.dispose();
    for (const w of waiting) w.reject(failure);
  }

  run(
    graph: ElkNode,
    control: { signal?: AbortSignal; timeoutMs: number },
  ): Promise<ElkNode> {
    if (control.signal?.aborted)
      return Promise.reject(new LayoutError('cancelled', 'Layout cancelled.'));
    const worker = this.start();
    return new Promise<ElkNode>((resolve, reject) => {
      const stop = (error: LayoutError) => {
        cleanup();
        this.fail(undefined, error);
        reject(error);
      };
      const onAbort = () =>
        stop(new LayoutError('cancelled', 'Layout cancelled.'));
      const timer = setTimeout(
        () =>
          stop(
            new LayoutError(
              'timeout',
              'The layout took too long and was stopped.',
            ),
          ),
        control.timeoutMs,
      );
      const cleanup = () => {
        clearTimeout(timer);
        control.signal?.removeEventListener('abort', onAbort);
      };
      control.signal?.addEventListener('abort', onAbort, { once: true });
      this.ready
        ?.then(() =>
          this.request(worker, { cmd: 'layout', graph, layoutOptions: {} }),
        )
        .then((result) => {
          cleanup();
          resolve(result!);
        })
        .catch((error: unknown) => {
          cleanup();
          reject(error);
        });
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}

export interface LayoutServiceOptions {
  /** How ELK runs. Defaults to a Web Worker. */
  engine?: LayoutEngine | 'worker';
  /** For hosts that cannot use `new Worker(new URL(...))`, such as test bundles. */
  workerFactory?: () => WorkerLike;
}

export class LayoutService {
  private readonly engine: LayoutEngine;

  constructor(options: LayoutServiceOptions = {}) {
    const e = options.engine ?? 'worker';
    this.engine = e === 'worker' ? new WorkerEngine(options.workerFactory) : e;
  }

  layout(model: Model, options: LayoutOptions = {}): Promise<LayoutResult> {
    return layoutModel(this.engine, model, options);
  }

  dispose(): void {
    this.engine.dispose();
  }
}

function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return 'The layout failed.';
}
