import { describe, expect, it } from 'vitest';
import { tourBlocker, tourLength } from './start';
import type { Tour } from './tours';

const make = (page: Tour['page'], needs?: Tour['needs'], steps = 3): Tour => ({
  id: 't',
  title: 'T',
  summary: 'S',
  page,
  needs,
  steps: Array.from({ length: steps }, (_, i) => ({
    anchor: `a${i}`,
    title: `Step ${i}`,
    text: 'Text.',
  })),
});

const none = { workspace: false, model: false, kit: false };
const open = { workspace: true, model: false, kit: false };

describe('tourBlocker', () => {
  it('lets a start-page tour run only on the start page', () => {
    expect(tourBlocker(make('start'), none)).toBeNull();
    expect(tourBlocker(make('start'), open)).toMatchObject({
      goTo: 'start',
      thenStart: true,
    });
  });

  it('asks for a workspace, a model or a Kit first', () => {
    expect(tourBlocker(make('models'), none)).toMatchObject({
      goTo: 'start',
      message: 'Open a workspace folder first.',
    });
    expect(tourBlocker(make('models'), open)).toBeNull();
    expect(tourBlocker(make('model', 'model'), open)).toMatchObject({
      goTo: 'models',
      label: 'Go to Models',
      message: 'Open a model first.',
    });
    expect(
      tourBlocker(make('model', 'model'), { ...open, model: true }),
    ).toBeNull();
    expect(tourBlocker(make('build', 'kit'), open)).toMatchObject({
      goTo: 'kits',
      label: 'Go to Kits',
    });
    expect(
      tourBlocker(make('build', 'kit'), { ...open, kit: true }),
    ).toBeNull();
  });
});

describe('tourLength', () => {
  it('counts steps and rounds to whole minutes, at least one', () => {
    expect(tourLength(make('any', undefined, 8))).toBe(
      '8 steps · about 1 minute',
    );
    expect(tourLength(make('any', undefined, 1))).toBe(
      '1 step · about 1 minute',
    );
    expect(tourLength(make('any', undefined, 15))).toBe(
      '15 steps · about 2 minutes',
    );
  });
});
