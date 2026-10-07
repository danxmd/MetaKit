import { describe, expect, it } from 'vitest';
import { validateModelDocument } from './guards';
import { createEmptyModel } from './create';
import { sampleTool, SAMPLE } from '../testing/sample-tool';

describe('createEmptyModel', () => {
  const tool = sampleTool();

  it('makes a valid empty model that remembers its tool and takes model attribute defaults', () => {
    const model = createEmptyModel(tool, SAMPLE.process, {
      name: ' Order process ',
      folder: 'Sales/2026',
    });
    expect(model.manifest).toMatchObject({
      name: 'Order process',
      tool: SAMPLE.tool,
      toolVersion: '1.0.0',
      modelType: SAMPLE.process,
      folder: 'Sales/2026',
    });
    expect(model.manifest.id).toMatch(/^mdl_[0-9a-hjkmnp-tv-z]{10}$/);
    expect(model.elements).toEqual({});
    expect(validateModelDocument(model)).toEqual([]);
    expect(model.attrs).toEqual(
      Object.fromEntries(
        tool.modelTypes[SAMPLE.process]!.attributes.flatMap((a) =>
          'default' in a && a.default !== undefined ? [[a.id, a.default]] : [],
        ),
      ),
    );
  });

  it('gives each model its own id and leaves the folder out when none is given', () => {
    const a = createEmptyModel(tool, SAMPLE.process, { name: 'A' });
    const b = createEmptyModel(tool, SAMPLE.process, { name: 'B' });
    expect(a.manifest.id).not.toBe(b.manifest.id);
    expect('folder' in a.manifest).toBe(false);
  });

  it('refuses an unknown model type and an empty name', () => {
    expect(() =>
      createEmptyModel(tool, 'mt_unknown000', { name: 'A' }),
    ).toThrow(/no model type/);
    expect(() =>
      createEmptyModel(tool, SAMPLE.process, { name: '  ' }),
    ).toThrow(/needs a name/);
  });
});
