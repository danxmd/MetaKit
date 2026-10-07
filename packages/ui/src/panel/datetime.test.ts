import { describe, expect, it } from 'vitest';
import { isIsoDateTime } from '@metakit-app/core';
import { isoToLocalInput, localInputToIso } from './datetime';

describe('date-time input text', () => {
  it('round-trips a moment through the local input format', () => {
    const iso = '2026-10-07T09:30:00Z';
    const local = isoToLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(localInputToIso(local)).toBe(iso);
  });

  it('writes a value that core accepts', () => {
    expect(isIsoDateTime(localInputToIso('2026-01-02T03:04')!)).toBe(true);
  });

  it('gives nothing for text that is not a date-time', () => {
    expect(localInputToIso('')).toBeNull();
    expect(localInputToIso('yesterday')).toBeNull();
    expect(isoToLocalInput('nope')).toBe('');
  });
});
