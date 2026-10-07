import { afterEach, describe, expect, it } from 'vitest';
import { Sandbox, SandboxError, type StubApi } from './sandbox';

interface Host {
  api: StubApi;
  attrs: Map<string, unknown>;
  logs: string[];
}

function host(initial: Record<string, unknown> = {}): Host {
  const attrs = new Map(Object.entries(initial));
  const logs: string[] = [];
  return {
    attrs,
    logs,
    api: {
      getAttr: (id, key) => attrs.get(`${id}.${key}`),
      setAttr: (id, key, value) => void attrs.set(`${id}.${key}`, value),
      log: (m) => void logs.push(m),
    },
  };
}

const open: Sandbox[] = [];
async function sandbox(
  h: Host,
  limits = {
    timeMs: 200,
    memoryBytes: 16 * 1024 * 1024,
    stackBytes: 256 * 1024,
  },
) {
  const s = await Sandbox.create(h.api, limits);
  open.push(s);
  return s;
}
afterEach(() => {
  for (const s of open.splice(0)) s.dispose();
});

const failure = async (run: () => unknown): Promise<SandboxError> => {
  try {
    await run();
  } catch (e) {
    if (e instanceof SandboxError) return e;
    throw e;
  }
  throw new Error('did not fail');
};

describe('scripts', () => {
  it('compiles TypeScript and runs it against the stub API', async () => {
    const h = host({ 'el_1.cost': 40 });
    const s = await sandbox(h);
    await s.load(`
      interface Payload { id: string }
      declare const model: { get(id: string, key: string): number; set(id: string, key: string, v: unknown): void };
      declare function on(name: string, fn: (p: Payload) => unknown): void;
      declare function log(...a: unknown[]): void;
      on('after:changeCost', (p: Payload) => {
        const cost: number = model.get(p.id, 'cost') as number;
        model.set(p.id, 'doubled', (cost * 2) as number);
        log('doubled', cost * 2);
      });
    `);
    const result = s.fire('after:changeCost', { id: 'el_1' });
    expect(result).toEqual({ cancelled: false, ran: 1 });
    expect(h.attrs.get('el_1.doubled')).toBe(80);
    expect(h.logs).toEqual(['doubled 80']);
  });

  it('runs nothing for events nobody listens to', async () => {
    const s = await sandbox(host());
    await s.load(`on('before:a', () => undefined);`);
    expect(s.fire('before:b', {})).toEqual({ cancelled: false, ran: 0 });
  });

  it('reports script errors without stopping the sandbox', async () => {
    const s = await sandbox(host());
    await s.load(`on('before:x', () => { throw new Error('boom'); });`);
    const error = await failure(() => s.fire('before:x', {}));
    expect(error.code).toBe('script');
    expect(error.message).toContain('boom');
    expect(s.fire('before:y', {})).toEqual({ cancelled: false, ran: 0 });
  });

  it('reports syntax errors in the script', async () => {
    const s = await sandbox(host());
    expect((await failure(() => s.load('on(('))).code).toBe('script');
  });
});

describe('synchronous before handlers', () => {
  const script = `
    declare function on(name: string, fn: (p: any) => unknown): void;
    declare function cancel(reason?: string): unknown;
    declare const model: { get(id: string, key: string): unknown };
    on('before:deleteElement', (p) => {
      if (model.get(p.id, 'locked') === true) return cancel('Locked elements cannot be deleted');
    });
    on('before:deleteElement', (p) => {
      if (p.kind === 'start') return false;
    });
  `;

  // The host action, as the command API will wrap it: ask the scripts first, then act.
  function deleteElement(
    s: Sandbox,
    store: Set<string>,
    id: string,
    kind = 'task',
  ) {
    const answer = s.fire('before:deleteElement', { id, kind });
    if (!answer.cancelled) store.delete(id);
    return answer;
  }

  it('cancels the action and gives the reason, before the host acts', async () => {
    const h = host({ 'el_1.locked': true });
    const s = await sandbox(h);
    await s.load(script);
    const store = new Set(['el_1']);
    const answer = deleteElement(s, store, 'el_1');
    expect(answer).toEqual({
      cancelled: true,
      reason: 'Locked elements cannot be deleted',
      ran: 1,
    });
    expect(store.has('el_1')).toBe(true);
  });

  it('lets the action through when no handler objects', async () => {
    const h = host({ 'el_2.locked': false });
    const s = await sandbox(h);
    await s.load(script);
    const store = new Set(['el_2']);
    expect(deleteElement(s, store, 'el_2').cancelled).toBe(false);
    expect(store.has('el_2')).toBe(false);
  });

  it('stops at the first handler that cancels, and supports `return false`', async () => {
    const s = await sandbox(host({ 'el_3.locked': false }));
    await s.load(script);
    const answer = deleteElement(s, new Set(['el_3']), 'el_3', 'start');
    expect(answer).toEqual({
      cancelled: true,
      reason: 'Cancelled by a script',
      ran: 2,
    });
  });

  it('returns a plain value, not a promise', async () => {
    const s = await sandbox(host());
    await s.load(script);
    expect(s.fire('before:deleteElement', { id: 'x' })).not.toBeInstanceOf(
      Promise,
    );
  });
});

describe('limits', () => {
  it('stops an endless loop in a handler within the time limit', async () => {
    const s = await sandbox(host(), {
      timeMs: 100,
      memoryBytes: 16 << 20,
      stackBytes: 256 << 10,
    });
    await s.load(`on('before:x', () => { while (true) {} });`);
    const started = performance.now();
    const error = await failure(() => s.fire('before:x', {}));
    const elapsed = performance.now() - started;
    expect(error.code).toBe('timeout');
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(1000);
    expect((await failure(() => s.fire('before:x', {}))).code).toBe('disposed');
  });

  it('stops an endless loop at the top level of a script', async () => {
    const s = await sandbox(host(), {
      timeMs: 100,
      memoryBytes: 16 << 20,
      stackBytes: 256 << 10,
    });
    expect((await failure(() => s.load('for (;;) {}'))).code).toBe('timeout');
  });

  it('stops a script that allocates without end', async () => {
    const s = await sandbox(host(), {
      timeMs: 2000,
      memoryBytes: 8 << 20,
      stackBytes: 256 << 10,
    });
    const error = await failure(() =>
      s.load(
        `const keep: number[][] = []; for (;;) keep.push(new Array(10000).fill(1));`,
      ),
    );
    expect(error.code).toBe('memory');
  });

  it('stops a single huge allocation', async () => {
    const s = await sandbox(host(), {
      timeMs: 2000,
      memoryBytes: 8 << 20,
      stackBytes: 256 << 10,
    });
    expect(
      (await failure(() => s.load(`new Array(50_000_000).fill(0);`))).code,
    ).toBe('memory');
  });

  it('stops big arrays, big strings and many objects, whatever their shape', async () => {
    const scripts = [
      `const keep: unknown[] = []; for (;;) keep.push(new Array(100000).fill(1));`,
      `const keep: string[] = []; for (let i = 0; ; i++) keep.push('x'.repeat(100000) + i);`,
      `const keep: unknown[] = []; for (let i = 0; ; i++) keep.push({ a: i, b: [i] });`,
    ];
    for (const script of scripts) {
      const s = await sandbox(host(), {
        timeMs: 5000,
        memoryBytes: 8 << 20,
        stackBytes: 256 << 10,
      });
      const started = performance.now();
      expect((await failure(() => s.load(script))).code, script).toBe('memory');
      expect(performance.now() - started).toBeLessThan(2000);
    }
  });

  it('stops a string that doubles without end', async () => {
    const s = await sandbox(host(), {
      timeMs: 2000,
      memoryBytes: 8 << 20,
      stackBytes: 256 << 10,
    });
    // QuickJS builds this as a rope, so it hits its own string-length error before memory.
    const error = await failure(() => s.load(`let s = 'x'; for (;;) s += s;`));
    expect(['memory', 'script']).toContain(error.code);
  });

  it('turns runaway recursion into an error', async () => {
    const s = await sandbox(host());
    await s.load(
      `function f(n: number): number { return f(n + 1) + 1; } on('before:x', () => f(0));`,
    );
    expect((await failure(() => s.fire('before:x', {}))).code).toBe('stack');
  });

  it('keeps working after a recursion error', async () => {
    const s = await sandbox(host());
    await s.load(
      `function f(n: number): number { return f(n + 1) + 1; } on('before:x', () => f(0)); on('before:y', () => undefined);`,
    );
    await failure(() => s.fire('before:x', {}));
    expect(s.fire('before:y', {}).ran).toBe(1);
  });
});

describe('isolation', () => {
  it('has no network, file, process or timer access', async () => {
    const s = await sandbox(host());
    const types = s.eval(`JSON.stringify(Object.fromEntries(
      ['fetch','XMLHttpRequest','WebSocket','process','require','module','window','document','self',
       'setTimeout','setInterval','importScripts','Deno','Bun','navigator','localStorage','indexedDB']
        .map((n) => [n, typeof globalThis[n]])))`) as Record<string, string>;
    for (const [name, type] of Object.entries(types))
      expect(type, name).toBe('undefined');
  });

  it('cannot reach the host through the API objects', async () => {
    const h = host();
    const s = await sandbox(h);
    await s.load(`
      on('before:x', () => {
        const names = Object.getOwnPropertyNames(globalThis).filter((n) => n.startsWith('__host'));
        log(names.join(','));
        return undefined;
      });
    `);
    s.fire('before:x', {});
    // The three host bridge functions exist (the prelude uses them) but only move strings.
    expect(h.logs[0]).toBe('__host_get,__host_set,__host_log');
  });

  it('only passes JSON across the boundary', async () => {
    const s = await sandbox(host());
    await s.load(
      `on('before:x', (p) => p.fn === undefined && p.date === '2026-01-01T00:00:00.000Z' ? cancel('json') : undefined);`,
    );
    const result = s.fire('before:x', {
      fn: () => 1,
      date: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result.reason).toBe('json');
  });
});
