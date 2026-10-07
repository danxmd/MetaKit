import type { StorageAdapter, Unwatch, WatchCallback } from './adapter';
import { joinPath } from './paths';

export interface Timers {
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface PollWatcher {
  stop: Unwatch;
  /** Looks now instead of waiting for the next tick, e.g. when a native observer fired. */
  check(): Promise<void>;
}

async function signatures(
  adapter: Pick<StorageAdapter, 'list'>,
  dir: string,
  into: Map<string, string>,
): Promise<void> {
  for (const entry of await adapter.list(dir)) {
    const path = joinPath(dir, entry.name);
    if (entry.kind === 'directory') {
      await signatures(adapter, path, into);
    } else {
      into.set(path, `${entry.size ?? '?'}:${entry.modified ?? '?'}`);
    }
  }
}

/**
 * Change detection by listing: every `intervalMs` the folder (and everything under it) is read
 * and compared with the last look. It is the fallback where no native observer exists, and the
 * safety net where one does.
 */
export function pollWatch(
  adapter: Pick<StorageAdapter, 'list'>,
  dir: string,
  callback: WatchCallback,
  options: { intervalMs?: number; timers?: Timers } = {},
): PollWatcher {
  const timers: Timers = options.timers ?? {
    setInterval: (h, ms) => setInterval(h, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  };
  let last: Map<string, string> | null = null;
  let running = false;
  let stopped = false;

  const check = async (): Promise<void> => {
    if (running || stopped) return;
    running = true;
    try {
      const now = new Map<string, string>();
      await signatures(adapter, dir, now);
      if (last !== null) {
        const changed: string[] = [];
        for (const [path, sig] of now)
          if (last.get(path) !== sig) changed.push(path);
        for (const path of last.keys()) if (!now.has(path)) changed.push(path);
        if (changed.length > 0 && !stopped) callback(changed.sort());
      }
      last = now;
    } finally {
      running = false;
    }
  };

  // The first look is the baseline; only later differences are reported.
  void check();
  const handle = timers.setInterval(
    () => void check(),
    options.intervalMs ?? 2000,
  );
  return {
    check,
    stop: () => {
      stopped = true;
      timers.clearInterval(handle);
    },
  };
}
