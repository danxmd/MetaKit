import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  compareStamps,
  formatTimestamp,
  HybridClock,
  isTimestamp,
  MAX_COUNTER,
  parseTimestamp,
} from './clock';

describe('timestamp format', () => {
  it('has the form fixed by ADR 0001', () => {
    expect(formatTimestamp(Date.UTC(2026, 9, 7, 9, 14, 3, 512), 42)).toBe(
      '2026-10-07T09:14:03.512Z/000042',
    );
  });

  it('round-trips and recognises only that exact shape', () => {
    const text = formatTimestamp(1_790_000_000_123, 7);
    expect(parseTimestamp(text)).toEqual({
      wallMs: 1_790_000_000_123,
      counter: 7,
    });
    for (const bad of [
      '2026-10-07T09:14:03.512Z/42',
      '2026-10-07T09:14:03Z/000042',
      '2026-10-07T09:14:03.512+02:00/000042',
      '2026-13-07T09:14:03.512Z/000042',
      '2026-02-30T09:14:03.512Z/000042',
      '',
      'x',
      5,
      null,
    ]) {
      expect(isTimestamp(bad)).toBe(false);
    }
    expect(() => parseTimestamp('nope')).toThrow(/not a clock timestamp/);
  });

  it('sorts as text in time order', () => {
    const stamps = [
      formatTimestamp(2000, 0),
      formatTimestamp(1000, 999_999),
      formatTimestamp(1000, 2),
      formatTimestamp(1000, 10),
    ];
    expect([...stamps].sort()).toEqual([
      formatTimestamp(1000, 2),
      formatTimestamp(1000, 10),
      formatTimestamp(1000, 999_999),
      formatTimestamp(2000, 0),
    ]);
  });

  it('breaks exact ties by instance id', () => {
    expect(compareStamps({ t: 'a', by: '1' }, { t: 'a', by: '2' })).toBe(-1);
    expect(compareStamps({ t: 'b', by: '1' }, { t: 'a', by: '2' })).toBe(1);
    expect(compareStamps({ t: 'a', by: '1' }, { t: 'a', by: '1' })).toBe(0);
  });
});

describe('the clock', () => {
  it('follows the wall clock and restarts the counter', () => {
    let now = 1_790_000_000_000;
    const clock = new HybridClock(() => now);
    expect(clock.tick()).toMatch(/\/000000$/);
    expect(clock.tick()).toMatch(/\/000001$/);
    now += 5;
    expect(clock.tick()).toMatch(/\/000000$/);
  });

  it('never goes backwards when the wall clock does', () => {
    let now = 1_790_000_005_000;
    const clock = new HybridClock(() => now);
    const first = clock.tick();
    now = 1_790_000_000_000;
    const second = clock.tick();
    expect(second > first).toBe(true);
  });

  it('sorts later edits after what it has seen from others', () => {
    const clock = new HybridClock(() => 1_790_000_000_000);
    const remote = formatTimestamp(1_790_000_009_000, 12);
    clock.observe(remote);
    expect(clock.tick() > remote).toBe(true);
    clock.observe(formatTimestamp(1_780_000_000_000, 0));
    expect(clock.latest()! > remote).toBe(true);
  });

  it('moves one millisecond on when the counter runs out', () => {
    const clock = new HybridClock(() => 1_790_000_000_000);
    clock.observe(formatTimestamp(1_790_000_000_000, MAX_COUNTER));
    const next = clock.tick();
    expect(next).toBe(formatTimestamp(1_790_000_000_001, 0));
    expect(next > formatTimestamp(1_790_000_000_000, MAX_COUNTER)).toBe(true);
  });

  it('handles an import of 50,000 edits in one millisecond', () => {
    const clock = new HybridClock(() => 1_790_000_000_000);
    let previous = '';
    for (let i = 0; i < 50_000; i++) {
      const t = clock.tick();
      if (previous) expect(t > previous).toBe(true);
      previous = t;
    }
    expect(previous).toBe(formatTimestamp(1_790_000_000_000, 49_999));
  });

  it('reports nothing before the first tick', () => {
    expect(new HybridClock().latest()).toBeNull();
  });

  it('only ever increases, whatever the wall clock and the other instances do (property)', () => {
    const action = fc.oneof(
      fc.record({
        kind: fc.constant('tick' as const),
        wall: fc.integer({ min: 1_790_000_000_000, max: 1_790_000_000_010 }),
      }),
      fc.record({
        kind: fc.constant('observe' as const),
        wall: fc.integer({ min: 1_790_000_000_000, max: 1_790_000_000_020 }),
        counter: fc.integer({ min: 0, max: MAX_COUNTER }),
      }),
    );
    fc.assert(
      fc.property(
        fc.array(action, { minLength: 1, maxLength: 200 }),
        (actions) => {
          let wall = 1_790_000_000_000;
          const clock = new HybridClock(() => wall);
          let last = '';
          for (const a of actions) {
            if (a.kind === 'tick') {
              wall = a.wall;
              const t = clock.tick();
              expect(isTimestamp(t)).toBe(true);
              if (last) expect(t > last).toBe(true);
              last = t;
            } else {
              clock.observe(formatTimestamp(a.wall, a.counter));
              const latest = clock.latest()!;
              if (last) expect(latest >= last).toBe(true);
              last = latest;
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
