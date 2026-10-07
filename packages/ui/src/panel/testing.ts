// Test helpers; not exported from the package. They read the hand-written sample tools in tools/.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createModelStore,
  MODEL_FORMAT_VERSION,
  type ElementId,
  type Model,
  type ModelStore,
  type ToolLibrary,
} from '@metakit-app/core';

export function loadTool(name: 'bpmn-lite' | 'er-lite'): ToolLibrary {
  const url = new URL(`../../../../tools/${name}/tool.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as ToolLibrary;
}

export function emptyModel(tool: ToolLibrary): Model {
  const modelType = Object.values(tool.modelTypes)[0]!;
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: 'mdl_testmodel1',
      name: 'Test',
      tool: tool.manifest.id,
      toolVersion: tool.manifest.version,
      modelType: modelType.id,
    },
    attrs: {},
    elements: {},
    connectors: {},
  };
}

export function makeStore(name: 'bpmn-lite' | 'er-lite'): {
  tool: ToolLibrary;
  store: ModelStore;
  create: (cls: string, attrs?: Record<string, never>) => ElementId;
} {
  const tool = loadTool(name);
  const store = createModelStore(emptyModel(tool), { tool });
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
  return { tool, store, create };
}
