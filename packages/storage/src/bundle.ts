import {
  newId,
  validateToolLibrary,
  type Json,
  type Model,
  type ToolId,
  type ToolLibrary,
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
import { migrate } from './migrate';
import { slugify } from './slugify';
import type { Workspace } from './workspace';
import { unzipFiles, zipFiles } from './zip';

/** What exporting needs from a workspace. */
export type WorkspaceReader = Pick<
  Workspace,
  'loadModel' | 'loadTool' | 'findToolSlug'
>;

export const BUNDLE_EXTENSION = '.mkbundle';

interface BundleModelEntry {
  name: string;
  /** Path of the model file inside the zip. */
  file: string;
  /** The explorer folder the model sits in. */
  folder?: string;
}

/** `bundle.json`: what is in the zip. */
export interface BundleManifest {
  formatVersion: number;
  kind: 'mkbundle';
  name: string;
  created: string;
  tool: { id: string; name: string; version: string };
  /** Whether `tool/tool.json` is in the zip. */
  includesTool: boolean;
  models: BundleModelEntry[];
}

export interface ExportBundleOptions {
  /** Folder names (slugs) of the models to put in the bundle. */
  models: string[];
  /** Put the tool library in the bundle. Without it, the receiver must already have the tool. */
  includeTool: boolean;
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
const TOOL_PATH = 'tool/tool.json';

function json(value: unknown): string {
  return stringifyCanonical(value as Json);
}

/** Packs models and their tool library into one `.mkbundle` file. All models must come from the same tool library. */
export async function exportBundle(
  workspace: WorkspaceReader,
  options: ExportBundleOptions,
): Promise<ExportedBundle> {
  if (options.models.length === 0)
    throw new FormatError('Choose at least one model for the bundle.');
  const loaded: Model[] = [];
  for (const slug of options.models)
    loaded.push((await workspace.loadModel(slug)).document);
  const toolId = loaded[0]!.manifest.tool;
  const other = loaded.find((m) => m.manifest.tool !== toolId);
  if (other)
    throw new FormatError(
      `A bundle holds one tool library, but "${loaded[0]!.manifest.name}" and "${other.manifest.name}" were made with different ones. Make one bundle for each tool library.`,
    );
  const toolSlug = await workspace.findToolSlug(toolId);
  if (!toolSlug)
    throw new FormatError(
      `The tool library ${toolId} that these models were made with is not in this workspace.`,
    );
  const tool = (await workspace.loadTool(toolSlug)).document;

  const files: Record<string, string> = {};
  const entries: BundleModelEntry[] = [];
  for (const model of loaded) {
    // Two models may share a name, so the file name is made unique.
    const base = slugify(model.manifest.name);
    let file = `models/${base}.mkmodel.json`;
    for (let i = 2; file in files; i++)
      file = `models/${base}-${i}.mkmodel.json`;
    files[file] = exportMkModel(tool, model);
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
    formatVersion: 1,
    kind: 'mkbundle',
    name,
    created: (options.now ?? (() => new Date()))().toISOString(),
    tool: {
      id: tool.manifest.id,
      name: tool.manifest.name,
      version: tool.manifest.version,
    },
    includesTool: options.includeTool,
    models: entries,
  };
  files[MANIFEST_PATH] = json(manifest);
  if (options.includeTool) files[TOOL_PATH] = json(tool);
  return {
    bytes: zipFiles(files),
    fileName: `${slugify(name)}${BUNDLE_EXTENSION}`,
  };
}

export interface BundleImportReport {
  bundleName: string;
  /** The tool library came with the bundle and was added to the workspace. */
  toolAdded: boolean;
  toolSlug: string;
  tool: { id: string; name: string; version: string };
  /** The bundle's tool library has another version than the one already in the workspace (which was used). */
  toolVersionDiffers: boolean;
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
    typeof m.tool?.id !== 'string' ||
    !Array.isArray(m.models) ||
    m.models.some(
      (e) => typeof e?.file !== 'string' || typeof e?.name !== 'string',
    )
  )
    throw new FormatError(
      'bundle.json is incomplete: it needs the tool and a list of models with their files.',
    );
  return m;
}

/**
 * Adds the models of a bundle to the workspace, each with a new model id and in the explorer
 * folder it had. The bundle's tool library is added when the workspace does not have a tool with
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

  let bundledTool: ToolLibrary | null = null;
  const toolText = readText(files, TOOL_PATH);
  if (toolText !== null) {
    const migrated = migrate(
      'tool-document',
      parseJson(toolText, 'tool/tool.json'),
    ).value;
    const issues = validateToolLibrary(migrated);
    if (issues.length > 0)
      throw new FormatError(
        `The tool library in this bundle has ${issues.length} problem${issues.length === 1 ? '' : 's'}, so nothing was imported: ${issues
          .slice(0, 3)
          .map((i) => `${i.path || '(top level)'}: ${i.message}`)
          .join('; ')}.`,
      );
    bundledTool = migrated as unknown as ToolLibrary;
    if (bundledTool.manifest.id !== manifest.tool.id)
      throw new FormatError(
        'The tool library in this bundle is not the one bundle.json names, so nothing was imported.',
      );
  }

  let toolSlug = await workspace.findToolSlug(manifest.tool.id as ToolId);
  let toolAdded = false;
  let toolVersionDiffers = false;
  if (toolSlug === null) {
    if (!bundledTool)
      throw new FormatError(
        `This bundle does not include its tool library "${manifest.tool.name}" (${manifest.tool.id}), and the workspace does not have it. Import the tool package first.`,
      );
    toolSlug = await workspace.createTool(bundledTool);
    toolAdded = true;
    messages.push(
      `Added the tool library "${bundledTool.manifest.name}" (version ${bundledTool.manifest.version}).`,
    );
  } else {
    const have = (await workspace.loadTool(toolSlug)).document;
    const offered = bundledTool?.manifest.version ?? manifest.tool.version;
    toolVersionDiffers = offered !== have.manifest.version;
    messages.push(
      `The workspace already has the tool library "${have.manifest.name}", so that one was used.`,
    );
    if (toolVersionDiffers)
      messages.push(
        `The bundle was made with version ${offered} of the tool library, but the workspace has version ${have.manifest.version}. The models were read with the version in the workspace; check them for changes.`,
      );
  }
  const tool = (await workspace.loadTool(toolSlug)).document;

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
      const read = importMkModel(tool, text);
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
      const fileTool = (
        JSON.parse(text) as {
          tool?: { id?: string; name?: string; version?: string };
        }
      ).tool;
      added.push({
        name: model.manifest.name,
        slug,
        ...(model.manifest.folder === undefined
          ? {}
          : { folder: model.manifest.folder }),
        report: describeMkModelImport(tool, fileTool, model, false),
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
    toolAdded,
    toolSlug,
    tool: manifest.tool,
    toolVersionDiffers,
    added,
    skipped,
    messages,
  };
}
