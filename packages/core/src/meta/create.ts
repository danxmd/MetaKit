import { newId, type RandomSource } from '../ids';
import {
  emptyToolSettings,
  TOOL_FORMAT_VERSION,
  type ToolLibrary,
} from './types';

/** A tool library with nothing in it yet, as Build mode starts one. */
export function createEmptyTool(
  input: { name: string; languages?: string[] },
  random?: RandomSource,
): ToolLibrary {
  return {
    formatVersion: TOOL_FORMAT_VERSION,
    manifest: {
      id: newId('tool', random),
      name: input.name,
      version: '0.1.0',
      languages: input.languages?.length ? input.languages : ['en'],
    },
    settings: emptyToolSettings(),
    classes: {},
    relations: {},
    modelTypes: {},
    shapes: {},
    panels: {},
    rules: {},
    scripts: {},
  };
}
