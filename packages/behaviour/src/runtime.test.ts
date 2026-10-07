import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  type ElementId,
  type EventPayload,
} from '@metakit-app/core';
import { SAMPLE_FOR_TESTS } from '@metakit-app/core/testing';
import { createBehaviour, silentHost } from './index';

describe('createBehaviour', () => {
  it('calculates, announces events and detaches', () => {
    const { tool, model, ids } = SAMPLE_FOR_TESTS();
    const store = createModelStore(model, { tool });
    const b = createBehaviour({ store, tool: () => tool, host: silentHost() });
    const seen: EventPayload[] = [];
    b.bus.on('object.*', (p) => void seen.push(p));
    const id = (
      store.execute({
        type: 'createElement',
        class: ids.task,
        x: 0,
        y: 0,
        attrs: { [ids.effort]: 2 },
      }) as unknown as { value: ElementId }
    ).value;
    expect(seen.map((e) => e.event)).toEqual([
      'object.creating',
      'object.created',
    ]);
    expect(b.calculator.get(id, 'Cost')).toBe(170);
    b.dispose();
    store.execute({ type: 'createElement', class: ids.task, x: 0, y: 0 });
    expect(seen).toHaveLength(2);
  });
});
