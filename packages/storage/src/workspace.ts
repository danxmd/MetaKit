import {
  createModelStore,
  createToolStore,
  validateModelDocument,
  validateToolLibrary,
  type Issue,
  type Json,
  type Model,
  type ModelId,
  type ModelStore,
  type ModelTypeId,
  type ToolId,
  type ToolLibrary,
  type ToolStore,
} from '@metakit-app/core';
import {
  loadDocument,
  materialize,
  replaceDocument,
  SyncSession,
  writeNewDocument,
  type SessionOptions,
} from '@metakit-app/sync';
import type { StorageAdapter, Unwatch } from './adapter';
import { addAsset, readAsset } from './assets';
import {
  AlreadyExistsError,
  FormatError,
  NewerFormatError,
  NotFoundError,
} from './errors';
import {
  checkFolderHealth,
  type HealthFinding,
  type HealthOptions,
} from './health';
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
  /** The time of the newest change in what was loaded. */
  savedAt: string;
  /** Things to tell the user, such as snapshots of other instances that were not loaded. */
  warnings: string[];
  /** Problems with the definition itself (not with its content). The document is returned anyway, so nothing is lost. */
  issues: Issue[];
}

/** A document opened for live editing. */
export interface OpenedDocument<S> {
  store: S;
  session: SyncSession;
  warnings: string[];
  issues: Issue[];
}

export interface ToolEntry {
  slug: string;
  id: ToolId;
  name: string;
  version: string;
  trashed?: boolean;
  trashedAt?: string;
  expired?: boolean;
}

/** How long a deleted model or tool library can be restored. */
export const TRASH_DAYS = 30;

export interface ModelEntry {
  slug: string;
  id: ModelId;
  name: string;
  tool: ToolId;
  modelType: ModelTypeId;
  folder?: string;
  /** Only present when trashed models were asked for. */
  trashed?: boolean;
  trashedAt?: string;
  /** In the trash for more than 30 days: no longer offered for restoring. */
  expired?: boolean;
}

export interface WorkspaceOptions {
  now?: () => Date;
  read?: ReadOptions;
}

/** The sync layer's refusal of a newer file, as the storage layer's own error. */
function newerAsStorageError(error: unknown): never {
  if (
    error instanceof Error &&
    error.name === 'NewerFormatError' &&
    !(error instanceof NewerFormatError)
  )
    throw new NewerFormatError(error.message);
  throw error;
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

  /** Looks at the folder for signs that sync is not set up well (see `checkFolderHealth`). */
  checkHealth(options: HealthOptions = {}): Promise<HealthFinding[]> {
    return checkFolderHealth(this.adapter, options);
  }

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

  private syncOptions(kind: DocumentKind, slug: string) {
    return {
      adapter: this.adapter,
      folder: this.folder(kind, slug),
      kind,
      now: () => this.now.getTime(),
      ...(this.options.read?.retries === undefined
        ? {}
        : { retries: this.options.read.retries }),
      ...(this.options.read?.delayMs === undefined
        ? {}
        : { delayMs: this.options.read.delayMs }),
    } satisfies SessionOptions;
  }

  private async readIdentity(
    kind: DocumentKind,
    slug: string,
  ): Promise<Record<string, unknown>> {
    const identityPath = joinPath(this.folder(kind, slug), IDENTITY_FILE[kind]);
    if (!(await this.adapter.exists(identityPath)))
      throw new NotFoundError(
        `There is no ${kind} "${slug}" in this workspace.`,
      );
    return migrate(
      kind,
      await readJsonFile(this.adapter, identityPath, this.options.read),
    ).value;
  }

  private async load<T>(
    kind: DocumentKind,
    slug: string,
  ): Promise<{ identity: Record<string, unknown>; loaded: Loaded<T> }> {
    const identity = await this.readIdentity(kind, slug);
    const options = this.syncOptions(kind, slug);
    const { state, warnings } = await loadDocument(
      this.adapter,
      options.folder,
      kind,
      {
        ...(options.retries === undefined ? {} : { retries: options.retries }),
        ...(options.delayMs === undefined ? {} : { delayMs: options.delayMs }),
      },
    ).catch(newerAsStorageError);
    if (state.size === 0)
      throw new NotFoundError(
        `The ${kind} "${slug}" has no saved content yet.${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
      );
    const document = materialize(state);
    const issues =
      kind === 'tool'
        ? validateToolLibrary(document)
        : validateModelDocument(document);
    return {
      identity,
      loaded: {
        document: document as T,
        savedAt: state.maxT ? state.maxT.slice(0, state.maxT.indexOf('/')) : '',
        warnings,
        issues,
      },
    };
  }

  // --- tool libraries ----------------------------------------------------------------------

  async listTools(
    options: { includeTrashed?: boolean } = {},
  ): Promise<ToolEntry[]> {
    const entries: ToolEntry[] = [];
    for (const slug of await this.slugs('tool')) {
      try {
        const trash = await this.trashState('tool', slug);
        if (trash.trashed && !options.includeTrashed) continue;
        const { loaded } = await this.load<ToolLibrary>('tool', slug);
        const m = loaded.document.manifest;
        entries.push({
          slug,
          id: m.id,
          name: m.name,
          version: m.version,
          ...(options.includeTrashed ? this.trashFields(trash) : {}),
        });
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
    await writeNewDocument(
      this.adapter,
      folder,
      'tool',
      tool as unknown as Record<string, Json>,
      () => this.now.getTime(),
    );
    return slug;
  }

  loadTool(slug: string): Promise<Loaded<ToolLibrary>> {
    return this.load<ToolLibrary>('tool', slug).then((r) => r.loaded);
  }

  /** Writes a whole tool library as the changes from what the folder holds; see `openTool` for live editing. */
  async saveTool(slug: string, tool: ToolLibrary): Promise<void> {
    await this.readIdentity('tool', slug).catch(() => {
      throw new NotFoundError(
        `There is no tool "${slug}" in this workspace. Use createTool first.`,
      );
    });
    await replaceDocument(
      this.syncOptions('tool', slug),
      tool as unknown as Record<string, Json>,
    );
  }

  /**
   * Opens a tool library for editing: the store holds the merged content, and the session keeps it
   * in step with the other people working in the folder.
   */
  async openTool(
    slug: string,
    session: Partial<SessionOptions> = {},
  ): Promise<OpenedDocument<ToolStore>> {
    await this.readIdentity('tool', slug);
    const opened = await SyncSession.open(
      { ...this.syncOptions('tool', slug), ...session },
      (doc) => createToolStore(doc as unknown as ToolLibrary),
    ).catch(newerAsStorageError);
    return {
      ...opened,
      issues: validateToolLibrary(opened.store.state),
    };
  }

  /** The folder of the tool library with this id. */
  async findToolSlug(id: ToolId): Promise<string | null> {
    // A deleted tool library still serves the models made with it, until it is gone for good.
    for (const t of await this.listTools({ includeTrashed: true }))
      if (t.id === id) return t.slug;
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
        const trash = await this.trashState('model', slug);
        if (trash.trashed && !options.includeTrashed) continue;
        const { loaded } = await this.load<Model>('model', slug);
        const m = loaded.document.manifest;
        entries.push({
          slug,
          id: m.id,
          name: m.name,
          tool: m.tool,
          modelType: m.modelType,
          ...(m.folder === undefined ? {} : { folder: m.folder }),
          ...(options.includeTrashed ? this.trashFields(trash) : {}),
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
    kind: DocumentKind,
    slug: string,
    trashed: boolean,
  ): Promise<void> {
    const folder = this.folder(kind, slug);
    if (!(await this.adapter.exists(joinPath(folder, IDENTITY_FILE[kind]))))
      throw new NotFoundError(
        `There is no ${kind} "${slug}" in this workspace.`,
      );
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
   * instances decides. An item that has been in the trash for 30 days is no longer offered for
   * restoring (it is listed as expired).
   */
  trashModel(slug: string): Promise<void> {
    return this.writeTrashMarker('model', slug, true);
  }

  restoreModel(slug: string): Promise<void> {
    return this.writeTrashMarker('model', slug, false);
  }

  trashTool(slug: string): Promise<void> {
    return this.writeTrashMarker('tool', slug, true);
  }

  restoreTool(slug: string): Promise<void> {
    return this.writeTrashMarker('tool', slug, false);
  }

  private trashFields(t: { trashed: boolean; at?: string }): {
    trashed: boolean;
    trashedAt?: string;
    expired?: boolean;
  } {
    if (!t.trashed) return { trashed: false };
    const expired =
      t.at !== undefined &&
      this.now.getTime() - Date.parse(t.at) > TRASH_DAYS * 24 * 3600 * 1000;
    return { trashed: true, ...(t.at ? { trashedAt: t.at } : {}), expired };
  }

  private async trashState(
    kind: DocumentKind,
    slug: string,
  ): Promise<{ trashed: boolean; at?: string }> {
    const state = joinPath(this.folder(kind, slug), '_state');
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
            ? `The trash marker of instance ${entry.name} for ${kind} "${slug}" is from a newer version of MetaKit and was ignored.`
            : `The trash marker of instance ${entry.name} for ${kind} "${slug}" could not be read and was ignored: ${(error as Error).message}`;
        if (!this.warnings.includes(note)) this.warnings.push(note);
      }
    }
    return newest
      ? { trashed: newest.trashed, at: newest.at }
      : { trashed: false };
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
    await writeNewDocument(
      this.adapter,
      folder,
      'model',
      model as unknown as Record<string, Json>,
      () => this.now.getTime(),
    );
    return slug;
  }

  loadModel(slug: string): Promise<Loaded<Model>> {
    return this.load<Model>('model', slug).then((r) => r.loaded);
  }

  /** Writes a whole model as the changes from what the folder holds; see `openModel` for live editing. */
  async saveModel(slug: string, model: Model): Promise<void> {
    await this.readIdentity('model', slug).catch(() => {
      throw new NotFoundError(
        `There is no model "${slug}" in this workspace. Use createModel first.`,
      );
    });
    await replaceDocument(
      this.syncOptions('model', slug),
      model as unknown as Record<string, Json>,
    );
  }

  /**
   * Opens a model for editing with the tool library it was made with. Changes made in the store
   * are written to the folder within two seconds, and changes of other people arrive through
   * the session.
   */
  async openModel(
    slug: string,
    tool: ToolLibrary,
    session: Partial<SessionOptions> = {},
  ): Promise<OpenedDocument<ModelStore>> {
    await this.readIdentity('model', slug);
    const opened = await SyncSession.open(
      { ...this.syncOptions('model', slug), ...session },
      (doc) => createModelStore(doc as unknown as Model, { tool }),
    ).catch(newerAsStorageError);
    return { ...opened, issues: validateModelDocument(opened.store.state) };
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
