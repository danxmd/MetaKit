import { describe, expect, it, vi } from 'vitest';
import { ConfirmStore, offerUndo, ToastStore, type Timers } from './feedback';

function fakeTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let next = 1;
  const timers: Timers = {
    set: (fn, ms) => {
      pending.set(next, { fn, ms });
      return next++;
    },
    clear: (h) => pending.delete(h as number),
  };
  const fire = () => {
    for (const [id, t] of [...pending]) {
      pending.delete(id);
      t.fn();
    }
  };
  return { timers, pending, fire };
}

describe('ToastStore', () => {
  it('shows a toast and closes it after a while', () => {
    const { timers, pending, fire } = fakeTimers();
    const toasts = new ToastStore(timers);
    toasts.show('Saved');
    expect(toasts.value?.text).toBe('Saved');
    expect([...pending.values()][0]?.ms).toBe(6000);
    fire();
    expect(toasts.value).toBeNull();
  });

  it('keeps toasts with Undo longer and runs Undo once', () => {
    const { timers, pending } = fakeTimers();
    const toasts = new ToastStore(timers);
    const undo = vi.fn();
    toasts.show('Deleted class Task', { undo });
    expect([...pending.values()][0]?.ms).toBe(10_000);
    toasts.undo();
    toasts.undo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(toasts.value).toBeNull();
    expect(pending.size).toBe(0);
  });

  it('a new toast replaces the old one, whose timer no longer closes it', () => {
    const { timers, pending, fire } = fakeTimers();
    const toasts = new ToastStore(timers);
    toasts.show('First');
    const firstId = toasts.value!.id;
    toasts.show('Second');
    expect(pending.size).toBe(1);
    toasts.dismiss(firstId);
    expect(toasts.value?.text).toBe('Second');
    fire();
    expect(toasts.value).toBeNull();
  });

  it('notifies subscribers at once and on change', () => {
    const toasts = new ToastStore(fakeTimers().timers);
    const seen: (string | undefined)[] = [];
    const stop = toasts.subscribe((t) => seen.push(t?.text));
    toasts.show('Hi');
    stop();
    toasts.dismiss();
    expect(seen).toEqual([undefined, 'Hi']);
  });
});

describe('ConfirmStore', () => {
  it('resolves with the answer', async () => {
    const confirms = new ConfirmStore();
    const asked = confirms.ask({ title: 'T', message: 'M', action: 'Delete' });
    expect(confirms.value?.action).toBe('Delete');
    confirms.answer(true);
    await expect(asked).resolves.toBe(true);
    expect(confirms.value).toBeNull();
  });

  it('queues a second request until the first is answered', async () => {
    const confirms = new ConfirmStore();
    const a = confirms.ask({ title: 'A', message: '', action: 'Go' });
    const b = confirms.ask({ title: 'B', message: '', action: 'Go' });
    expect(confirms.value?.title).toBe('A');
    confirms.answer(false);
    expect(confirms.value?.title).toBe('B');
    confirms.answer(true);
    await expect(a).resolves.toBe(false);
    await expect(b).resolves.toBe(true);
  });
});

describe('offerUndo', () => {
  function source() {
    const listeners = new Set<() => void>();
    return {
      undo: vi.fn(() => true),
      onLocalChange(l: () => void) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      change: () => [...listeners].forEach((l) => l()),
      listeners,
    };
  }

  it('undoes the step and stops listening', () => {
    const toasts = new ToastStore(fakeTimers().timers);
    const s = source();
    offerUndo('Deleted rule', s, toasts);
    toasts.undo();
    expect(s.undo).toHaveBeenCalledTimes(1);
    expect(s.listeners.size).toBe(0);
  });

  it('withdraws the offer when the document changes again', () => {
    const toasts = new ToastStore(fakeTimers().timers);
    const s = source();
    offerUndo('Deleted rule', s, toasts);
    s.change();
    expect(toasts.value).toBeNull();
    expect(s.listeners.size).toBe(0);
    toasts.undo();
    expect(s.undo).not.toHaveBeenCalled();
  });

  it('stops listening when another toast replaces it or time runs out', () => {
    const { timers, fire } = fakeTimers();
    const toasts = new ToastStore(timers);
    const a = source();
    offerUndo('One', a, toasts);
    toasts.show('Something else');
    expect(a.listeners.size).toBe(0);
    const b = source();
    offerUndo('Two', b, toasts);
    fire();
    expect(b.listeners.size).toBe(0);
  });
});
