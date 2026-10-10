import { describe, expect, it } from 'vitest';
import { SAMPLE, emptySampleModel } from '@metakit-app/core/testing';
import type { Model } from '@metakit-app/core';
import { draft } from './draft';
import { MARKER, RULE_REPLY, SCRIPT_REPLY, planTool } from './fixtures';
import { assertNoModelContent, describeOutgoing } from './outgoing';
import { DRAFT_KINDS } from './prompts';
import { scriptedProvider } from './testing';

/** An open model whose object names and attribute values all carry the marker. */
function modelWithMarker(): Model {
  const model = emptySampleModel();
  model.elements['el_abcdefghjk' as never] = {
    id: 'el_abcdefghjk',
    class: SAMPLE.task,
    x: 0,
    y: 0,
    w: 100,
    h: 50,
    attrs: { [SAMPLE.attName]: `${MARKER} name`, att_owner: `${MARKER} owner` },
    pos: 'a0',
  } as never;
  model.manifest.name = `${MARKER} model`;
  return model;
}

describe('what is sent', () => {
  it('never contains model content (marker test)', async () => {
    const model = modelWithMarker();
    expect(JSON.stringify(model)).toContain(MARKER);
    const tool = planTool();
    const provider = scriptedProvider([
      RULE_REPLY,
      SCRIPT_REPLY,
      '{ not json',
      '{ still not json',
    ]);
    await draft({ provider, key: 'fake', tool, kind: 'rule', sentence: 'x' });
    await draft({ provider, key: 'fake', tool, kind: 'script', sentence: 'y' });
    // A draft that fails twice sends a retry too, with the errors appended.
    await draft({ provider, key: 'fake', tool, kind: 'shape', sentence: 'z' });
    expect(provider.requests.length).toBeGreaterThanOrEqual(4);
    for (const request of provider.requests)
      expect(JSON.stringify(request)).not.toContain(MARKER);
    for (const kind of DRAFT_KINDS)
      expect(describeOutgoing(tool, kind, 'a sentence').text).not.toContain(
        MARKER,
      );
  });

  it('holds the tool definition and the sentence', () => {
    const preview = describeOutgoing(
      planTool(),
      'rule',
      'high-priority tasks need an owner',
    );
    expect(preview.text).toContain('Task');
    expect(preview.text).toContain('Priority (choice: Low | Medium | High)');
    expect(preview.text).toContain('attribute.changed');
    expect(preview.text).toContain('high-priority tasks need an owner');
    expect(preview.characters).toBe(preview.text.length);
  });

  it('is stopped by the guard when a model id or model file gets in', () => {
    const tool = planTool();
    const ok = describeOutgoing(tool, 'class', 'a class').request;
    expect(() => assertNoModelContent(ok, tool)).not.toThrow();
    const withId = {
      ...ok,
      messages: [{ role: 'user', content: 'see el_abcdefghjk' }],
    };
    expect(() => assertNoModelContent(withId, tool)).toThrow(/model object/);
    const withFile = {
      ...ok,
      messages: [
        { role: 'user', content: '{"elements": {}, "connectors": {}}' },
      ],
    };
    expect(() => assertNoModelContent(withFile, tool)).toThrow(/model file/);
    const foreignId = {
      ...ok,
      messages: [{ role: 'user', content: 'use cls_abcdefghjk' }],
    };
    expect(() => assertNoModelContent(foreignId, tool)).toThrow(
      /not in the Kit/,
    );
    expect(() =>
      assertNoModelContent({ ...ok, model: modelWithMarker() }, tool),
    ).toThrow(/unexpected field/);
  });

  it('stops a draft before anything is sent when the sentence carries a model id', async () => {
    const provider = scriptedProvider([RULE_REPLY]);
    await expect(
      draft({
        provider,
        key: 'fake',
        tool: planTool(),
        kind: 'rule',
        sentence: 'rename el_abcdefghjk',
      }),
    ).rejects.toThrow(/Nothing was sent/);
    expect(provider.requests).toHaveLength(0);
  });
});
