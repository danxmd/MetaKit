import { describe, expect, it } from 'vitest';
import { HybridClock, formatTimestamp, parseTimestamp } from './clock';

describe('HybridClock', () => {
  it('advances with the wall clock and resets the counter', () => {
    let now = 1000;
    const clock = new HybridClock(() => now);
    const a = clock.tick();
    now = 2000;
    const b = clock.tick();
    expect(a < b).toBe(true);
    expect(b.endsWith('/0000')).toBe(true);
  });

  it('keeps increasing when the wall clock stands still or goes back', () => {
    let now = 5000;
    const clock = new HybridClock(() => now);
    const first = clock.tick();
    const second = clock.tick();
    now = 1000;
    const third = clock.tick();
    expect(first < second).toBe(true);
    expect(second < third).toBe(true);
  });

  it('sorts later local edits after observed remote timestamps', () => {
    const clock = new HybridClock(() => 1000);
    const remote = formatTimestamp(9000, 7);
    clock.observe(remote);
    expect(clock.tick() > remote).toBe(true);
  });

  it('round-trips timestamps', () => {
    expect(parseTimestamp(formatTimestamp(123456, 42))).toEqual({
      wall: 123456,
      counter: 42,
    });
  });
});
