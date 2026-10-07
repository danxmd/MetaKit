// Shared by the tests of the exchange formats; not part of the package.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Model, ToolLibrary } from '@metakit-app/core';
import { importMkModel } from './mkmodel';
import { MemoryAdapter } from './memory';
import { migrate } from './migrate';
import { Workspace } from './workspace';

const toolsDir = fileURLToPath(new URL('../../../tools/', import.meta.url));

export const SAMPLE_MODELS = [
  { tool: 'bpmn-lite', file: 'order-process.mkmodel.json' },
  { tool: 'er-lite', file: 'library.mkmodel.json' },
] as const;

export function sampleToolFromDisk(dir: string): ToolLibrary {
  const raw = JSON.parse(readFileSync(`${toolsDir}${dir}/tool.json`, 'utf8'));
  return migrate('tool-document', raw).value as unknown as ToolLibrary;
}

export function sampleModelText(dir: string, file: string): string {
  return readFileSync(`${toolsDir}${dir}/${file}`, 'utf8');
}

export function sampleModelFromDisk(dir: string, file: string): Model {
  return importMkModel(sampleToolFromDisk(dir), sampleModelText(dir, file));
}

export async function newWorkspace(
  name = 'Test workspace',
  instance = 'aaaa0001',
): Promise<Workspace> {
  return Workspace.create(
    new MemoryAdapter(instance),
    { name },
    {
      now: () => new Date('2026-10-07T09:00:00.000Z'),
      read: { retries: 1, delayMs: 1 },
    },
  );
}

/** A model without the drawing order keys, which are made new on every import. */
export function withoutPos(model: Model): unknown {
  const strip = <T extends { pos: string }>(items: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(items).map(([k, v]) => [k, { ...v, pos: undefined }]),
    );
  return {
    ...model,
    elements: strip(model.elements),
    connectors: strip(model.connectors),
  };
}
