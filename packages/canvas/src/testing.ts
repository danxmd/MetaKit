// Test helpers; not exported from the package. They read the hand-written sample Kits in kits/.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createModelStore,
  MODEL_FORMAT_VERSION,
  type Model,
  type ModelStore,
  type Kit,
} from '@metakit-app/core';

export function loadKit(name: 'bpmn-lite' | 'er-lite'): Kit {
  const url = new URL(`../../../kits/${name}/kit.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Kit;
}

export function emptyModel(kit: Kit): Model {
  const modelType = Object.values(kit.modelTypes)[0]!;
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: 'mdl_testmodel1',
      name: 'Test',
      tool: kit.manifest.id,
      toolVersion: kit.manifest.version,
      modelType: modelType.id,
    },
    attrs: {},
    elements: {},
    connectors: {},
  };
}

export function bpmnStore(): { kit: Kit; store: ModelStore } {
  const kit = loadKit('bpmn-lite');
  return { kit, store: createModelStore(emptyModel(kit), { kit }) };
}

export const BPMN = {
  task: 'cls_task',
  gateway: 'cls_gateway',
  start: 'cls_start',
  end: 'cls_end',
  lane: 'cls_lane',
  flow: 'rel_flow',
  name: 'att_name',
} as const;
