import type { Json } from '../json';
import {
  newId,
  type AttributeId,
  type ModelTypeId,
  type RandomSource,
} from '../ids';
import type { AttributeDef, Kit } from '../meta/types';
import { MODEL_FORMAT_VERSION, type Model } from './types';

function defaultsOf(
  attributes: readonly AttributeDef[],
): Record<AttributeId, Json> {
  const defaults: Record<string, Json> = {};
  for (const a of attributes)
    if ('default' in a && a.default !== undefined)
      defaults[a.id] = a.default as Json;
  return defaults;
}

/**
 * An empty model of a model type, with the default values of the model type's own attributes. The
 * model remembers the Kit and its version so that later releases can tell what made it.
 */
export function createEmptyModel(
  kit: Kit,
  modelType: ModelTypeId,
  options: { name: string; folder?: string; random?: RandomSource },
): Model {
  const type = kit.modelTypes[modelType];
  if (!type) throw new Error(`The Kit has no model type ${modelType}.`);
  const name = options.name.trim();
  if (name === '') throw new Error('The model needs a name.');
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: newId('model', options.random),
      name,
      tool: kit.manifest.id,
      toolVersion: kit.manifest.version,
      modelType,
      ...(options.folder ? { folder: options.folder } : {}),
    },
    attrs: defaultsOf(type.attributes),
    elements: {},
    connectors: {},
  };
}
