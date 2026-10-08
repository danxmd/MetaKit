import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findClassByKey,
  findRelationByKey,
  type ToolLibrary,
} from '@metakit-app/core';
import { SAMPLE, sampleTool } from '@metakit-app/core/testing';
import {
  PREVIEW_ATTRIBUTE_LIMIT,
  previewOfClass,
  previewOfRelation,
  typeWord,
} from './palette-preview';

const pipeline = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../tools/agent-pipeline/tool.json', import.meta.url),
    ),
    'utf8',
  ),
) as ToolLibrary;

describe('the preview card of a class', () => {
  it('shows the label, the help text and the inherited attributes', () => {
    const agent = findClassByKey(pipeline, 'Agent')!;
    const info = previewOfClass(pipeline, agent);
    expect(info.kind).toBe('object');
    expect(info.kindLabel).toBe('Object');
    expect(info.title).toBe('Agent');
    // The help text sits on the abstract parent; the class itself may have none of its own.
    expect(info.attributes.map((a) => a.key)).toContain('Name');
    expect(info.attributes.find((a) => a.key === 'Name')).toMatchObject({
      type: 'text',
      required: true,
    });
    expect(info.attributes.find((a) => a.key === 'AgentKind')?.type).toBe(
      'choice',
    );
    expect(info.ends).toBeNull();
    expect(info.sentence).toBeNull();
  });

  it('falls back to the help text of the nearest ancestor', () => {
    const agent = findClassByKey(pipeline, 'Agent')!;
    expect(previewOfClass(pipeline, agent).help).toContain(
      'Anyone or anything that does work',
    );
  });

  it('keeps the list short and says how many are left out', () => {
    const agent = findClassByKey(pipeline, 'Agent')!;
    const info = previewOfClass(pipeline, agent);
    expect(info.attributes.length).toBeLessThanOrEqual(PREVIEW_ATTRIBUTE_LIMIT);
    const all = info.attributes.length + info.moreAttributes;
    expect(all).toBeGreaterThan(0);
  });

  it('reads the help text of the class when it has one', () => {
    const tool = sampleTool();
    const task = tool.classes[SAMPLE.task as keyof typeof tool.classes]!;
    const info = previewOfClass(tool, {
      ...task,
      help: { en: ' Something somebody does. ' },
    });
    expect(info.help).toBe('Something somebody does.');
    expect(
      previewOfClass(tool, { ...task, help: { en: '  ' } }).help,
    ).toBeNull();
  });

  it('calls containers and swimlanes by their kind', () => {
    const tool = sampleTool();
    const lane = tool.classes[SAMPLE.lane as keyof typeof tool.classes]!;
    const info = previewOfClass(tool, lane);
    expect(info.kind).toBe('container');
    expect(['Container', 'Swimlane']).toContain(info.kindLabel);
  });
});

describe('the preview card of a relation class', () => {
  it('names the classes it joins', () => {
    const performs = findRelationByKey(pipeline, 'Performs')!;
    const info = previewOfRelation(pipeline, performs);
    expect(info.kind).toBe('relation');
    expect(info.kindLabel).toBe('Relation');
    expect(info.ends).toEqual({ from: ['Actor'], to: ['Task'] });
    expect(info.sentence).toBe('Performs: from Actor to Task');
  });

  it('lists several allowed classes with "or"', () => {
    const rels = Object.values(pipeline.relations).filter(
      (r) => !r.abstract && r.from.length > 1,
    );
    expect(rels.length).toBeGreaterThan(0);
    const info = previewOfRelation(pipeline, rels[0]!);
    expect(info.sentence).toContain(' or ');
  });

  it('says "any object" when an end is open', () => {
    const tool = sampleTool();
    const flow = tool.relations[SAMPLE.flow as keyof typeof tool.relations]!;
    const open = { ...flow, from: [], to: [] };
    const info = previewOfRelation(
      { ...tool, relations: { ...tool.relations, [flow.id]: open } },
      open,
    );
    expect(info.sentence).toMatch(/from any object to any object$/);
  });
});

describe('type words', () => {
  it('are plain English', () => {
    expect(typeWord('boolean')).toBe('yes / no');
    expect(typeWord('multi-choice')).toBe('several choices');
  });
});
