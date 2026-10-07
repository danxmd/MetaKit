import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  validateToolLibrary,
  type Issue,
  type Json,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  MkModelError,
  migrate,
  importMkModel,
  type MkModelIssue,
} from '@metakit-app/storage';

export class CliError extends Error {}

async function exists(path: string): Promise<'file' | 'directory' | null> {
  try {
    const s = await stat(path);
    return s.isDirectory() ? 'directory' : 'file';
  } catch {
    return null;
  }
}

export async function readJsonFileAt(path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new CliError(`Cannot read "${path}".`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CliError(
      `"${path}" is not valid JSON: ${(error as Error).message}`,
    );
  }
}

export interface ToolFile {
  tool: ToolLibrary;
  issues: Issue[];
}

/** Reads a tool library in the form the app stores it (`tool.json` or any file with that content). */
export async function readToolFile(path: string): Promise<ToolFile> {
  const found = await exists(path);
  const file = found === 'directory' ? join(path, 'tool.json') : path;
  const raw = await readJsonFileAt(file);
  let value: unknown;
  try {
    value = migrate('tool-document', raw).value;
  } catch (error) {
    throw new CliError(`${file}: ${(error as Error).message}`);
  }
  return { tool: value as ToolLibrary, issues: validateToolLibrary(value) };
}

/** Finds the tool for a model file: the one given with --tool, or `tool.json` next to the model. */
export async function findToolFor(
  modelPath: string,
  toolOption: string | undefined,
): Promise<string> {
  if (toolOption) return toolOption;
  const sibling = join(dirname(modelPath), 'tool.json');
  if ((await exists(sibling)) === 'file') return sibling;
  throw new CliError(
    `Cannot find the tool library for "${modelPath}": there is no tool.json next to it. Give one with --tool <path>.`,
  );
}

export function mkModelIssues(error: unknown): MkModelIssue[] | null {
  return error instanceof MkModelError ? error.issues : null;
}

export { exists, importMkModel, type Json };
