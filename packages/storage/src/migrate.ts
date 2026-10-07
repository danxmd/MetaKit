import { snapshotV1ToV2 } from '@metakit-app/sync';
import { FormatError, NewerFormatError } from './errors';

/** The kinds of versioned file, each with its own format version. */
export type FileKind =
  | 'workspace'
  | 'tool'
  | 'model'
  | 'snapshot'
  | 'trash'
  | 'mkmodel'
  | 'tool-document'
  | 'model-document';

/** The format version this release writes for each kind. Raising one needs a migration step below and a test (rule 8). */
export const CURRENT_FORMAT: Readonly<Record<FileKind, number>> = {
  workspace: 1,
  tool: 1,
  model: 1,
  snapshot: 2,
  trash: 1,
  mkmodel: 1,
  'tool-document': 1,
  'model-document': 1,
};

export interface Migration {
  from: number;
  to: number;
  up(value: Record<string, unknown>): Record<string, unknown>;
}

export type MigrationRegistry = Readonly<
  Record<FileKind, readonly Migration[]>
>;

/**
 * One step per version change, in order. The only step so far is an example kept for its test:
 * a version 0 workspace file called its name `title`.
 */
export const MIGRATIONS: MigrationRegistry = {
  workspace: [
    {
      from: 0,
      to: 1,
      up: ({ title, ...rest }) => ({
        ...rest,
        ...(title !== undefined && rest.name === undefined
          ? { name: title }
          : {}),
        formatVersion: 1,
      }),
    },
  ],
  tool: [],
  model: [],
  snapshot: [
    {
      // Format 1 held a plain document; format 2 holds registers (ADR 0002).
      from: 1,
      to: 2,
      up: (file) => snapshotV1ToV2(file),
    },
  ],
  trash: [],
  mkmodel: [],
  'tool-document': [],
  'model-document': [],
};

export interface Migrated {
  value: Record<string, unknown>;
  from: number;
  to: number;
}

/**
 * Brings a parsed file up to the current format in memory. The file on disk is not touched;
 * saving writes the current version. A newer file is refused so that it is never damaged.
 */
export function migrate(
  kind: FileKind,
  input: unknown,
  registry: MigrationRegistry = MIGRATIONS,
  current: Readonly<Record<FileKind, number>> = CURRENT_FORMAT,
): Migrated {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new FormatError(`This ${kind} file must contain an object.`);
  }
  const version = (input as { formatVersion?: unknown }).formatVersion;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 0
  ) {
    throw new FormatError(
      `This ${kind} file has no format version (formatVersion), so it cannot be read safely.`,
    );
  }
  const target = current[kind];
  if (version > target) {
    throw new NewerFormatError(
      `This ${kind} file was written by a newer version of MetaKit (format ${version}; this version reads up to ${target}). Update MetaKit to open it. The file has not been changed.`,
    );
  }
  let value = input as Record<string, unknown>;
  let at = version;
  while (at < target) {
    const step = registry[kind].find((m) => m.from === at);
    if (!step)
      throw new FormatError(
        `There is no way to bring a ${kind} file from format ${at} up to ${target}.`,
      );
    value = step.up(value);
    if (value.formatVersion !== step.to)
      value = { ...value, formatVersion: step.to };
    at = step.to;
  }
  return { value, from: version, to: target };
}
