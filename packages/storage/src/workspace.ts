import {
  MODEL_FORMAT_VERSION,
  TOOL_FORMAT_VERSION,
  validateModelDocument,
  validateToolLibrary,
  type Issue,
  type Json,
  type Model,
  type ModelId,
  type ModelTypeId,
  type ToolId,
  type ToolLibrary,
} from '@metakit-app/core';
import type { StorageAdapter, Unwatch } from './adapter';
import { addAsset, readAsset } from './assets';
import { AlreadyExistsError, FormatError, NotFoundError } from './errors';
import { jsonBytes, readJsonFile, type ReadOptions } from './json';
import { exportMkModel, importMkModel } from './mkmodel';
import { CURRENT_FORMAT, migrate } from './migrate';
import { joinPath } from './paths';

export type DocumentKind = 'tool' | 'model';

export interface WorkspaceInfo {
  name: string;
  created: string;
}

/** A document read from the workspace, with what was found while reading it. */
export interface Loaded<T> {
  document: T;
  /** When the loaded snapshot was written, and by which instance. */
  savedAt: string;
  instance: string;
  /** Things to tell the user, such as snapshots of other instances that were not loaded. */
  warnings: string[];
  /** Problems with the definition itself (not with its content). The document is returned anyway, so nothing is lost. */
  issues: Issue[];
}

export interface ToolEntry {
  slug: string;
  id: ToolId;
  name: string;
  version: string;
}

export interface ModelEntry {
  slug: string;
  id: ModelId;
  name: string;
  tool: ToolId;
  modelType: ModelTypeId;
  folder?: string;
  /** Only present when trashed models were asked for. */
  trashed?: boolean;
}

export interface WorkspaceOptions {
  now?: () => Date;
  read?: ReadOptions;
}

const FOLDERS: Record<DocumentKind, string> = {
  tool: 'tools',
  model: 'models',
};
const IDENTITY_FILE: Record<DocumentKind, string> = {
  tool: 'tool.json',
  model: 'model.json',
};

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug === '' ? 'untitled' : slug;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;

function randomSuffix(): string {
  const chars = 'abcdefghjkmnpqrstvwxyz23456789';
  const bytes = (
    globalThis as unknown as {
      crypto: { getRandomValues(a: Uint8Array): Uint8Array };
    }
  ).crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

/**
 * A workspace folder: tool libraries and models, each in its own folder that never changes name.
 *
 * Until change files arrive (phase 3), a document is saved as one snapshot, written by the
 * instance that saved it to `<folder>/_state/<instance>/snapshot.json`. The identity files
 * (`tool.json`, `model.json`) are written once.
 */
export class Workspace {
  private constructor(
    readonly adapter: StorageAdapter,
    readonly info: WorkspaceInfo,
    private readonly options: WorkspaceOptions,
  ) {}

  private get now(): Date {
    return (this.options.now ?? (() => new Date()))();
  }

  static async create(
    adapter: StorageAdapter,
    input: { name: string },
    options: WorkspaceOptions = {},
  ): Promise<Workspace> {
    const created = (options.now ?? (() => new Date()))().toISOString();
    const info = { name: input.name, created };
    try {
      await adapter.writeNew(
        'workspace.json',
        jsonBytes({ formatVersion: CURRENT_FORMAT.workspace, ...info }),
      );
    } catch (error) {
      if (error instanceof AlreadyExistsError)
        throw new AlreadyExistsError(
          'There is already a MetaKit workspace in this folder.',
        );
      throw error;
    }
    return new Workspace(adapter, info, options);
  }

  static async open(
    adapter: StorageAdapter,
    options: WorkspaceOptions = {},
  ): Promise<Workspace> {
    if (!(await adapter.exists('workspace.json'))) {
      throw new NotFoundError(
        'This folder is not a MetaKit workspace: there is no workspace.json in it.',
      );
    }
    const { value } = migrate(
      'workspace',
      await readJsonFile(adapter, 'workspace.json', options.read),
    );
    return new Workspace(
      adapter,
      { name: String(value.name ?? ''), created: String(value.created ?? '') },
      options,
    );
  }

  /** Things worth telling the user that were found while reading, such as a marker from a newer release. */
  readonly warnings: string[] = [];

  /** Reports changes anywhere in the workspace, for example another instance saving a document. */
  watch(callback: (changed: string[]) => void): Unwatch {
    return this.adapter.watch('', callback);
  }

  // --- documents ---------------------------------------------------------------------------

  private folder(kind: DocumentKind, slug: string): string {
    if (!SLUG.test(slug))
      throw new FormatError(
        `"${slug}" is not a valid folder name for a ${kind}.`,
      );
    return joinPath(FOLDERS[kind], slug);
  }

  private async slugs(kind: DocumentKind): Promise<string[]> {
    return (await this.adapter.list(FOLDERS[kind]))
      .filter((e) => e.kind === 'directory')
      .map((e) => e.name);
  }

  private async uniqueSlug(
    kind: DocumentKind,
    wanted: string,
    suffix: boolean,
  ): Promise<string> {
    const taken = new Set(await this.slugs(kind));
    const base = slugify(wanted);
    if (!suffix && !taken.has(base)) return base;
    for (let i = 0; i < 50; i++) {
      const candidate = suffix
        ? `${base}-${randomSuffix()}`
        : `${base}-${i + 2}`;
      if (!taken.has(candidate)) return candidate;
    }
    throw new Error('Could not find a free folder name.');
  }

  private snapshotPath(folder: string): string {
    return joinPath(folder, '_state', this.adapter.instanceId, 'snapshot.json');
  }

  private async writeSnapshot(
    kind: DocumentKind,
    folder: string,
    document: Json,
  ): Promise<void> {
    await this.adapter.overwrite(
      this.snapshotPath(folder),
      jsonBytes({
        formatVersion: CURRENT_FORMAT.snapshot,
        kind,
        instance: this.adapter.instanceId,
        savedAt: this.now.toISOString(),
        document,
      }),
    );
  }

  private async load<T>(
    kind: DocumentKind,
    slug: string,
  ): Promise<{ identity: Record<string, unknown>; loaded: Loaded<T> }> {
    const folder = this.folder(kind, slug);
    const identityPath = joinPath(folder, IDENTITY_FILE[kind]);
    if (!(await this.adapter.exists(identityPath)))
      throw new NotFoundError(
        `There is no ${kind} "${slug}" in this workspace.`,
      );
    const identity = migrate(
      kind,
      await readJsonFile(this.adapter, identityPath, this.options.read),
    ).value;

    const warnings: string[] = [];
    const found: {
      instance: string;
      savedAt: string;
      document: Record<string, unknown>;
    }[] = [];
    for (const entry of await this.adapter.list(joinPath(folder, '_state'))) {
      if (entry.kind !== 'directory') continue;
      const path = joinPath(folder, '_state', entry.name, 'snapshot.json');
      if (!(await this.adapter.exists(path))) continue;
      try {
        const snapshot = migrate(
          'snapshot',
          await readJsonFile(this.adapter, path, this.options.read),
        ).value;
        if (snapshot.kind !== kind)
          throw new FormatError(
            `it holds a ${String(snapshot.kind)}, not a ${kind}`,
          );
        const document = migrate(
          kind === 'tool' ? 'tool-document' : 'model-document',
          snapshot.document,
        ).value;
        found.push({
          instance: entry.name,
          savedAt: String(snapshot.savedAt),
          document,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'NewerFormatError')
          throw error;
        warnings.push(
          `The snapshot of instance ${entry.name} could not be read and was skipped: ${(error as Error).message}`,
        );
      }
    }
    if (found.length === 0)
      throw new NotFoundError(
        `The ${kind} "${slug}" has no saved content yet.${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
      );
    found.sort((a, b) =>
      a.savedAt === b.savedAt
        ? a.instance < b.instance
          ? -1
          : 1
        : a.savedAt < b.savedAt
          ? -1
          : 1,
    );
    const latest = found.at(-1)!;
    for (const other of found.slice(0, -1)) {
      warnings.push(
        `Instance ${other.instance} also saved this ${kind} (at ${other.savedAt}). The newest snapshot, from instance ${latest.instance}, was loaded. Changes from several instances are merged in a later version.`,
      );
    }
    const document = latest.document as unknown;
    const issues =
      kind === 'tool'
        ? validateToolLibrary(document)
        : validateModelDocument(document);
    return {
      identity,
      loaded: {
        document: document as T,
        savedAt: latest.savedAt,
        instance: latest.instance,
        warnings,
        issues,
      },
    };
  }

  // --- tool libraries ----------------------------------------------------------------------

  async listTools(): Promise<ToolEntry[]> {
    const entries: ToolEntry[] = [];
    for (const slug of await this.slugs('tool')) {
      try {
        const { loaded } = await this.load<ToolLibrary>('tool', slug);
        const m = loaded.document.manifest;
        entries.push({ slug, id: m.id, name: m.name, version: m.version });
      } catch {
        // A folder that is not a readable tool is not listed; opening it by name explains why.
      }
    }
    return entries;
  }

  /** Adds a tool library and returns its folder name. Pass a `slug` to choose it. */
  async createTool(
    tool: ToolLibrary,
    options: { slug?: string } = {},
  ): Promise<string> {
    const slug =
      options.slug ??
      (await this.uniqueSlug('tool', tool.manifest.name, false));
    const folder = this.folder('tool', slug);
    await this.adapter.writeNew(
      joinPath(folder, IDENTITY_FILE.tool),
      jsonBytes({
        formatVersion: CURRENT_FORMAT.tool,
        kind: 'tool',
        id: tool.manifest.id,
        name: tool.manifest.name,
        created: this.now.toISOString(),
      }),
    );
    await this.writeSnapshot('tool', folder, tool as unknown as Json);
    return slug;
  }

  loadTool(slug: string): Promise<Loaded<ToolLibrary>> {
    return this.load<ToolLibrary>('tool', slug).then((r) => r.loaded);
  }

  async saveTool(slug: string, tool: ToolLibrary): Promise<void> {
    const folder = this.folder('tool', slug);
    if (!(await this.adapter.exists(joinPath(folder, IDENTITY_FILE.tool))))
      throw new NotFoundError(
        `There is no tool "${slug}" in this workspace. Use createTool first.`,
      );
    await this.writeSnapshot('tool', folder, {
      ...(tool as unknown as Record<string, Json>),
      formatVersion: TOOL_FORMAT_VERSION,
    });
  }

  /** The folder of the tool library with this id. */
  async findToolSlug(id: ToolId): Promise<string | null> {
    for (const t of await this.listTools()) if (t.id === id) return t.slug;
    return null;
  }

  addToolAsset(
    slug: string,
    fileName: string,
    bytes: Uint8Array,
  ): Promise<string> {
    return addAsset(
      this.adapter,
      joinPath(this.folder('tool', slug), 'assets'),
      fileName,
      bytes,
    );
  }

  readToolAsset(slug: string, name: string): Promise<Uint8Array> {
    return readAsset(
      this.adapter,
      joinPath(this.folder('tool', slug), 'assets'),
      name,
    );
  }

  // --- models ------------------------------------------------------------------------------

  async listModels(
    options: { includeTrashed?: boolean } = {},
  ): Promise<ModelEntry[]> {
    const entries: ModelEntry[] = [];
    for (const slug of await this.slugs('model')) {
      try {
        const trashed = await this.isTrashed(slug);
        if (trashed && !options.includeTrashed) continue;
        const { loaded } = await this.load<Model>('model', slug);
        const m = loaded.document.manifest;
        entries.push({
          slug,
          id: m.id,
          name: m.name,
          tool: m.tool,
          modelType: m.modelType,
          ...(m.folder === undefined ? {} : { folder: m.folder }),
          ...(options.includeTrashed ? { trashed } : {}),
        });
      } catch {
        // See listTools.
      }
    }
    return entries;
  }

  private trashPath(folder: string): string {
    return joinPath(folder, '_state', this.adapter.instanceId, 'trash.json');
  }

  private async writeTrashMarker(
    slug: string,
    trashed: boolean,
  ): Promise<void> {
    const folder = this.folder('model', slug);
    if (!(await this.adapter.exists(joinPath(folder, IDENTITY_FILE.model))))
      throw new NotFoundError(`There is no model "${slug}" in this workspace.`);
    await this.adapter.overwrite(
      this.trashPath(folder),
      jsonBytes({
        formatVersion: CURRENT_FORMAT.trash,
        trashed,
        at: this.now.toISOString(),
      }),
    );
  }

  /**
   * Moves a model to the trash. Nothing is removed: an instance may not delete files that other
   * instances wrote, so this writes a marker in its own state folder, and the newest marker of all
   * instances decides.
   */
  trashModel(slug: string): Promise<void> {
    return this.writeTrashMarker(slug, true);
  }

  restoreModel(slug: string): Promise<void> {
    return this.writeTrashMarker(slug, false);
  }

  private async isTrashed(slug: string): Promise<boolean> {
    const state = joinPath(this.folder('model', slug), '_state');
    let newest: { at: string; instance: string; trashed: boolean } | null =
      null;
    for (const entry of await this.adapter.list(state)) {
      if (entry.kind !== 'directory') continue;
      const path = joinPath(state, entry.name, 'trash.json');
      if (!(await this.adapter.exists(path))) continue;
      try {
        const marker = migrate(
          'trash',
          await readJsonFile(this.adapter, path, this.options.read),
        ).value;
        const at = String(marker.at ?? '');
        if (
          !newest ||
          at > newest.at ||
          (at === newest.at && entry.name > newest.instance)
        )
          newest = {
            at,
            instance: entry.name,
            trashed: marker.trashed === true,
          };
      } catch (error) {
        const note =
          error instanceof Error && error.name === 'NewerFormatError'
            ? `The trash marker of instance ${entry.name} for model "${slug}" is from a newer version of MetaKit and was ignored.`
            : `The trash marker of instance ${entry.name} for model "${slug}" could not be read and was ignored: ${(error as Error).message}`;
        if (!this.warnings.includes(note)) this.warnings.push(note);
      }
    }
    return newest?.trashed ?? false;
  }

  /** Adds a model and returns its folder name, such as `order-to-cash-9xk2`. */
  async createModel(
    model: Model,
    options: { slug?: string } = {},
  ): Promise<string> {
    const slug =
      options.slug ?? `${slugify(model.manifest.name)}-${randomSuffix()}`;
    const folder = this.folder('model', slug);
    await this.adapter.writeNew(
      joinPath(folder, IDENTITY_FILE.model),
      jsonBytes({
        formatVersion: CURRENT_FORMAT.model,
        kind: 'model',
        id: model.manifest.id,
        tool: model.manifest.tool,
        modelType: model.manifest.modelType,
        name: model.manifest.name,
        created: this.now.toISOString(),
      }),
    );
    await this.writeSnapshot('model', folder, model as unknown as Json);
    return slug;
  }

  loadModel(slug: string): Promise<Loaded<Model>> {
    return this.load<Model>('model', slug).then((r) => r.loaded);
  }

  async saveModel(slug: string, model: Model): Promise<void> {
    const folder = this.folder('model', slug);
    if (!(await this.adapter.exists(joinPath(folder, IDENTITY_FILE.model))))
      throw new NotFoundError(
        `There is no model "${slug}" in this workspace. Use createModel first.`,
      );
    await this.writeSnapshot('model', folder, {
      ...(model as unknown as Record<string, Json>),
      formatVersion: MODEL_FORMAT_VERSION,
    });
  }

  /** The model as an editable `.mkmodel.json` text, using the tool library it was made with. */
  async exportModel(slug: string): Promise<string> {
    const { document: model } = await this.loadModel(slug);
    const toolSlug = await this.findToolSlug(model.manifest.tool);
    if (!toolSlug)
      throw new NotFoundError(
        `The tool library ${model.manifest.tool} that this model was made with is not in this workspace.`,
      );
    return exportMkModel((await this.loadTool(toolSlug)).document, model);
  }

  /** Creates a model from an editable model file and returns its folder name. */
  async importModel(
    text: string,
    options: { toolSlug: string; slug?: string },
  ): Promise<string> {
    const tool = (await this.loadTool(options.toolSlug)).document;
    const model = importMkModel(tool, text);
    return this.createModel(model, options.slug ? { slug: options.slug } : {});
  }
}
