import type {
  EditorCompletions,
  EditorDiagnostic,
  EditorInfo,
} from './script-language';

export type LanguageRequest = { id: number } & (
  | { op: 'declarations'; text: string }
  | { op: 'diagnostics'; source: string }
  | { op: 'completions'; source: string; position: number }
  | { op: 'details'; source: string; position: number; name: string }
  | { op: 'quickInfo'; source: string; position: number }
);

export type LanguageResponse =
  { id: number; result: unknown } | { id: number; error: string };

/** The part of a Worker the client uses, so that a test can stand in for one. */
export interface WorkerLike {
  postMessage(message: LanguageRequest): void;
  onmessage: ((event: { data: LanguageResponse }) => void) | null;
  terminate(): void;
}

export interface LanguageClient {
  declarations(text: string): Promise<void>;
  diagnostics(source: string): Promise<EditorDiagnostic[]>;
  completions(
    source: string,
    position: number,
  ): Promise<EditorCompletions | null>;
  details(
    source: string,
    position: number,
    name: string,
  ): Promise<EditorInfo | null>;
  quickInfo(source: string, position: number): Promise<EditorInfo | null>;
  dispose(): void;
}

type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Talks to the language worker; every call is a request with an id and a promise for the answer. */
export function createLanguageClient(worker: WorkerLike): LanguageClient {
  let next = 1;
  const waiting = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  worker.onmessage = ({ data }) => {
    const entry = waiting.get(data.id);
    if (!entry) return;
    waiting.delete(data.id);
    if ('error' in data) entry.reject(new Error(data.error));
    else entry.resolve(data.result);
  };
  const ask = <T>(request: Distribute<LanguageRequest>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = next++;
      waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ ...request, id } as LanguageRequest);
    });
  return {
    declarations: (text) =>
      ask<null>({ op: 'declarations', text }).then(() => {}),
    diagnostics: (source) => ask({ op: 'diagnostics', source }),
    completions: (source, position) =>
      ask({ op: 'completions', source, position }),
    details: (source, position, name) =>
      ask({ op: 'details', source, position, name }),
    quickInfo: (source, position) => ask({ op: 'quickInfo', source, position }),
    dispose() {
      worker.terminate();
      for (const entry of waiting.values())
        entry.reject(new Error('The editor was closed.'));
      waiting.clear();
    },
  };
}
