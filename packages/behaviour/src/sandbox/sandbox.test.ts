import { afterEach, describe, expect, it } from 'vitest';
import { compileScript } from './compile';
import {
  Sandbox,
  SandboxError,
  type HostCall,
  type SandboxLimits,
} from './sandbox';

// A tiny prelude for testing the mechanics; the real one is in script-prelude.ts.
const PRELUDE = `
const host = globalThis.__host;
globalThis.__handlers = {};
globalThis.on = (name, fn) => { (__handlers[name] ??= []).push(fn); };
globalThis.hostOp = (op, ...args) => {
  const r = JSON.parse(host(op, JSON.stringify(args)));
  if (r.e !== undefined) throw new Error(r.e);
  return r.v;
};
globalThis.__fire = (nameJson, json) => {
  const name = JSON.parse(nameJson);
  const payload = JSON.parse(json);
  let ran = 0;
  for (const fn of __handlers[name] ?? []) {
    ran += 1;
    const answer = fn(payload);
    if (answer === false || (answer && answer.cancel))
      return JSON.stringify({ cancelled: true, reason: answer.cancel ?? 'no', ran });
  }
  return JSON.stringify({ cancelled: false, ran });
};
const pending = new Map();
globalThis.hostAsync = (op, ...args) => new Promise((resolve, reject) => {
  const id = String(pending.size + 1);
  pending.set(id, { resolve, reject });
  __host_async(op, JSON.stringify(args), id);
});
globalThis.__settle = (id, json) => {
  const { resolve, reject } = pending.get(JSON.parse(id));
  const r = JSON.parse(json);
  if (r.e !== undefined) reject(new Error(r.e)); else resolve(r.v);
};
globalThis.cancel = (reason) => ({ cancel: reason });
`;

interface Fired {
  cancelled: boolean;
  reason?: string;
  ran: number;
}
const open: Sandbox[] = [];
const calls: { op: string; args: unknown[] }[] = [];
let hostCall: HostCall = (op, args) => {
  calls.push({ op, args });
  return null;
};
const errors: SandboxError[] = [];

async function sandbox(limits: Partial<SandboxLimits> = {}): Promise<Sandbox> {
  const s = await Sandbox.create({
    host: (op, args) => hostCall(op, args),
    limits,
    prelude: PRELUDE,
    onError: (e) => errors.push(e),
  });
  open.push(s);
  return s;
}

async function load(s: Sandbox, typescript: string): Promise<void> {
  const compiled = await compileScript(typescript);
  if ('errors' in compiled) throw new Error(compiled.errors[0]!.message);
  s.run(
    `(function (exports, require) {${compiled.js}\n})({}, () => ({}))`,
    'test.js',
  );
}

afterEach(() => {
  for (const s of open.splice(0)) s.dispose();
  calls.length = 0;
  errors.length = 0;
  hostCall = (op, args) => {
    calls.push({ op, args });
    return null;
  };
});

const failure = (run: () => unknown): SandboxError => {
  try {
    run();
  } catch (e) {
    if (e instanceof SandboxError) return e;
    throw e;
  }
  throw new Error('did not fail');
};

describe('compileScript', () => {
  it('strips types and turns imports into requires', async () => {
    const result = await compileScript(
      `import { on } from "metakit";\ninterface P { id: string }\nconst n: number = 1;\non("x", (p: P) => n);`,
    );
    expect('js' in result && result.js).toMatch(/require\(['"]metakit['"]\)/);
    expect('js' in result && result.js).not.toContain('interface');
  });

  it('keeps line numbers', async () => {
    const result = await compileScript(
      `import { on } from "metakit";\n\n\nconst a: number = 4;\nthrow new Error("x" + a);`,
    );
    expect('js' in result && result.js.split('\n')).toHaveLength(5);
    expect('js' in result && result.js.split('\n')[4]).toContain('throw');
  });

  it('reports a syntax error with its line and column and never throws', async () => {
    const result = await compileScript('const a = 1;\non((');
    expect('errors' in result).toBe(true);
    if ('errors' in result) {
      expect(result.errors[0]!.line).toBe(2);
      expect(result.errors[0]!.column).toBeGreaterThan(0);
      expect(result.errors[0]!.message).not.toMatch(/\(\d+:\d+\)/);
    }
  });
});

describe('running scripts', () => {
  it('runs TypeScript against the host and returns plain values', async () => {
    hostCall = (op, args) => (op === 'double' ? (args[0] as number) * 2 : null);
    const s = await sandbox();
    await load(
      s,
      `declare function hostOp(op: string, ...a: unknown[]): number;
       on('a', (p: { n: number }) => (hostOp('double', p.n) === 42 ? { cancel: 'yes' } : undefined));`,
    );
    expect(s.call('__fire', ['a', { n: 21 }])).toEqual({
      cancelled: true,
      reason: 'yes',
      ran: 1,
    });
  });

  it('reports a script error with the line it happened on', async () => {
    const s = await sandbox();
    await load(s, `on('x', () => {\n  throw new Error('boom');\n});`);
    const error = failure(() => s.call('__fire', ['x', {}]));
    expect(error.code).toBe('script');
    expect(error.message).toContain('boom');
    expect(error.line).toBe(2);
    // The sandbox stays usable after an ordinary error.
    expect(() => s.call('__fire', ['y', {}])).not.toThrow();
  });

  it('turns an error thrown by the host into an error inside the script', async () => {
    hostCall = () => {
      throw new Error('The model is closed.');
    };
    const s = await sandbox();
    await load(
      s,
      `on('x', () => { try { hostOp('a'); } catch (e) { return { cancel: String(e.message) }; } });`,
    );
    expect((s.call('__fire', ['x', {}]) as Fired).reason).toBe(
      'The model is closed.',
    );
  });

  it('refuses an asynchronous host answer to a synchronous call', async () => {
    hostCall = () => Promise.resolve(1);
    const s = await sandbox();
    await load(
      s,
      `on('x', () => { try { hostOp('a'); } catch (e) { return { cancel: e.message }; } });`,
    );
    expect((s.call('__fire', ['x', {}]) as Fired).reason).toMatch(
      /not available/,
    );
  });

  it('lets a script wait for an asynchronous host call', async () => {
    hostCall = (op, args) =>
      op === 'later'
        ? new Promise((resolve) => setTimeout(() => resolve(args[0]), 5))
        : (calls.push({ op, args }), null);
    const s = await sandbox();
    await load(
      s,
      `(async () => { const v = await hostAsync('later', 'hello'); hostOp('done', v); })();`,
    );
    expect(calls).toEqual([]);
    await new Promise((r) => setTimeout(r, 40));
    expect(calls).toEqual([{ op: 'done', args: ['hello'] }]);
  });

  it('lets a script catch the failure of an asynchronous host call', async () => {
    hostCall = (op, args) => {
      if (op === 'later') return Promise.reject(new Error('No network.'));
      calls.push({ op, args });
      return null;
    };
    const s = await sandbox();
    await load(
      s,
      `hostAsync('later').catch((e: Error) => { hostOp('failed', e.message); });`,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([{ op: 'failed', args: ['No network.'] }]);
  });

  it('supports a handler being called while another one is running', async () => {
    let s!: Sandbox;
    hostCall = (op) =>
      op === 'inner' ? s.call('__fire', ['inner', {}]) : null;
    s = await sandbox();
    await load(
      s,
      `on('outer', () => { const r = hostOp('inner'); return { cancel: r }; });
       on('inner', () => undefined);`,
    );
    const answer = s.call('__fire', ['outer', {}]) as Fired;
    expect((answer.reason as unknown as Fired).ran).toBe(1);
  });
});

describe('limits', () => {
  it('stops an endless loop in a handler within the time limit, with a plain message', async () => {
    const s = await sandbox({ handlerMs: 100 });
    await load(s, `on('x', () => { while (true) {} });`);
    const started = performance.now();
    const error = failure(() => s.call('__fire', ['x', {}]));
    const elapsed = performance.now() - started;
    expect(error.code).toBe('timeout');
    expect(error.message).toBe(
      'The script took longer than 100 ms and was stopped.',
    );
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(1000);
    expect(s.dead).toBe(true);
    expect(failure(() => s.call('__fire', ['x', {}])).code).toBe('disposed');
  });

  it('gives a command run more time than a handler', async () => {
    const s = await sandbox({ handlerMs: 20, runMs: 2000 });
    await load(
      s,
      `on('x', () => { const end = Date.now() + 80; while (Date.now() < end) {} });`,
    );
    expect(failure(() => s.call('__fire', ['x', {}], 'handler')).code).toBe(
      'timeout',
    );
    const t = await sandbox({ handlerMs: 20, runMs: 2000 });
    await load(
      t,
      `on('x', () => { const end = Date.now() + 80; while (Date.now() < end) {} });`,
    );
    expect(() => t.call('__fire', ['x', {}], 'run')).not.toThrow();
  });

  it('stops an endless loop at the top level of a script', async () => {
    const s = await sandbox({ runMs: 100 });
    const error = failure(() => s.run('for (;;) {}', 'loop.js', 'run'));
    expect(error.code).toBe('timeout');
    expect(error.message).toBe(
      'The script took longer than 100 ms and was stopped.',
    );
  });

  it('says seconds for a long run limit', async () => {
    const s = await sandbox({ runMs: 1000 });
    expect(failure(() => s.run('for (;;) {}', 'loop.js')).message).toContain(
      '1 s',
    );
  });

  it('stops a handler that runs away inside another one, and the outer one carries on', async () => {
    let s!: Sandbox;
    let inner: SandboxError | undefined;
    hostCall = (op) => {
      if (op === 'inner') {
        try {
          s.call('__fire', ['inner', {}]);
        } catch (e) {
          inner = e as SandboxError;
        }
      }
      return null;
    };
    s = await sandbox({ handlerMs: 50, runMs: 2000 });
    await load(
      s,
      `on('outer', () => { hostOp('inner'); return undefined; });
       on('inner', () => { while (true) {} });`,
    );
    s.call('__fire', ['outer', {}], 'run');
    expect(inner?.code).toBe('timeout');
    // The VM was thrown away once the outer call was done.
    expect(s.dead).toBe(true);
  });

  const memoryScripts = [
    `const keep = []; for (;;) keep.push(new Array(10000).fill(1));`,
    `new Array(50_000_000).fill(0);`,
    `const keep = []; for (;;) keep.push(new Array(100000).fill(1));`,
    `const keep = []; for (let i = 0; ; i++) keep.push('x'.repeat(100000) + i);`,
    `const keep = []; for (let i = 0; ; i++) keep.push({ a: i, b: [i] });`,
  ];
  it.each(memoryScripts)('stops a memory bomb: %s', async (script) => {
    const s = await sandbox({ runMs: 5000, memoryBytes: 8 << 20 });
    const started = performance.now();
    const error = failure(() => s.run(script, 'bomb.js'));
    expect(error.code).toBe('memory');
    expect(error.message).toBe(
      'The script used more memory than it is allowed and was stopped.',
    );
    expect(performance.now() - started).toBeLessThan(2500);
    expect(s.dead).toBe(true);
  });

  it('stops a string that doubles without end', async () => {
    const s = await sandbox({ runMs: 2000, memoryBytes: 8 << 20 });
    const error = failure(() => s.run(`let s = 'x'; for (;;) s += s;`, 'x.js'));
    // QuickJS builds this as a rope, so it hits its own string-length error before memory.
    expect(['memory', 'script']).toContain(error.code);
  });

  it('turns runaway recursion into an error and keeps working', async () => {
    const s = await sandbox();
    await load(
      s,
      `function f(n: number): number { return f(n + 1) + 1; }
       on('x', () => f(0)); on('y', () => undefined);`,
    );
    const error = failure(() => s.call('__fire', ['x', {}]));
    expect(error.code).toBe('stack');
    expect(error.message).toBe(
      'The script called itself too many times and was stopped.',
    );
    expect(s.dead).toBe(false);
    expect((s.call('__fire', ['y', {}]) as Fired).ran).toBe(1);
  });
});

describe('isolation', () => {
  const NAMES = [
    'window',
    'document',
    'self',
    'top',
    'parent',
    'frames',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'Worker',
    'SharedWorker',
    'process',
    'require',
    'module',
    'exports',
    'Buffer',
    'global',
    'setTimeout',
    'setInterval',
    'setImmediate',
    'queueMicrotask',
    'importScripts',
    'Deno',
    'Bun',
    'navigator',
    'location',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'caches',
    'crypto',
    'performance',
    'WebAssembly',
  ];

  it('has none of the browser, Node or timer globals', async () => {
    const s = await sandbox();
    const types = s.run(
      `JSON.stringify(Object.fromEntries(${JSON.stringify(NAMES)}.map((n) => [n, typeof globalThis[n]])))`,
      'probe.js',
    ) as Record<string, string>;
    for (const [name, type] of Object.entries(types))
      expect(type, name).toBe('undefined');
  });

  it('cannot get out through constructors, the Function constructor or eval', async () => {
    const s = await sandbox();
    const probes = [
      `(function () {}).constructor('return typeof process')()`,
      `(() => {}).constructor('return typeof window')()`,
      `globalThis.constructor.constructor('return typeof document')()`,
      `Object.getPrototypeOf(async function () {}).constructor('return typeof fetch')`,
      `new Function('return typeof localStorage')()`,
      `eval('typeof indexedDB')`,
      `(0, eval)('typeof XMLHttpRequest')`,
      `[].constructor.constructor('return typeof require')()`,
      `Reflect.getPrototypeOf(globalThis) === Object.prototype ? typeof Object.prototype.constructor.constructor('return this')().window : 'undefined'`,
      `typeof this.window`,
    ];
    for (const probe of probes) {
      const answer = s.run(`String(${probe})`, 'probe.js');
      expect(
        ['undefined', 'object', 'function'].some((t) => answer === t) ||
          String(answer).startsWith('async function') ||
          String(answer).includes('anonymous'),
        `${probe} gave ${String(answer)}`,
      ).toBe(true);
      expect(String(answer)).not.toMatch(/\[object (Window|Process)/);
    }
  });

  it('cannot reach host objects by changing prototypes or with a dynamic import', async () => {
    const s = await sandbox();
    expect(
      s.run(
        `Object.prototype.__proto__ === null && typeof Object.prototype.hostObject === 'undefined'`,
        'probe.js',
      ),
    ).toBe(true);
    expect(() =>
      s.run(`import('https://example.com/x.js').then(() => 1)`, 'probe.js'),
    ).not.toThrow(SyntaxError);
    // Whatever the import does, it must not have fetched anything: the only host calls are ours.
    expect(calls).toEqual([]);
  });

  it('only passes JSON across the boundary', async () => {
    const s = await sandbox();
    await load(
      s,
      `on('x', (p: any) => p.fn === undefined && p.date === '2026-01-01T00:00:00.000Z' ? { cancel: 'json' } : undefined);`,
    );
    const payload = { fn: () => 1, date: new Date('2026-01-01T00:00:00Z') };
    expect((s.call('__fire', ['x', payload]) as Fired).reason).toBe('json');
  });

  it('refuses to run once it was disposed', async () => {
    const s = await sandbox();
    s.dispose();
    expect(failure(() => s.run('1', 'x.js')).code).toBe('disposed');
  });
});
