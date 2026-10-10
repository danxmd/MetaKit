import type { Tour } from './tours';

/** What is open when a tour is started. */
export interface TourWhere {
  workspace: boolean;
  model: boolean;
  kit: boolean;
}

/** Where a blocked tour offers to go. */
export type TourGoTo = 'start' | 'models' | 'kits';

export interface TourBlocker {
  message: string;
  goTo: TourGoTo;
  label: string;
  /** The tour starts by itself once the page is reached (the start page needs nothing open). */
  thenStart: boolean;
}

/**
 * Why a tour cannot start here, or null when it can. A tour never starts half-way: one that needs
 * an open model or Kit says so and offers the page where one can be opened.
 */
export function tourBlocker(tour: Tour, where: TourWhere): TourBlocker | null {
  if (tour.page === 'start') {
    return where.workspace
      ? {
          message:
            'This tour shows the start page, which appears when no workspace is open.',
          goTo: 'start',
          label: 'Close workspace and start',
          thenStart: true,
        }
      : null;
  }
  if (!where.workspace)
    return {
      message: 'Open a workspace folder first.',
      goTo: 'start',
      label: 'Go to the start page',
      thenStart: false,
    };
  if (tour.needs === 'model' && !where.model)
    return {
      message: 'Open a model first.',
      goTo: 'models',
      label: 'Go to Models',
      thenStart: false,
    };
  if (tour.needs === 'kit' && !where.kit)
    return {
      message: 'Open a Kit in Build first.',
      goTo: 'kits',
      label: 'Go to Kits',
      thenStart: false,
    };
  return null;
}

/** About eight seconds a step, never less than a minute. */
export function tourLength(tour: Tour): string {
  const steps = tour.steps.length;
  const minutes = Math.max(1, Math.round((steps * 8) / 60));
  return `${steps} ${steps === 1 ? 'step' : 'steps'} · about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
