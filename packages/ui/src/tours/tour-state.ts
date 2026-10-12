import type { Tour } from './tours';

// Only the type comes from the tour texts here: they load when the Tutorials page or a tour opens.

/** The part of `Storage` the tour state needs, so tests can pass a map. */
export interface TourStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const TOURS_KEY = 'metakit.tours';

export interface TourRun {
  tour: Tour;
  index: number;
  /** The way the person last moved, so a skipped step keeps going that way. */
  direction: 1 | -1;
}

export interface TourSnapshot {
  run: TourRun | null;
  /** Ids of the tours finished in this browser. */
  done: readonly string[];
  /** The first-steps offer was answered in this browser. */
  offered: boolean;
}

type Listener = (state: TourSnapshot) => void;

interface Stored {
  done: string[];
  offered: boolean;
}

function read(storage: TourStorage | undefined): Stored {
  const empty = { done: [], offered: false };
  try {
    const raw = storage?.getItem(TOURS_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw) as Partial<Stored>;
    return {
      done: Array.isArray(data.done)
        ? data.done.filter((d): d is string => typeof d === 'string')
        : [],
      offered: data.offered === true,
    };
  } catch {
    return empty;
  }
}

/** The running tour and what this browser remembers about tours. */
export class TourState {
  private listeners = new Set<Listener>();
  private state: TourSnapshot;

  constructor(private readonly storage?: TourStorage) {
    const stored = read(storage);
    this.state = { run: null, done: stored.done, offered: stored.offered };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  };

  get(): TourSnapshot {
    return this.state;
  }

  private publish(patch: Partial<TourSnapshot>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener(this.state);
  }

  private save(): void {
    try {
      this.storage?.setItem(
        TOURS_KEY,
        JSON.stringify({ done: this.state.done, offered: this.state.offered }),
      );
    } catch {
      // Private windows and blocked storage: the tours simply are not remembered.
    }
  }

  /** Starts a tour at its first step, also one that is done or running. */
  start(tour: Tour): void {
    if (tour.steps.length === 0) return;
    this.publish({ run: { tour, index: 0, direction: 1 } });
  }

  /** The next step; after the last one the tour is finished. */
  next(): void {
    const run = this.state.run;
    if (!run) return;
    if (run.index >= run.tour.steps.length - 1) {
      this.finish();
      return;
    }
    this.publish({ run: { ...run, index: run.index + 1, direction: 1 } });
  }

  back(): void {
    const run = this.state.run;
    if (!run || run.index === 0) return;
    this.publish({ run: { ...run, index: run.index - 1, direction: -1 } });
  }

  /** Passes over a step whose control is not shown, in the direction the person was going. */
  skip(): void {
    const run = this.state.run;
    if (!run) return;
    if (run.direction === -1 && run.index > 0) this.back();
    else this.next();
  }

  /** Ends the tour before its last step; it does not count as done. */
  end(): void {
    if (this.state.run) this.publish({ run: null });
  }

  private finish(): void {
    const id = this.state.run?.tour.id;
    const done =
      id && !this.state.done.includes(id)
        ? [...this.state.done, id]
        : this.state.done;
    this.publish({ run: null, done });
    this.save();
  }

  isDone(id: string): boolean {
    return this.state.done.includes(id);
  }

  /** Remembers that the first-steps offer was answered, so it is not shown again. */
  markOffered(): void {
    if (this.state.offered) return;
    this.publish({ offered: true });
    this.save();
  }
}

function browserStorage(): TourStorage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    // Reading localStorage itself throws when site data is blocked.
    return undefined;
  }
}

/** The one tour state of the app. */
export const tours = new TourState(browserStorage());
