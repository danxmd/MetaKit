// Test helpers; not exported from the package. They read the hand-written sample tools in tools/.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createModelStore,
  MODEL_FORMAT_VERSION,
  type Model,
  type ModelStore,
  type ToolLibrary,
} from '@metakit-app/core';

export function loadTool(name: 'bpmn-lite' | 'er-lite'): ToolLibrary {
  const url = new URL(`../../../tools/${name}/tool.json`, import.meta.url);
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

export function bpmnStore(): { tool: ToolLibrary; store: ModelStore } {
  const tool = loadTool('bpmn-lite');
  return { tool, store: createModelStore(emptyModel(tool), { tool }) };
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
