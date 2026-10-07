import type { Json } from '@metakit-app/core';
import { fromBytes, toBytes, type StorageAdapter } from './adapter';
import { FormatError, PartialFileError } from './errors';

function sorted(value: Json): Json {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sorted);
  const out: { [key: string]: Json } = {};
  for (const key of Object.keys(value).sort())
    out[key] = sorted(value[key] as Json);
  return out;
}

/**
 * The text MetaKit writes for every JSON file: keys sorted at every level, two-space indent,
 * one trailing newline. Equal data always gives equal bytes, so diffs stay small.
 */
export function stringifyCanonical(value: Json): string {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

export interface ReadOptions {
  /** How often to try again when a file looks incomplete. */
  retries?: number;
  delayMs?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Reads a JSON file. A file that does not end with a newline may still be arriving through a
 * sync client, so it is read again a few times before giving up (`PartialFileError`).
 */
export async function readJsonFile(
  adapter: Pick<StorageAdapter, 'read'>,
  path: string,
  options: ReadOptions = {},
): Promise<unknown> {
  const retries = options.retries ?? 5;
  const delay = options.delayMs ?? 100;
  for (let attempt = 0; ; attempt++) {
    const text = fromBytes(await adapter.read(path));
    if (text.endsWith('\n')) {
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new FormatError(
          `"${path}" is not valid JSON: ${(error as Error).message}`,
        );
      }
    }
    if (attempt >= retries) {
      throw new PartialFileError(
        `"${path}" looks incomplete (it does not end with a new line) even after ${retries} more tries. If a sync program is still copying it, wait and try again.`,
      );
    }
    await sleep(delay);
  }
}

export const jsonBytes = (value: Json): Uint8Array =>
  toBytes(stringifyCanonical(value));
