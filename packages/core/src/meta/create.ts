import { newId, type RandomSource } from '../ids';
import { emptyKitSettings, KIT_FORMAT_VERSION, type Kit } from './types';

/** A Kit with nothing in it yet, as Build mode starts one. */
export function createEmptyKit(
  input: { name: string; languages?: string[] },
  random?: RandomSource,
): Kit {
  return {
    formatVersion: KIT_FORMAT_VERSION,
    manifest: {
      id: newId('kit', random),
      name: input.name,
      version: '0.1.0',
      languages: input.languages?.length ? input.languages : ['en'],
    },
    settings: emptyKitSettings(),
    classes: {},
    relations: {},
    modelTypes: {},
    shapes: {},
    panels: {},
    rules: {},
    scripts: {},
  };
}

/**
 * A copy of a Kit to extend: a new id and name, version 1.0.0 and a note of where it came
 * from. Every other id is kept; ids of classes and shapes only need to be unique inside one Kit
 * library, and keeping them lets a copy be compared with its original.
 */
export function cloneKit(
  source: Kit,
  name: string,
  random?: RandomSource,
): Kit {
  // A Kit is plain JSON, so a JSON round trip is a full, independent copy.
  const copy = JSON.parse(JSON.stringify(source)) as Kit;
  return {
    ...copy,
    formatVersion: KIT_FORMAT_VERSION,
    manifest: {
      ...copy.manifest,
      id: newId('kit', random),
      name,
      version: '1.0.0',
      basedOn: {
        id: source.manifest.id,
        name: source.manifest.name,
        version: source.manifest.version,
      },
    },
  };
}
