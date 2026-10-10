import {
  newId,
  validateKit,
  type Json,
  type Model,
  type KitId,
  type Kit,
} from '@metakit-app/core';
import { FormatError } from './errors';
import { stringifyCanonical } from './json';
import {
  describeMkModelImport,
  exportMkModel,
  importMkModel,
  MkModelError,
  type MkModelImportReport,
} from './mkmodel';
import { CURRENT_FORMAT, migrate } from './migrate';
import { BUNDLE_KIT_PATH, OLDER_BUNDLE_KIT_PATH } from './names';
import { slugify } from './slugify';
import type { Workspace } from './workspace';
import { unzipFiles, zipFiles } from './zip';

/** What exporting needs from a workspace. */
export type WorkspaceReader = Pick<
  Workspace,
  'loadModel' | 'loadKit' | 'findKitSlug'
>;

export const BUNDLE_EXTENSION = '.mkbundle';

interface BundleModelEntry {
  name: string;
  /** Path of the model file inside the zip. */
  file: string;
  /** The explorer folder the model sits in. */
  folder?: string;
}

/**
 * `bundle.json`: what is in the zip. Format 1, from releases before the Kit rename, said `tool`
 * and `includesTool` and held the Kit as `tool/tool.json`; it is read as this.
 */
export interface BundleManifest {
  formatVersion: number;
  kind: 'mkbundle';
  name: string;
  created: string;
  kit: { id: string; name: string; version: string };
  /** Whether `kit/kit.json` is in the zip. */
  includesKit: boolean;
  models: BundleModelEntry[];
}

export interface ExportBundleOptions {
  /** Folder names (slugs) of the models to put in the bundle. */
  models: string[];
  /** Put the Kit in the bundle. Without it, the receiver must already have the Kit. */
  includeKit: boolean;
  /** The name of the bundle; by default the name of the first model. */
  name?: string;
  now?: () => Date;
}

export interface ExportedBundle {
  bytes: Uint8Array;
  /** A name to save the file under, such as `order-process.mkbundle`. */
  fileName: string;
}

const MANIFEST_PATH = 'bundle.json';

function json(value: unknown): string {
  return stringifyCanonical(value as Json);
}

/** Packs models and their Kit into one `.mkbundle` file. All models must come from the same Kit. */
export async function exportBundle(
  workspace: WorkspaceReader,
  options: ExportBundleOptions,
): Promise<ExportedBundle> {
  if (options.models.length === 0)
    throw new FormatError('Choose at least one model for the bundle.');
  const loaded: Model[] = [];
  for (const slug of options.models)
    loaded.push((await workspace.loadModel(slug)).document);
  const kitId = loaded[0]!.manifest.kit;
  const other = loaded.find((m) => m.manifest.kit !== kitId);
  if (other)
    throw new FormatError(
      `A bundle holds one Kit, but "${loaded[0]!.manifest.name}" and "${other.manifest.name}" were made with different ones. Make one bundle for each Kit.`,
    );
  const kitSlug = await workspace.findKitSlug(kitId);
  if (!kitSlug)
    throw new FormatError(
      `The Kit ${kitId} that these models were made with is not in this workspace.`,
    );
  const kit = (await workspace.loadKit(kitSlug)).document;

  const files: Record<string, string> = {};
  const entries: BundleModelEntry[] = [];
  for (const model of loaded) {
    // Two models may share a name, so the file name is made unique.
    const base = slugify(model.manifest.name);
    let file = `models/${base}.mkmodel.json`;
    for (let i = 2; file in files; i++)
      file = `models/${base}-${i}.mkmodel.json`;
    files[file] = exportMkModel(kit, model);
    entries.push({
      name: model.manifest.name,
      file,
      ...(model.manifest.folder === undefined
        ? {}
        : { folder: model.manifest.folder }),
    });
  }
  const name = options.name?.trim() || loaded[0]!.manifest.name;
  const manifest: BundleManifest = {
    formatVersion: CURRENT_FORMAT.bundle,
    kind: 'mkbundle',
    name,
    created: (options.now ?? (() => new Date()))().toISOString(),
    kit: {
      id: kit.manifest.id,
      name: kit.manifest.name,
      version: kit.manifest.version,
    },
    includesKit: options.includeKit,
    models: entries,
  };
  files[MANIFEST_PATH] = json(manifest);
  if (options.includeKit) files[BUNDLE_KIT_PATH] = json(kit);
  return {
    bytes: zipFiles(files),
    fileName: `${slugify(name)}${BUNDLE_EXTENSION}`,
  };
}

export interface BundleImportReport {
  bundleName: string;
  /** The Kit came with the bundle and was added to the workspace. */
  kitAdded: boolean;
  kitSlug: string;
  kit: { id: string; name: string; version: string };
  /** The bundle's Kit has another version than the one already in the workspace (which was used). */
  kitVersionDiffers: boolean;
  added: {
    name: string;
    slug: string;
    folder?: string;
    report: MkModelImportReport;
  }[];
  skipped: { name: string; reason: string }[];
  /** Everything above in plain English, for showing to the person. */
  messages: string[];
}

function readText(
  files: Record<string, Uint8Array>,
  path: string,
): string | null {
  const bytes = files[path];
  return bytes ? new TextDecoder('utf-8').decode(bytes) : null;
}

function parseJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new FormatError(
      `${what} is not valid JSON: ${(error as Error).message}`,
    );
  }
}

/** Reads and checks `bundle.json`. */
export function readBundleManifest(
  files: Record<string, Uint8Array>,
): BundleManifest {
  const text = readText(files, MANIFEST_PATH);
  if (text === null)
    throw new FormatError(
      'This is not a MetaKit bundle: there is no bundle.json in it.',
    );
  const { value } = migrate('bundle', parseJson(text, 'bundle.json'));
  const m = value as unknown as BundleManifest;
  if (m.kind !== 'mkbundle')
    throw new FormatError(
      'This is not a MetaKit bundle (bundle.json has the wrong kind).',
    );
  if (
    typeof m.kit?.id !== 'string' ||
    !Array.isArray(m.models) ||
    m.models.some(
      (e) => typeof e?.file !== 'string' || typeof e?.name !== 'string',
    )
  )
    throw new FormatError(
      'bundle.json is incomplete: it needs the Kit and a list of models with their files.',
    );
  return m;
}

/**
 * Adds the models of a bundle to the workspace, each with a new model id and in the explorer
 * folder it had. The bundle's Kit is added when the workspace does not have a Kit with
 * the same id; otherwise the workspace's own is used and a difference in version is reported.
 * A model that cannot be read is skipped and named in the report; the others are still added.
 */
export async function importBundle(
  workspace: Workspace,
  bytes: Uint8Array,
): Promise<BundleImportReport> {
  const files = unzipFiles(bytes);
  const manifest = readBundleManifest(files);
  const messages: string[] = [];

  let bundledKit: Kit | null = null;
  const kitPath =
    files[BUNDLE_KIT_PATH] !== undefined
      ? BUNDLE_KIT_PATH
      : OLDER_BUNDLE_KIT_PATH;
  const kitText = readText(files, kitPath);
  if (kitText !== null) {
    const migrated = migrate('kit-document', parseJson(kitText, kitPath)).value;
    const issues = validateKit(migrated);
    if (issues.length > 0)
      throw new FormatError(
        `The Kit in this bundle has ${issues.length} problem${issues.length === 1 ? '' : 's'}, so nothing was imported: ${issues
          .slice(0, 3)
          .map((i) => `${i.path || '(top level)'}: ${i.message}`)
          .join('; ')}.`,
      );
    bundledKit = migrated as unknown as Kit;
    if (bundledKit.manifest.id !== manifest.kit.id)
      throw new FormatError(
        'The Kit in this bundle is not the one bundle.json names, so nothing was imported.',
      );
  }

  let kitSlug = await workspace.findKitSlug(manifest.kit.id as KitId);
  let kitAdded = false;
  let kitVersionDiffers = false;
  if (kitSlug === null) {
    if (!bundledKit)
      throw new FormatError(
        `This bundle does not include its Kit "${manifest.kit.name}" (${manifest.kit.id}), and the workspace does not have it. Import the Kit package first.`,
      );
    kitSlug = await workspace.createKit(bundledKit);
    kitAdded = true;
    messages.push(
      `Added the Kit "${bundledKit.manifest.name}" (version ${bundledKit.manifest.version}).`,
    );
  } else {
    const have = (await workspace.loadKit(kitSlug)).document;
    const offered = bundledKit?.manifest.version ?? manifest.kit.version;
    kitVersionDiffers = offered !== have.manifest.version;
    messages.push(
      `The workspace already has the Kit "${have.manifest.name}", so that one was used.`,
    );
    if (kitVersionDiffers)
      messages.push(
        `The bundle was made with version ${offered} of the Kit, but the workspace has version ${have.manifest.version}. The models were read with the version in the workspace; check them for changes.`,
      );
  }
  const kit = (await workspace.loadKit(kitSlug)).document;

  const added: BundleImportReport['added'] = [];
  const skipped: BundleImportReport['skipped'] = [];
  for (const entry of manifest.models) {
    const text = readText(files, entry.file);
    if (text === null) {
      skipped.push({
        name: entry.name,
        reason: `The file ${entry.file} is missing from the bundle.`,
      });
      continue;
    }
    try {
      const read = importMkModel(kit, text);
      const model: Model = {
        ...read,
        manifest: {
          ...read.manifest,
          id: newId('model'),
          // The folder in bundle.json is what the person saw when exporting.
          ...(entry.folder !== undefined && read.manifest.folder === undefined
            ? { folder: entry.folder }
            : {}),
        },
      };
      const slug = await workspace.createModel(model);
      // What the file says about its Kit, under the name of its format (`tool` in format 1).
      const fileKit = (
        migrate('mkmodel', JSON.parse(text)).value as {
          kit?: { id?: string; name?: string; version?: string };
        }
      ).kit;
      added.push({
        name: model.manifest.name,
        slug,
        ...(model.manifest.folder === undefined
          ? {}
          : { folder: model.manifest.folder }),
        report: describeMkModelImport(kit, fileKit, model, false),
      });
    } catch (error) {
      const reason =
        error instanceof MkModelError
          ? `It has ${error.issues.length} problem${error.issues.length === 1 ? '' : 's'}, for example ${error.issues[0]!.path}: ${error.issues[0]!.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      skipped.push({ name: entry.name, reason });
    }
  }
  messages.push(
    `Added ${added.length} model${added.length === 1 ? '' : 's'}${
      skipped.length > 0 ? ` and skipped ${skipped.length}` : ''
    }.`,
  );
  for (const s of skipped) messages.push(`Skipped "${s.name}": ${s.reason}`);
  return {
    bundleName: manifest.name,
    kitAdded,
    kitSlug,
    kit: manifest.kit,
    kitVersionDiffers,
    added,
    skipped,
    messages,
  };
}
