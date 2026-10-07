import { describe, it } from 'vitest';
import { adapterContract } from './contract';
import { MemoryAdapter } from './memory';

describe('MemoryAdapter', () => {
  for (const c of adapterContract()) {
    it(c.name, async () => {
      const one = new MemoryAdapter('aaaa0001', { pollIntervalMs: 20 });
      const two = one.asInstance('bbbb0002');
      await c.run({ one, two, close: async () => undefined });
    });
  }
});
