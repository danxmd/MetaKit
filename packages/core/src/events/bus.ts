import type { ClassId, RelationId } from '../ids';
import type { Json } from '../json';
import {
  CANCELLABLE_EVENTS,
  EVENT_NAMES,
  type EventName,
} from '../meta/rule-types';

/** What a handler is told. Only the fields that make sense for the event are set. */
export interface EventPayload {
  event: EventName;
  /** The element or connector the event is about; the model's id for model events; null for app events. */
  target: string | null;
  class?: ClassId;
  relation?: RelationId;
  /** The attribute key, for attribute and table events. */
  attribute?: string;
  old?: Json;
  new?: Json;
  /** The ends of a connector. */
  from?: string;
  to?: string;
  /** Which end of a connector was moved: `from` or `to`. */
  end?: 'from' | 'to';
  /** For table events, the index of the row. */
  row?: number;
  /** For view events, the view id (or null for "all"). */
  view?: string | null;
  /** For selection events, the ids now selected. */
  selection?: string[];
  user: string;
}

/** A handler cancels a "before" event by returning `{ cancel: reason }` or `false`. */
export type EventResult = void | false | { cancel: string };
export type EventHandler = (payload: EventPayload) => EventResult;

export interface EventFilter {
  class?: ClassId;
  attribute?: string;
  relation?: RelationId;
}

export type EmitResult =
  { cancelled: false } | { cancelled: true; reason: string };

interface Registration {
  pattern: string;
  filter: EventFilter;
  handler: EventHandler;
}

export function isEventName(name: string): name is EventName {
  return (EVENT_NAMES as readonly string[]).includes(name);
}

/**
 * Routes events to handlers. A pattern is an event name or a prefix such as `object.*`; `*` is
 * every event. Handlers of an event that can be cancelled run in the order they were added, and the
 * first one that cancels stops the rest. Events are only emitted where a change was made: this
 * bus is fed by the store's own handlers, which merged changes never reach.
 */
export class EventBus {
  private readonly registrations = new Set<Registration>();

  constructor(
    private readonly options: {
      /** True when `cls` is `ancestor` or extends it, so that a handler for a class also hears its subclasses. */
      isA?: (cls: ClassId, ancestor: ClassId) => boolean;
    } = {},
  ) {}

  on(
    pattern: string,
    handler: EventHandler,
    filter: EventFilter = {},
  ): () => void {
    const reg: Registration = { pattern, filter, handler };
    this.registrations.add(reg);
    return () => this.registrations.delete(reg);
  }

  private matches(reg: Registration, payload: EventPayload): boolean {
    const p = reg.pattern;
    if (
      p !== '*' &&
      p !== payload.event &&
      !(p.endsWith('.*') && payload.event.startsWith(p.slice(0, -1)))
    )
      return false;
    const f = reg.filter;
    if (f.attribute !== undefined && f.attribute !== payload.attribute)
      return false;
    if (f.relation !== undefined && f.relation !== payload.relation)
      return false;
    if (f.class !== undefined) {
      if (!payload.class) return false;
      if (
        payload.class !== f.class &&
        !this.options.isA?.(payload.class, f.class)
      )
        return false;
    }
    return true;
  }

  /** Runs the handlers of an event; for events that can be cancelled the first cancel wins. */
  emit(payload: EventPayload): EmitResult {
    const cancellable = (CANCELLABLE_EVENTS as readonly string[]).includes(
      payload.event,
    );
    for (const reg of [...this.registrations]) {
      if (!this.matches(reg, payload)) continue;
      const answer = reg.handler(payload);
      if (!cancellable) continue;
      if (answer === false) return { cancelled: true, reason: 'Cancelled.' };
      if (answer && typeof answer === 'object' && 'cancel' in answer)
        return { cancelled: true, reason: answer.cancel };
    }
    return { cancelled: false };
  }
}
