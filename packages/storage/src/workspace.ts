import {
  createModelStore,
  createKitStore,
  validateModelDocument,
  validateKit,
  type Issue,
  type Json,
  type Model,
  type ModelId,
  type ModelStore,
  type ModelTypeId,
  type KitId,
  type Kit,
  type KitOrigin,
  type KitStore,
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
import {
  KIT_FOLDER,
  KIT_IDENTITY_FILE,
  KIT_KIND,
  OLDER_KIT_FOLDER,
  OLDER_KIT_IDENTITY_FILE,
} from './names';
import { joinPath } from './paths';
import { slugify } from './slugify';

export type DocumentKind = typeof KIT_KIND | 'model';

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

export interface KitEntry {
  slug: string;
  id: KitId;
  name: string;
  version: string;
  /** The Kit this one was copied from (ADR 0010). */
  basedOn?: KitOrigin;
  trashed?: boolean;
  trashedAt?: string;
  expired?: boolean;
}

/** How long a deleted model or Kit can be restored. */
export const TRASH_DAYS = 30;

export interface ModelEntry {
  slug: string;
  id: ModelId;
  name: string;
  kit: KitId;
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

/** Where new documents of each kind are made. A Kit made before the Kit rename stays in `tools/`. */
const FOLDERS: Record<DocumentKind, string> = {
  [KIT_KIND]: KIT_FOLDER,
  model: 'models',
};
const MODEL_IDENTITY_FILE = 'model.json';

/** The identity file of a document folder: `tool.json` in a Kit folder under `tools/` (ADR 0011). */
function identityFile(kind: DocumentKind, folder: string): string {
  if (kind === 'model') return MODEL_IDENTITY_FILE;
  return folder.startsWith(`${OLDER_KIT_FOLDER}/`)
    ? OLDER_KIT_IDENTITY_FILE
    : KIT_IDENTITY_FILE;
}
/** How messages name each kind. */
const KIND_WORDS: Record<DocumentKind, string> = {
  [KIT_KIND]: 'Kit',
  model: 'model',
};

export { slugify };

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
 * A workspace folder: Kits and models, each in its own folder that never changes name.
 *
 * Each document is saved as change files and snapshots of the instances that edit it, under
 * `<folder>/_state/<instance>/`. The identity files (`kit.json`, `model.json`) are written once.
 *
 * New Kits are made in `kits/<slug>/`. A Kit made by a release before the Kit rename lives in
 * `tools/<slug>/` with a `tool.json`, and is read and edited where it is: moving it would mean
 * moving files that other instances wrote (rule 6, ADR 0011). Slugs are unique over both folders.
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

  /** Where a new document of this kind and slug goes. */
  private newFolder(kind: DocumentKind, slug: string): string {
    if (!SLUG.test(slug))
      throw new FormatError(
        `"${slug}" is not a valid folder name for a ${KIND_WORDS[kind]}.`,
      );
    return joinPath(FOLDERS[kind], slug);
  }

  /** Slug to folder of every Kit, in `kits/` and `tools/`; read again when a slug is not in it. */
  private kitFolders: Map<string, string> | null = null;

  /**
   * Finds the Kit folders. A name in `kits/` is its slug. A name in `tools/` is too, unless `kits/`
   * has the same name (a release before the rename does not look in `kits/`); then it gets the
   * suffix `-tools`, so that every slug names one folder.
   */
  private async scanKitFolders(): Promise<Map<string, string>> {
    const names = async (folder: string) =>
      (await this.adapter.list(folder))
        .filter((e) => e.kind === 'directory' && SLUG.test(e.name))
        .map((e) => e.name)
        .sort();
    const map = new Map<string, string>();
    for (const name of await names(KIT_FOLDER))
      map.set(name, joinPath(KIT_FOLDER, name));
    for (const name of await names(OLDER_KIT_FOLDER)) {
      let slug = name;
      for (let i = 1; map.has(slug); i++)
        slug = i === 1 ? `${name}-tools` : `${name}-tools-${i}`;
      map.set(slug, joinPath(OLDER_KIT_FOLDER, name));
    }
    this.kitFolders = map;
    return map;
  }

  /** The folder of a document, wherever it lives; for a Kit that is not there, where it would be made. */
  private async folder(kind: DocumentKind, slug: string): Promise<string> {
    if (kind === KIT_KIND) {
      const known =
        this.kitFolders?.get(slug) ?? (await this.scanKitFolders()).get(slug);
      if (known !== undefined) return known;
    }
    return this.newFolder(kind, slug);
  }

  /** The folder of a Kit in the workspace, such as `kits/process` or `tools/bpmn-lite`. */
  kitFolder(slug: string): Promise<string> {
    return this.folder(KIT_KIND, slug);
  }

  /** Every Kit folder with its slug, readable or not, in `kits/` and then `tools/`. */
  async listKitFolders(): Promise<{ slug: string; folder: string }[]> {
    return [...(await this.scanKitFolders())].map(([slug, folder]) => ({
      slug,
      folder,
    }));
  }

  private async slugs(kind: DocumentKind): Promise<string[]> {
    if (kind === KIT_KIND) return [...(await this.scanKitFolders()).keys()];
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

  private async syncOptions(kind: DocumentKind, slug: string) {
    return {
      adapter: this.adapter,
      folder: await this.folder(kind, slug),
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
    const folder = await this.folder(kind, slug);
    const identityPath = joinPath(folder, identityFile(kind, folder));
    if (!(await this.adapter.exists(identityPath)))
      throw new NotFoundError(
        `There is no ${KIND_WORDS[kind]} "${slug}" in this workspace.`,
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
    const options = await this.syncOptions(kind, slug);
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
        `The ${KIND_WORDS[kind]} "${slug}" has no saved content yet.${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
      );
    // Documents from earlier formats are brought up to date in memory; saving writes the new one.
    const stored = materialize(state);
    const document = migrate(
      kind === KIT_KIND ? 'kit-document' : 'model-document',
      stored,
    ).value;
    const issues =
      kind === KIT_KIND
        ? validateKit(document)
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

  // --- Kits ----------------------------------------------------------------------

  async listKits(
    options: { includeTrashed?: boolean } = {},
  ): Promise<KitEntry[]> {
    const entries: KitEntry[] = [];
    for (const slug of await this.slugs(KIT_KIND)) {
      try {
        const trash = await this.trashState(KIT_KIND, slug);
        if (trash.trashed && !options.includeTrashed) continue;
        const { loaded } = await this.load<Kit>(KIT_KIND, slug);
        const m = loaded.document.manifest;
        entries.push({
          slug,
          id: m.id,
          name: m.name,
          version: m.version,
          ...(m.basedOn ? { basedOn: m.basedOn } : {}),
          ...(options.includeTrashed ? this.trashFields(trash) : {}),
        });
      } catch {
        // A folder that is not a readable Kit is not listed; opening it by name explains why.
      }
    }
    return entries;
  }

  /** Adds a Kit in `kits/` and returns its folder name. Pass a `slug` to choose it. */
  async createKit(kit: Kit, options: { slug?: string } = {}): Promise<string> {
    const slug =
      options.slug ??
      (await this.uniqueSlug(KIT_KIND, kit.manifest.name, false));
    const folder = this.newFolder(KIT_KIND, slug);
    if ((await this.scanKitFolders()).has(slug))
      throw new AlreadyExistsError(
        `There is already a Kit "${slug}" in this workspace.`,
      );
    await this.adapter.writeNew(
      joinPath(folder, KIT_IDENTITY_FILE),
      jsonBytes({
        formatVersion: CURRENT_FORMAT[KIT_KIND],
        kind: KIT_KIND,
        id: kit.manifest.id,
        name: kit.manifest.name,
        created: this.now.toISOString(),
      }),
    );
    await writeNewDocument(
      this.adapter,
      folder,
      KIT_KIND,
      kit as unknown as Record<string, Json>,
      () => this.now.getTime(),
    );
    this.kitFolders?.set(slug, folder);
    return slug;
  }

  loadKit(slug: string): Promise<Loaded<Kit>> {
    return this.load<Kit>(KIT_KIND, slug).then((r) => r.loaded);
  }

  /** Writes a whole Kit as the changes from what the folder holds; see `openKit` for live editing. */
  async saveKit(slug: string, kit: Kit): Promise<void> {
    await this.readIdentity(KIT_KIND, slug).catch(() => {
      throw new NotFoundError(
        `There is no Kit "${slug}" in this workspace. Use createKit first.`,
      );
    });
    await replaceDocument(
      await this.syncOptions(KIT_KIND, slug),
      kit as unknown as Record<string, Json>,
    );
  }

  /**
   * Opens a Kit for editing: the store holds the merged content, and the session keeps it
   * in step with the other people working in the folder.
   */
  async openKit(
    slug: string,
    session: Partial<SessionOptions> = {},
  ): Promise<OpenedDocument<KitStore>> {
    await this.readIdentity(KIT_KIND, slug);
    const opened = await SyncSession.open(
      { ...(await this.syncOptions(KIT_KIND, slug)), ...session },
      (doc) => createKitStore(doc as unknown as Kit),
    ).catch(newerAsStorageError);
    return {
      ...opened,
      issues: validateKit(opened.store.state),
    };
  }

  /** The folder of the Kit with this id. */
  async findKitSlug(id: KitId): Promise<string | null> {
    // A deleted Kit still serves the models made with it, until it is gone for good.
    for (const t of await this.listKits({ includeTrashed: true }))
      if (t.id === id) return t.slug;
    return null;
  }

  async addKitAsset(
    slug: string,
    fileName: string,
    bytes: Uint8Array,
  ): Promise<string> {
    return addAsset(
      this.adapter,
      joinPath(await this.folder(KIT_KIND, slug), 'assets'),
      fileName,
      bytes,
    );
  }

  async readKitAsset(slug: string, name: string): Promise<Uint8Array> {
    return readAsset(
      this.adapter,
      joinPath(await this.folder(KIT_KIND, slug), 'assets'),
      name,
    );
  }

  /** The file names of the assets of a Kit; none when it has no `assets` folder. */
  async listKitAssets(slug: string): Promise<string[]> {
    const folder = joinPath(await this.folder(KIT_KIND, slug), 'assets');
    return (await this.adapter.list(folder))
      .filter((e) => e.kind === 'file')
      .map((e) => e.name);
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
          kit: m.kit,
          modelType: m.modelType,
          ...(m.folder === undefined ? {} : { folder: m.folder }),
          ...(options.includeTrashed ? this.trashFields(trash) : {}),
        });
      } catch {
        // See listKits.
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
    const folder = await this.folder(kind, slug);
    if (
      !(await this.adapter.exists(joinPath(folder, identityFile(kind, folder))))
    )
      throw new NotFoundError(
        `There is no ${KIND_WORDS[kind]} "${slug}" in this workspace.`,
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

  trashKit(slug: string): Promise<void> {
    return this.writeTrashMarker(KIT_KIND, slug, true);
  }

  restoreKit(slug: string): Promise<void> {
    return this.writeTrashMarker(KIT_KIND, slug, false);
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
    const state = joinPath(await this.folder(kind, slug), '_state');
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
            ? `The trash marker of instance ${entry.name} for ${KIND_WORDS[kind]} "${slug}" is from a newer version of MetaKit and was ignored.`
            : `The trash marker of instance ${entry.name} for ${KIND_WORDS[kind]} "${slug}" could not be read and was ignored: ${(error as Error).message}`;
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
    const folder = this.newFolder('model', slug);
    await this.adapter.writeNew(
      joinPath(folder, MODEL_IDENTITY_FILE),
      jsonBytes({
        formatVersion: CURRENT_FORMAT.model,
        kind: 'model',
        id: model.manifest.id,
        kit: model.manifest.kit,
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
      await this.syncOptions('model', slug),
      model as unknown as Record<string, Json>,
    );
  }

  /**
   * Opens a model for editing with the Kit it was made with. Changes made in the store
   * are written to the folder within two seconds, and changes of other people arrive through
   * the session.
   */
  async openModel(
    slug: string,
    kit: Kit,
    session: Partial<SessionOptions> = {},
  ): Promise<OpenedDocument<ModelStore>> {
    await this.readIdentity('model', slug);
    const opened = await SyncSession.open(
      { ...(await this.syncOptions('model', slug)), ...session },
      (doc) => createModelStore(doc as unknown as Model, { kit }),
    ).catch(newerAsStorageError);
    return { ...opened, issues: validateModelDocument(opened.store.state) };
  }

  /** The model as an editable `.mkmodel.json` text, using the Kit it was made with. */
  async exportModel(slug: string): Promise<string> {
    const { document: model } = await this.loadModel(slug);
    const kitSlug = await this.findKitSlug(model.manifest.kit);
    if (!kitSlug)
      throw new NotFoundError(
        `The Kit ${model.manifest.kit} that this model was made with is not in this workspace.`,
      );
    return exportMkModel((await this.loadKit(kitSlug)).document, model);
  }

  /** Creates a model from an editable model file and returns its folder name. */
  async importModel(
    text: string,
    options: { kitSlug: string; slug?: string },
  ): Promise<string> {
    const kit = (await this.loadKit(options.kitSlug)).document;
    const model = importMkModel(kit, text);
    return this.createModel(model, options.slug ? { slug: options.slug } : {});
  }
}
