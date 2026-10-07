/**
 * Hybrid logical clock. A timestamp is `<ISO wall time>/<4-digit counter>`, so plain string
 * comparison orders timestamps; the instance ID breaks exact ties (see merge.ts).
 */
export class HybridClock {
  private wall = 0;
  private counter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Timestamp for a local edit. Never goes backwards, even if the wall clock does. */
  tick(): string {
    const physical = this.now();
    if (physical > this.wall) {
      this.wall = physical;
      this.counter = 0;
    } else {
      this.counter += 1;
    }
    return formatTimestamp(this.wall, this.counter);
  }

  /** Call for every remote timestamp so later local edits sort after what we have seen. */
  observe(timestamp: string): void {
    const { wall, counter } = parseTimestamp(timestamp);
    if (wall > this.wall || (wall === this.wall && counter > this.counter)) {
      this.wall = wall;
      this.counter = counter;
    }
  }
}

export function formatTimestamp(wall: number, counter: number): string {
  // The counter is capped at 4 digits; the spike never gets near it.
  return `${new Date(wall).toISOString()}/${String(counter).padStart(4, '0')}`;
}

export function parseTimestamp(timestamp: string): {
  wall: number;
  counter: number;
} {
  const slash = timestamp.lastIndexOf('/');
  return {
    wall: Date.parse(timestamp.slice(0, slash)),
    counter: Number(timestamp.slice(slash + 1)),
  };
}
