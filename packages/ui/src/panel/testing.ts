// Test helpers; not exported from the package. They read the hand-written sample Kits in kits/.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createModelStore,
  MODEL_FORMAT_VERSION,
  type ElementId,
  type Model,
  type ModelStore,
  type Kit,
} from '@metakit-app/core';

export function loadKit(name: 'bpmn-lite' | 'er-lite'): Kit {
  const url = new URL(`../../../../kits/${name}/kit.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Kit;
}

export function emptyModel(kit: Kit): Model {
  const modelType = Object.values(kit.modelTypes)[0]!;
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: 'mdl_testmodel1',
      name: 'Test',
      kit: kit.manifest.id,
      kitVersion: kit.manifest.version,
      modelType: modelType.id,
    },
    attrs: {},
    elements: {},
    connectors: {},
  };
}

export function makeStore(name: 'bpmn-lite' | 'er-lite'): {
  kit: Kit;
  store: ModelStore;
  create: (cls: string, attrs?: Record<string, never>) => ElementId;
} {
  const kit = loadKit(name);
  const store = createModelStore(emptyModel(kit), { kit });
  const create = (cls: string, attrs: Record<string, never> = {}) => {
    const result = store.execute({
      type: 'createElement',
      class: cls as never,
      x: 0,
      y: 0,
      attrs,
    });
    if (!result.ok) throw new Error('cancelled');
    return result.value as ElementId;
  };
  return { kit, store, create };
}
