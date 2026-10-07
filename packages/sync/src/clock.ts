/**
 * Hybrid logical clock, format fixed by docs/decisions/0001-hybrid-clock-format.md:
 * `<ISO 8601 UTC time with milliseconds>/<six digit counter>`. Plain string comparison orders it.
 */
export const MAX_COUNTER = 999_999;

const SHAPE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\/(\d{6})$/;

export function formatTimestamp(wallMs: number, counter: number): string {
  return `${new Date(wallMs).toISOString()}/${String(counter).padStart(6, '0')}`;
}

export function isTimestamp(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const m = SHAPE.exec(text);
  return (
    m !== null &&
    !Number.isNaN(Date.parse(m[1]!)) &&
    new Date(m[1]!).toISOString() === m[1]
  );
}

export function parseTimestamp(text: string): {
  wallMs: number;
  counter: number;
} {
  if (!isTimestamp(text))
    throw new Error(
      `"${text}" is not a clock timestamp (expected 2026-10-07T09:14:03.512Z/000042).`,
    );
  const slash = text.indexOf('/');
  return {
    wallMs: Date.parse(text.slice(0, slash)),
    counter: Number(text.slice(slash + 1)),
  };
}

/** Orders two timestamps from different instances: time first, then the instance id as a tie break. */
export function compareStamps(
  a: { t: string; by: string },
  b: { t: string; by: string },
): number {
  if (a.t !== b.t) return a.t < b.t ? -1 : 1;
  return a.by === b.by ? 0 : a.by < b.by ? -1 : 1;
}

export class HybridClock {
  private wallMs = 0;
  private counter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** The timestamp for a local edit. It is always later than every earlier value of this clock. */
  tick(): string {
    const physical = this.now();
    if (physical > this.wallMs) {
      this.wallMs = physical;
      this.counter = 0;
    } else if (this.counter >= MAX_COUNTER) {
      // Out of counter in this millisecond: move on one millisecond rather than repeat a value.
      this.wallMs += 1;
      this.counter = 0;
    } else {
      this.counter += 1;
    }
    return formatTimestamp(this.wallMs, this.counter);
  }

  /** Call for every timestamp read from another instance, so later local edits sort after it. */
  observe(text: string): void {
    const { wallMs, counter } = parseTimestamp(text);
    if (
      wallMs > this.wallMs ||
      (wallMs === this.wallMs && counter > this.counter)
    ) {
      this.wallMs = wallMs;
      this.counter = counter;
    }
  }

  /** The latest value this clock has produced or observed, or null if none. */
  latest(): string | null {
    return this.wallMs === 0
      ? null
      : formatTimestamp(this.wallMs, this.counter);
  }
}
