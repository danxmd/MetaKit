import { describe, expect, it } from 'vitest';
import { FIRST_STEPS, TOURS, tourById } from './tours';

const cases = TOURS.map((t) => [t.title, t] as const);

describe('the tours', () => {
  it('have unique ids, and the first-steps tour exists', () => {
    const ids = TOURS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(tourById(FIRST_STEPS)?.page).toBe('start');
  });

  it.each(cases)(
    '%s has steps, each with a title and a short text',
    (_, tour) => {
      expect(tour.summary.trim()).not.toBe('');
      expect(tour.steps.length).toBeGreaterThan(0);
      for (const step of tour.steps) {
        expect(step.anchor).toMatch(/^[a-z0-9-]+$/);
        expect(step.title.trim()).not.toBe('');
        expect(step.text.trim()).not.toBe('');
        // At most two sentences, so a step reads at a glance.
        const sentences = step.text
          .split(/[.!?](?:\s|$)/)
          .filter((s) => s.trim() !== '');
        expect(sentences.length, step.text).toBeLessThanOrEqual(2);
      }
    },
  );

  it.each(cases)('%s uses each anchor once', (_, tour) => {
    const anchors = tour.steps.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('say what they need: a tour of a model or a Kit needs one open', () => {
    for (const tour of TOURS) {
      if (tour.page === 'model') expect(tour.needs).toBe('model');
      if (tour.page === 'build') expect(tour.needs).toBe('kit');
    }
  });
});
