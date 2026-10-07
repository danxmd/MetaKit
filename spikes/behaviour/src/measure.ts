import { compile } from './formula';
import type { StubApi } from './sandbox';

const now = () => performance.now();

async function time<T>(run: () => Promise<T> | T): Promise<[T, number]> {
  const started = now();
  const value = await run();
  return [value, now() - started];
}

function resourceSizes(): {
  name: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}[] {
  return performance
    .getEntriesByType('resource')
    .map((e) => e as PerformanceResourceTiming)
    .map((e) => ({
      name: e.name.split('/').pop()!,
      transferSize: e.transferSize,
      encodedBodySize: e.encodedBodySize,
      decodedBodySize: e.decodedBodySize,
    }));
}

/** Resource names fetched so far that belong to QuickJS or the TypeScript compiler. */
export function sandboxRequests(): string[] {
  return resourceSizes()
    .map((r) => r.name)
    .filter((n) => /wasm|quickjs|sucrase|sandbox/i.test(n));
}

const attrs = new Map<string, unknown>([['el_1.locked', true]]);
const api: StubApi = {
  getAttr: (id, key) => attrs.get(`${id}.${key}`),
  setAttr: (id, key, value) => void attrs.set(`${id}.${key}`, value),
  log: () => undefined,
};

const SCRIPT = `
declare function on(name: string, fn: (p: { id: string }) => unknown): void;
declare function cancel(reason?: string): unknown;
declare const model: { get(id: string, key: string): unknown; set(id: string, key: string, v: unknown): void };
on('before:deleteElement', (p) => {
  if (model.get(p.id, 'locked') === true) return cancel('Locked');
});
on('after:changeCost', (p) => {
  const cost = model.get(p.id, 'cost') as number;
  model.set(p.id, 'total', cost * 3);
});
`;

export interface Measurements {
  /** Milliseconds, measured in this browser. */
  loadCodeMs: number;
  createFirstSandboxMs: number;
  createNextSandboxMs: number;
  firstCompileMs: number;
  compileMs: number;
  /** Per call, in microseconds. */
  evalOnePlusOneUs: number;
  fireCancelUs: number;
  fireWithHostCallsUs: number;
  formulaCompileUs: number;
  formulaEvaluateUs: number;
  formulaEvaluateBigUs: number;
  limits: {
    timeLimitMs: number;
    timeActualMs: number;
    memoryDetectMs: number;
    memoryCapMb: number;
    stackDetectMs: number;
    cancelRoundTripUs: number;
  };
  requestsBefore: string[];
  requestsAfter: string[];
  resources: ReturnType<typeof resourceSizes>;
  userAgent: string;
}

export async function measureAll(wasmUrl: string): Promise<Measurements> {
  const requestsBefore = sandboxRequests();
  // Imported here, not at the top, so that merely loading the page never pulls the sandbox in.
  const { Sandbox, compileScript, loadQuickJSCode } = await import('./sandbox');

  const [, loadCodeMs] = await time(() => loadQuickJSCode());
  const [first, createFirstSandboxMs] = await time(() =>
    Sandbox.create(
      api,
      { timeMs: 200, memoryBytes: 16 << 20, stackBytes: 256 << 10 },
      { wasmUrl },
    ),
  );
  const [second, createNextSandboxMs] = await time(() =>
    Sandbox.create(
      api,
      { timeMs: 200, memoryBytes: 16 << 20, stackBytes: 256 << 10 },
      { wasmUrl },
    ),
  );
  second.dispose();

  const [, firstCompileMs] = await time(() => compileScript(SCRIPT));
  const [, compileMs] = await time(() => compileScript(SCRIPT));
  await first.load(SCRIPT);

  const loops = 2000;
  const average = async (run: () => void): Promise<number> => {
    for (let i = 0; i < 100; i++) run();
    const started = now();
    for (let i = 0; i < loops; i++) run();
    return ((now() - started) / loops) * 1000;
  };
  const evalOnePlusOneUs = await average(() => first.eval('1 + 1'));
  const fireCancelUs = await average(() =>
    first.fire('before:deleteElement', { id: 'el_1' }),
  );
  const fireWithHostCallsUs = await average(() =>
    first.fire('after:changeCost', { id: 'el_1' }),
  );
  const [cancelAnswer, cancelRoundTripMs] = await time(() =>
    first.fire('before:deleteElement', { id: 'el_1' }),
  );
  if (!cancelAnswer.cancelled)
    throw new Error('the before handler did not cancel');
  first.dispose();

  // Limits, each on a fresh sandbox, as the host would create one per script.
  const timeLimitMs = 100;
  const timer = await Sandbox.create(
    api,
    { timeMs: timeLimitMs, memoryBytes: 16 << 20, stackBytes: 256 << 10 },
    { wasmUrl },
  );
  const [, timeActualMs] = await time(async () => {
    try {
      await timer.load('for (;;) {}');
    } catch {
      /* expected: timeout */
    }
  });
  const memoryCapMb = 16;
  const memory = await Sandbox.create(
    api,
    { timeMs: 5000, memoryBytes: memoryCapMb << 20, stackBytes: 256 << 10 },
    { wasmUrl },
  );
  const [, memoryDetectMs] = await time(async () => {
    try {
      await memory.load(
        'const k: unknown[] = []; for (;;) k.push(new Array(100000).fill(1));',
      );
    } catch {
      /* expected: memory */
    }
  });
  const stack = await Sandbox.create(
    api,
    { timeMs: 5000, memoryBytes: 16 << 20, stackBytes: 256 << 10 },
    { wasmUrl },
  );
  const [, stackDetectMs] = await time(async () => {
    try {
      await stack.load(
        'function f(n: number): number { return f(n + 1) + 1; } f(0);',
      );
    } catch {
      /* expected: stack */
    }
  });
  stack.dispose();

  // Formula engine, in this browser.
  const source =
    "IF(priority == 'High', cost * qty, 0) + SUM(1, 2, qty) - round(cost / 7, 2)";
  const scope = { priority: 'High', cost: 40, qty: 3 };
  const formulaCompileUs = await average(() => void compile(source));
  const compiled = compile(source);
  const formulaEvaluateUs = await average(() => void compiled.evaluate(scope));
  const big = compile(
    Array.from({ length: 200 }, (_, i) => `a${i % 10} * ${i}`).join(' + '),
  );
  const bigScope = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`a${i}`, i + 1]),
  );
  const formulaEvaluateBigUs = await average(() => void big.evaluate(bigScope));

  return {
    loadCodeMs,
    createFirstSandboxMs,
    createNextSandboxMs,
    firstCompileMs,
    compileMs,
    evalOnePlusOneUs,
    fireCancelUs,
    fireWithHostCallsUs,
    formulaCompileUs,
    formulaEvaluateUs,
    formulaEvaluateBigUs,
    limits: {
      timeLimitMs,
      timeActualMs,
      memoryDetectMs,
      memoryCapMb,
      stackDetectMs,
      cancelRoundTripUs: cancelRoundTripMs * 1000,
    },
    requestsBefore,
    requestsAfter: sandboxRequests(),
    resources: resourceSizes(),
    userAgent: navigator.userAgent,
  };
}
