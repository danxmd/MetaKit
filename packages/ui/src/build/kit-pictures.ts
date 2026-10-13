import { ModelCalculator, type Kit } from '@metakit-app/core';
import { importMkModel } from '@metakit-app/storage';
import { Scene, exportSvg } from '@metakit-app/canvas';

/** A sample model drawn as a picture, for the Kit catalogue. */
export interface SamplePicture {
  /** A standalone SVG document. */
  svg: string;
  /** The SVG as a `data:` URL for an `<img>`. */
  url: string;
  width: number;
  height: number;
  /** The label of the sample's model type, used to name its tab. */
  modelType: string;
  /** The name of the sample model. */
  name: string;
  /** Problems the shapes reported while drawing; empty when all is well. */
  problems: string[];
}

/**
 * Draws a sample model with the same draw lists as the canvas (rule 4), so the catalogue shows
 * exactly what a model made with the Kit looks like. The picture sits on white, as an export
 * does, because Kit colours are chosen for a light background.
 */
export function samplePicture(kit: Kit, sampleText: string): SamplePicture {
  const model = importMkModel(kit, sampleText);
  const scene = new Scene(model, kit, {
    calculator: new ModelCalculator(kit, () => model),
  });
  try {
    const svg = exportSvg(scene, { padding: 24, background: '#ffffff' });
    const size = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);
    const type = kit.modelTypes[model.manifest.modelType];
    return {
      svg,
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      width: Number(size?.[1] ?? 0),
      height: Number(size?.[2] ?? 0),
      modelType: type ? (type.labels['en'] ?? type.key) : '',
      name: model.manifest.name,
      problems: [
        ...[...scene.elements.values()].flatMap((e) =>
          e.compiled.compiled.messages.map((m) => `${e.label}: ${m}`),
        ),
        ...[...scene.connectors.values()].flatMap((c) =>
          c.look.messages.map((m) => `${c.id}: ${m}`),
        ),
      ],
    };
  } finally {
    scene.destroy();
  }
}

const cache = new Map<string, SamplePicture>();

/** `samplePicture`, drawn once per Kit and sample for the session. */
export function cachedSamplePicture(
  kit: Kit,
  sampleName: string,
  sampleText: string,
): SamplePicture {
  const key = `${kit.manifest.id}/${sampleName}`;
  let picture = cache.get(key);
  if (!picture) {
    picture = samplePicture(kit, sampleText);
    cache.set(key, picture);
  }
  return picture;
}
