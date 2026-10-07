import { describe, expect, it } from 'vitest';
import type { Json } from '@metakit-app/core';
import { sampleTool } from '@metakit-app/core/testing';
import { materialize, stateFromDocument } from './state';
import { GENESIS } from './testing';
import { COLLECTIONS } from './path';

// Scripts are entities of the tool library (ADR 0006): one script is created, edited and deleted
// as one unit, with its own birth and death, so two people editing two scripts never clash.
describe('the scripts of a tool library in the sync layer', () => {
  const tool = () => {
    const t = sampleTool() as unknown as Record<string, Json>;
    t.scripts = {
      scr_a: { id: 'scr_a', name: 'A', source: 'import "metakit";\n' },
      scr_b: { id: 'scr_b', name: 'B', source: '', enabled: false },
    };
    return t;
  };

  it('is an entity collection next to rules and shapes', () => {
    expect(COLLECTIONS.tool).toContain('scripts');
    expect(COLLECTIONS.model).not.toContain('scripts');
  });

  it('round-trips through the state, scripts included', () => {
    const doc = tool();
    const state = stateFromDocument('tool', doc, GENESIS);
    expect(materialize(state)).toEqual(doc);
  });

  it('keeps an empty scripts table', () => {
    const doc = { ...tool(), scripts: {} };
    expect(materialize(stateFromDocument('tool', doc, GENESIS))).toEqual(doc);
  });
});
