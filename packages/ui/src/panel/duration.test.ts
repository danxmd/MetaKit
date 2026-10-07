import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isIsoDuration } from '@metakit-app/core';
import { formatDuration, parseDuration } from './duration';

describe('duration', () => {
  it('parses the ISO subset', () => {
    expect(parseDuration('PT1H30M')).toEqual({
      days: 0,
      hours: 1,
      minutes: 30,
      seconds: 0,
    });
    expect(parseDuration('P1DT2H')).toEqual({
      days: 1,
      hours: 2,
      minutes: 0,
      seconds: 0,
    });
    expect(parseDuration('P2W')?.days).toBe(14);
    expect(parseDuration('PT0.5S')?.seconds).toBe(0.5);
  });

  it('rejects text and calendar durations', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('P')).toBeNull();
    expect(parseDuration('1h')).toBeNull();
    expect(parseDuration('P1Y')).toBeNull();
    expect(parseDuration('P1M')).toBeNull();
  });

  it('formats canonically and gives null for zero', () => {
    expect(formatDuration({ hours: 1, minutes: 30 })).toBe('PT1H30M');
    expect(formatDuration({ days: 1, hours: 2 })).toBe('P1DT2H');
    expect(formatDuration({ minutes: 90 })).toBe('PT90M');
    expect(formatDuration({ days: 3 })).toBe('P3D');
    expect(formatDuration({})).toBeNull();
    expect(
      formatDuration({ days: 0, hours: 0, minutes: 0, seconds: 0 }),
    ).toBeNull();
  });

  it('round-trips', () => {
    fc.assert(
      fc.property(
        fc.record({
          days: fc.integer({ min: 0, max: 5000 }),
          hours: fc.integer({ min: 0, max: 5000 }),
          minutes: fc.integer({ min: 0, max: 5000 }),
          seconds: fc.integer({ min: 0, max: 5000 }),
        }),
        (parts) => {
          const text = formatDuration(parts);
          if (Object.values(parts).every((v) => v === 0)) {
            expect(text).toBeNull();
            return;
          }
          expect(isIsoDuration(text!)).toBe(true);
          expect(parseDuration(text!)).toEqual(parts);
          expect(formatDuration(parseDuration(text!)!)).toBe(text);
        },
      ),
    );
  });
});
