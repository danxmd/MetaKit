import { describe, expect, it } from 'vitest';
import type { Kit } from '@metakit-app/core';
import { BUILT_IN_KITS, builtInSamples } from './built-in';
import { cachedSamplePicture, samplePicture } from './kit-pictures';

describe('pictures of the built-in samples', () => {
  for (const entry of BUILT_IN_KITS)
    it(`${entry.name}: every sample draws without a shape problem`, async () => {
      const kit = JSON.parse(await entry.load()) as Kit;
      const samples = await builtInSamples(entry);
      expect(samples.length).toBeGreaterThan(0);
      for (const sample of samples) {
        const picture = samplePicture(kit, sample.text);
        expect(picture.problems).toEqual([]);
        expect(picture.svg).toContain('<svg');
        expect(picture.width).toBeGreaterThan(0);
        expect(picture.height).toBeGreaterThan(0);
        expect(picture.modelType).not.toBe('');
        expect(picture.url.startsWith('data:image/svg+xml')).toBe(true);
      }
    });

  it('names the tabs of a Kit with several samples by their model types', async () => {
    const entry = BUILT_IN_KITS.find((k) => k.name === 'Data modelling')!;
    const kit = JSON.parse(await entry.load()) as Kit;
    const types = (await builtInSamples(entry)).map(
      (s) => samplePicture(kit, s.text).modelType,
    );
    expect(types).toHaveLength(3);
    expect(new Set(types).size).toBe(3);
  });

  it('draws a sample once per session', async () => {
    const entry = BUILT_IN_KITS[0]!;
    const kit = JSON.parse(await entry.load()) as Kit;
    const [sample] = await builtInSamples(entry);
    const a = cachedSamplePicture(kit, sample!.name, sample!.text);
    expect(cachedSamplePicture(kit, sample!.name, sample!.text)).toBe(a);
  });
});
