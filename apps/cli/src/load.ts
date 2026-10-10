import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  validateKit,
  type Issue,
  type Json,
  type Kit,
} from '@metakit-app/core';
import {
  KIT_IDENTITY_FILE,
  OLDER_KIT_IDENTITY_FILE,
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

/**
 * The file names of a Kit in a folder, in the order they are looked for: `kit.json`, then
 * `tool.json`, the name that releases before the Kit rename used.
 */
export const KIT_FILE_NAMES = [
  KIT_IDENTITY_FILE,
  OLDER_KIT_IDENTITY_FILE,
] as const;

/** The Kit file in a folder, or null when the folder has none. */
export async function kitFileIn(folder: string): Promise<string | null> {
  for (const name of KIT_FILE_NAMES) {
    const path = join(folder, name);
    if ((await exists(path)) === 'file') return path;
  }
  return null;
}

export interface KitFile {
  kit: Kit;
  issues: Issue[];
}

/** Reads a Kit in the form the app stores it (a folder with `kit.json` or `tool.json`, or any file with that content). */
export async function readKitFile(path: string): Promise<KitFile> {
  const found = await exists(path);
  const file =
    found === 'directory'
      ? ((await kitFileIn(path)) ?? join(path, KIT_FILE_NAMES[0]))
      : path;
  const raw = await readJsonFileAt(file);
  let value: unknown;
  try {
    value = migrate('kit-document', raw).value;
  } catch (error) {
    throw new CliError(`${file}: ${(error as Error).message}`);
  }
  return { kit: value as Kit, issues: validateKit(value) };
}

/** Finds the Kit for a model file: the one given with --kit, or `kit.json` (or `tool.json`) next to the model. */
export async function findKitFor(
  modelPath: string,
  kitOption: string | undefined,
): Promise<string> {
  if (kitOption) return kitOption;
  const sibling = await kitFileIn(dirname(modelPath));
  if (sibling) return sibling;
  throw new CliError(
    `Cannot find the Kit for "${modelPath}": there is no kit.json or tool.json next to it. Give one with --kit <path>.`,
  );
}

export function mkModelIssues(error: unknown): MkModelIssue[] | null {
  return error instanceof MkModelError ? error.issues : null;
}

export { exists, importMkModel, type Json };
