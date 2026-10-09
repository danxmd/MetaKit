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

/**
 * A copy of a tool library to extend: a new id and name, version 1.0.0 and a note of where it came
 * from. Every other id is kept; ids of classes and shapes only need to be unique inside one tool
 * library, and keeping them lets a copy be compared with its original.
 */
export function cloneToolLibrary(
  source: ToolLibrary,
  name: string,
  random?: RandomSource,
): ToolLibrary {
  // A tool library is plain JSON, so a JSON round trip is a full, independent copy.
  const copy = JSON.parse(JSON.stringify(source)) as ToolLibrary;
  return {
    ...copy,
    formatVersion: TOOL_FORMAT_VERSION,
    manifest: {
      ...copy.manifest,
      id: newId('tool', random),
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
