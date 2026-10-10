import { snapshotV1ToV2, snapshotV2ToV3 } from '@metakit-app/sync';
import { FormatError, NewerFormatError } from './errors';

/** The kinds of versioned file, each with its own format version. */
export type FileKind =
  | 'workspace'
  /** The identity file of a Kit folder: `kit.json`, or `tool.json` in format 1. */
  | 'kit'
  /** The identity file of a model folder: `model.json`. */
  | 'model'
  | 'snapshot'
  | 'trash'
  | 'mkmodel'
  | 'kit-document'
  | 'model-document'
  | 'bundle'
  | 'kit-package';

/** The format version this release writes for each kind. Raising one needs a migration step below and a test (rule 8). */
export const CURRENT_FORMAT: Readonly<Record<FileKind, number>> = {
  workspace: 1,
  kit: 2,
  model: 2,
  snapshot: 3,
  trash: 1,
  mkmodel: 2,
  'kit-document': 7,
  'model-document': 2,
  // .mkbundle (bundle.json) and .mkkit (package.json), phase 6.
  bundle: 2,
  'kit-package': 2,
};

/** How messages name each kind. */
const KIND_WORDS: Partial<Record<FileKind, string>> = {
  kit: 'Kit',
  'kit-document': 'Kit document',
  'kit-package': 'Kit package',
};

/** Moves a field to its new name (ADR 0011); a file that somehow has both keeps the new one. */
function renamed(
  value: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, unknown> {
  if (!(from in value)) return value;
  const { [from]: old, ...rest } = value;
  return to in rest ? rest : { ...rest, [to]: old };
}

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
  kit: [
    {
      // Format 2 is `kit.json` with `kind: "kit"`; format 1 was `tool.json` with `kind: "tool"` (ADR 0011).
      from: 1,
      to: 2,
      up: (file) => ({
        ...file,
        ...(file.kind === 'tool' ? { kind: 'kit' } : {}),
      }),
    },
  ],
  model: [
    {
      // Format 2 names the Kit of the model `kit`; format 1 said `tool` (ADR 0011).
      from: 1,
      to: 2,
      up: (file) => renamed(file, 'tool', 'kit'),
    },
  ],
  snapshot: [
    {
      // Format 1 held a plain document; format 2 holds registers (ADR 0002).
      from: 1,
      to: 2,
      up: (file) => snapshotV1ToV2(file),
    },
    {
      // Format 3: a Kit is `kind: "kit"`, and the model registers `manifest/tool` and
      // `manifest/toolVersion` are `manifest/kit` and `manifest/kitVersion` (ADR 0011).
      from: 2,
      to: 3,
      up: (file) => snapshotV2ToV3(file),
    },
  ],
  trash: [],
  mkmodel: [
    {
      // Format 2 names the Kit `kit`; format 1 said `tool` (ADR 0011).
      from: 1,
      to: 2,
      up: (file) => renamed(file, 'tool', 'kit'),
    },
  ],
  'kit-document': [
    {
      // Format 2 adds shapes and panel layouts (ADR 0004); older libraries have none.
      from: 1,
      to: 2,
      up: (file) => ({
        ...file,
        shapes: file.shapes ?? {},
        panels: file.panels ?? {},
      }),
    },
    {
      // Format 3 adds rules (ADR 0005); constraints and default formulas are optional fields.
      from: 2,
      to: 3,
      up: (file) => ({ ...file, rules: file.rules ?? {} }),
    },
    {
      // Format 4 adds scripts (ADR 0006); permissions in the manifest are optional.
      from: 3,
      to: 4,
      up: (file) => ({ ...file, scripts: file.scripts ?? {} }),
    },
    {
      // Format 5 adds the optional `look` to shapes (ADR 0009); nothing existing changes.
      from: 4,
      to: 5,
      up: (file) => ({ ...file }),
    },
    {
      // Format 6 adds the optional `manifest.basedOn` of copies (ADR 0010); nothing existing changes.
      from: 5,
      to: 6,
      up: (file) => ({ ...file }),
    },
    {
      // Format 7 allows `kit_` ids (ADR 0011). Existing `tool_` ids stay valid and are kept.
      from: 6,
      to: 7,
      up: (file) => ({ ...file }),
    },
  ],
  'model-document': [
    {
      // Format 2 says `manifest.kit` and `manifest.kitVersion`; format 1 said `tool` and `toolVersion` (ADR 0011).
      from: 1,
      to: 2,
      up: (file) => {
        const manifest = file.manifest;
        if (
          manifest === null ||
          typeof manifest !== 'object' ||
          Array.isArray(manifest)
        )
          return file;
        return {
          ...file,
          manifest: renamed(
            renamed(manifest as Record<string, unknown>, 'tool', 'kit'),
            'toolVersion',
            'kitVersion',
          ),
        };
      },
    },
  ],
  bundle: [
    {
      // Format 2 holds `kit/kit.json` and says `kit` and `includesKit`; format 1 said `tool`,
      // `includesTool` and held `tool/tool.json` (ADR 0011).
      from: 1,
      to: 2,
      up: (file) =>
        renamed(renamed(file, 'tool', 'kit'), 'includesTool', 'includesKit'),
    },
  ],
  'kit-package': [
    {
      // Format 2 is a `.mkkit` with `kind: "mkkit"`, `kit` and `kit.json`; format 1 was a `.mktool`
      // with `kind: "mktool"`, `tool` and `tool.json` (ADR 0011).
      from: 1,
      to: 2,
      up: (file) => ({
        ...renamed(file, 'tool', 'kit'),
        ...(file.kind === 'mktool' ? { kind: 'mkkit' } : {}),
      }),
    },
  ],
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
  const word = KIND_WORDS[kind] ?? kind;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new FormatError(`This ${word} file must contain an object.`);
  }
  const version = (input as { formatVersion?: unknown }).formatVersion;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 0
  ) {
    throw new FormatError(
      `This ${word} file has no format version (formatVersion), so it cannot be read safely.`,
    );
  }
  const target = current[kind];
  if (version > target) {
    throw new NewerFormatError(
      `This ${word} file was written by a newer version of MetaKit (format ${version}; this version reads up to ${target}). Update MetaKit to open it. The file has not been changed.`,
    );
  }
  let value = input as Record<string, unknown>;
  let at = version;
  while (at < target) {
    const step = registry[kind].find((m) => m.from === at);
    if (!step)
      throw new FormatError(
        `There is no way to bring a ${word} file from format ${at} up to ${target}.`,
      );
    value = step.up(value);
    if (value.formatVersion !== step.to)
      value = { ...value, formatVersion: step.to };
    at = step.to;
  }
  return { value, from: version, to: target };
}
