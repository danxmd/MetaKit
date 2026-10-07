import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ElementId, Model, ToolLibrary } from '@metakit-app/core';
import { importMkModel } from '@metakit-app/storage';
import { hintFor } from './interaction-hints';
import {
  describeEnds,
  spotBeside,
  suggestConnections,
  suggestionRows,
} from './suggestions';

const file = (name: string) =>
  readFileSync(
    fileURLToPath(
      new URL(`../../../../tools/agent-pipeline/${name}`, import.meta.url),
    ),
    'utf8',
  );
const tool = JSON.parse(file('tool.json')) as ToolLibrary;
const model: Model = importMkModel(tool, file('code-review.mkmodel.json'));
const modelType = tool.modelTypes[model.manifest.modelType]!;

const cls = (key: string) =>
  Object.values(tool.classes).find((c) => c.key === key)!;
const rel = (key: string) =>
  Object.values(tool.relations).find((r) => r.key === key)!;
const elementNamed = (name: string): ElementId =>
  Object.values(model.elements).find((e) =>
    Object.values(e.attrs).includes(name as never),
  )!.id;

describe('suggestConnections', () => {
  const groups = suggestConnections(
    tool,
    modelType,
    model,
    elementNamed('Implement'),
  );
  const keys = (list: { class: { key: string } }[]) =>
    list.map((t) => t.class.key);
  const group = (relation: string) =>
    groups.find((g) => g.relation.key === relation)!;

  it('lists, by relation, what a task can be connected to', () => {
    expect(groups.map((g) => g.relation.key)).toEqual([
      'Feeds',
      'HandsOverTo',
      'Performs',
      'Produces',
    ]);
    expect(keys(group('Performs').in)).toEqual(['Agent', 'Human']);
    expect(group('Performs').out).toEqual([]);
    expect(keys(group('Produces').out)).toEqual(['Artifact']);
    expect(keys(group('Feeds').in)).toEqual(['Artifact']);
    expect(keys(group('HandsOverTo').out)).toEqual(['Gate', 'Task']);
    expect(keys(group('HandsOverTo').in)).toEqual(['Gate', 'Task']);
  });

  it('knows which elements of the model already fit', () => {
    const artifacts = group('Produces').out[0]!.existing;
    expect(artifacts).toHaveLength(3);
    expect(artifacts).toContain(elementNamed('Patch'));
    // The element itself is never a target.
    expect(
      group('HandsOverTo').out.find((t) => t.class.key === 'Task')!.existing,
    ).not.toContain(elementNamed('Implement'));
  });

  it('follows the tool: an artifact connects to a task or a gate, not to another artifact', () => {
    const forArtifact = suggestConnections(
      tool,
      modelType,
      model,
      elementNamed('Patch'),
    );
    const rows = suggestionRows(forArtifact).map(
      (r) => `${r.relation.key} ${r.direction} ${r.target.class.key}`,
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        'Feeds out Task',
        'Produces in Task',
        'Approves in Gate',
      ]),
    );
    expect(rows.some((r) => r.endsWith('Artifact'))).toBe(false);
  });

  it('respects the relations of a view', () => {
    const only = new Set([rel('Produces').id]);
    const limited = suggestConnections(
      tool,
      modelType,
      model,
      elementNamed('Implement'),
      only,
    );
    expect(limited.map((g) => g.relation.key)).toEqual(['Produces']);
  });

  it('gives nothing for an element that is not there', () => {
    expect(
      suggestConnections(tool, modelType, model, 'el_missing' as ElementId),
    ).toEqual([]);
  });
});

describe('describeEnds', () => {
  it('says what a relation connects', () => {
    expect(describeEnds(tool, rel('Performs'))).toBe(
      'Performs connects an Actor to a Task.',
    );
    expect(describeEnds(tool, rel('HandsOverTo'))).toContain(
      'a Task or a Gate',
    );
  });
});

describe('spotBeside', () => {
  it('finds a free spot to the right, then elsewhere when that is taken', () => {
    const id = elementNamed('Implement');
    const e = model.elements[id]!;
    const spot = spotBeside(model, id);
    expect(spot.x).toBeGreaterThanOrEqual(e.x + e.w);
    const crowded: Model = {
      ...model,
      elements: {
        ...model.elements,
        el_block: {
          ...e,
          id: 'el_block' as ElementId,
          x: spot.x,
          y: spot.y,
          w: 140,
          h: 70,
        },
      },
    };
    expect(spotBeside(crowded, id)).not.toEqual(spot);
  });
});

describe('hintFor', () => {
  it('says what a chosen relation connects and why a drop was refused', () => {
    expect(
      hintFor(tool, {
        kind: 'connect',
        relation: rel('Performs'),
        picked: false,
      }),
    ).toContain('Performs connects an Actor to a Task');
    expect(
      hintFor(tool, {
        kind: 'connect',
        relation: rel('Performs'),
        picked: true,
      }),
    ).toContain('where the Performs should end');
    expect(hintFor(tool, { kind: 'refused', reason: 'Not allowed.' })).toBe(
      'Not allowed.',
    );
    expect(hintFor(tool, { kind: 'place', class: cls('Task') })).toContain(
      'place a Task',
    );
    expect(
      hintFor(tool, { kind: 'palette-class', class: cls('Gate') }),
    ).toContain('Gate can be connected with');
  });
});
