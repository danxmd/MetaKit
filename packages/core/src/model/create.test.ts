import { describe, expect, it } from 'vitest';
import { validateModelDocument } from './guards';
import { createEmptyModel } from './create';
import { sampleKit, SAMPLE } from '../testing/sample-kit';

describe('createEmptyModel', () => {
  const kit = sampleKit();

  it('makes a valid empty model that remembers its Kit and takes model attribute defaults', () => {
    const model = createEmptyModel(kit, SAMPLE.process, {
      name: ' Order process ',
      folder: 'Sales/2026',
    });
    expect(model.manifest).toMatchObject({
      name: 'Order process',
      kit: SAMPLE.kit,
      kitVersion: '1.0.0',
      modelType: SAMPLE.process,
      folder: 'Sales/2026',
    });
    expect(model.manifest.id).toMatch(/^mdl_[0-9a-hjkmnp-tv-z]{10}$/);
    expect(model.elements).toEqual({});
    expect(validateModelDocument(model)).toEqual([]);
    expect(model.attrs).toEqual(
      Object.fromEntries(
        kit.modelTypes[SAMPLE.process]!.attributes.flatMap((a) =>
          'default' in a && a.default !== undefined ? [[a.id, a.default]] : [],
        ),
      ),
    );
  });

  it('gives each model its own id and leaves the folder out when none is given', () => {
    const a = createEmptyModel(kit, SAMPLE.process, { name: 'A' });
    const b = createEmptyModel(kit, SAMPLE.process, { name: 'B' });
    expect(a.manifest.id).not.toBe(b.manifest.id);
    expect('folder' in a.manifest).toBe(false);
  });

  it('refuses an unknown model type and an empty name', () => {
    expect(() => createEmptyModel(kit, 'mt_unknown000', { name: 'A' })).toThrow(
      /no model type/,
    );
    expect(() => createEmptyModel(kit, SAMPLE.process, { name: '  ' })).toThrow(
      /needs a name/,
    );
  });
});
