import {
  createEmptyModel,
  formatIssues,
  parseToolLibrary,
  createModelStore,
  type Model,
  type ModelStore,
  type ModelTypeDef,
  type ModelTypeId,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  NotFoundError,
  Workspace,
  type Loaded,
  type ModelEntry,
  type StorageAdapter,
  type ToolEntry,
} from '@metakit-app/storage';
import { normalizeFolder } from './explorer';

export interface OpenModel {
  slug: string;
  toolSlug: string;
  tool: ToolLibrary;
  store: ModelStore;
  /** Things to tell the user about this model, such as snapshots from other instances. */
  warnings: string[];
  /** Problems found in the model document itself. */
  documentIssues: number;
}

export type SaveStatus = 'saved' | 'saving' | 'error';

export interface AppState {
  /** `start` before a workspace is open, `workspace` with the explorer, `model` with a model open. */
  phase: 'start' | 'workspace' | 'model';
  workspaceName: string;
  tools: ToolEntry[];
  models: ModelEntry[];
  trashed: ModelEntry[];
  open: OpenModel | null;
  save: SaveStatus;
  /** The last problem, in plain English; cleared by the next successful action. */
  error: string | null;
  warnings: string[];
}

export interface ControllerOptions {
  /** How long after the last change the model is saved. */
  saveDelayMs?: number;
  now?: () => Date;
}

const initial = (): AppState => ({
  phase: 'start',
  workspaceName: '',
  tools: [],
  models: [],
  trashed: [],
  open: null,
  save: 'saved',
  error: null,
  warnings: [],
});

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * What Model mode keeps between screens: the open workspace, its tools and models, the open
 * model's store and saving. It has no UI code, so it is tested without a browser. Until change
 * files arrive (phase 3) a model is saved as one snapshot shortly after each change.
 */
export class AppController {
  private current: AppState = initial();
  private workspace: Workspace | null = null;
  private readonly listeners = new Set<(state: AppState) => void>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> = Promise.resolve();
  private stopStore: (() => void) | null = null;
  private readonly saveDelayMs: number;

  constructor(options: ControllerOptions = {}) {
    this.saveDelayMs = options.saveDelayMs ?? 500;
  }

  get state(): AppState {
    return this.current;
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<AppState>): void {
    this.current = { ...this.current, ...patch };
    for (const l of this.listeners) l(this.current);
  }

  /** Runs an action and turns a failure into the message the UI shows. */
  private async attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
    try {
      const result = await action();
      if (this.current.error) this.set({ error: null });
      return result;
    } catch (error) {
      this.set({ error: message(error) });
      return undefined;
    }
  }

  // Workspace ---------------------------------------------------------------------------------

  /**
   * Opens the workspace in a folder; with `create`, makes a new one there first. Returns
   * `not-a-workspace` when the folder has no workspace.json, so that the start page can offer to
   * make one, and `failed` (with the reason in `state.error`) for anything else.
   */
  async openWorkspace(
    adapter: StorageAdapter,
    options: { create?: { name: string } } = {},
  ): Promise<'opened' | 'not-a-workspace' | 'failed'> {
    try {
      await this.closeModel();
      const workspace = options.create
        ? await Workspace.create(adapter, options.create)
        : await Workspace.open(adapter);
      this.workspace = workspace;
      this.set({
        phase: 'workspace',
        workspaceName: workspace.info.name,
        open: null,
        error: null,
      });
      await this.refresh();
      return 'opened';
    } catch (error) {
      if (error instanceof NotFoundError && !options.create) {
        this.set({ error: null });
        return 'not-a-workspace';
      }
      this.set({ error: message(error) });
      return 'failed';
    }
  }

  /**
   * Adds a tool library from the text of its file. The file is checked first and a library that
   * is already in the workspace is not added twice. Returns the folder name it was given.
   */
  async addToolLibrary(text: string): Promise<string | undefined> {
    return this.attempt(async () => {
      const ws = this.need();
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error(
          'That file is not a tool library: it is not valid JSON.',
        );
      }
      const parsed = parseToolLibrary(value);
      if (!parsed.ok)
        throw new Error(
          `That file is not a valid tool library.\n${formatIssues(parsed.issues)}`,
        );
      const existing = await ws.findToolSlug(parsed.value.manifest.id);
      if (existing)
        throw new Error(
          `The tool library "${parsed.value.manifest.name}" is already in this workspace.`,
        );
      const slug = await ws.createTool(parsed.value);
      await this.refresh();
      return slug;
    });
  }

  /** The model types of a tool library of this workspace, for the new-model dialog. */
  async modelTypesOf(toolSlug: string): Promise<ModelTypeDef[]> {
    const { document } = await this.need().loadTool(toolSlug);
    return Object.values(document.modelTypes).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }

  async closeWorkspace(): Promise<void> {
    await this.closeModel();
    this.workspace = null;
    this.current = initial();
    for (const l of this.listeners) l(this.current);
  }

  /** Reads the lists of tool libraries and models again. */
  async refresh(): Promise<void> {
    const ws = this.need();
    await this.attempt(async () => {
      const [tools, all] = await Promise.all([
        ws.listTools(),
        ws.listModels({ includeTrashed: true }),
      ]);
      this.set({
        tools,
        models: all.filter((m) => !m.trashed),
        trashed: all.filter((m) => m.trashed),
        warnings: [...ws.warnings],
      });
    });
  }

  private need(): Workspace {
    if (!this.workspace) throw new Error('No workspace is open.');
    return this.workspace;
  }

  // Models ------------------------------------------------------------------------------------

  /** Creates an empty model of a model type, opens it, and returns its folder name. */
  async createModel(input: {
    toolSlug: string;
    modelType: ModelTypeId;
    name: string;
    folder?: string | null;
  }): Promise<string | undefined> {
    return this.attempt(async () => {
      const ws = this.need();
      const { document: tool } = await ws.loadTool(input.toolSlug);
      const folder = normalizeFolder(input.folder);
      const model = createEmptyModel(tool, input.modelType, {
        name: input.name,
        ...(folder ? { folder } : {}),
      });
      const slug = await ws.createModel(model);
      await this.refresh();
      await this.openModel(slug);
      return slug;
    });
  }

  async openModel(slug: string): Promise<boolean> {
    return (
      (await this.attempt(async () => {
        const ws = this.need();
        await this.closeModel();
        const loaded = await ws.loadModel(slug);
        const toolSlug = await ws.findToolSlug(loaded.document.manifest.tool);
        if (!toolSlug)
          throw new Error(
            `This model was made with a tool library that is not in this workspace (${loaded.document.manifest.tool}).`,
          );
        const tool = (await ws.loadTool(toolSlug)).document;
        const store = createModelStore(loaded.document, { tool });
        this.stopStore = store.subscribe(() => this.changed());
        this.set({
          phase: 'model',
          save: 'saved',
          open: {
            slug,
            toolSlug,
            tool,
            store,
            warnings: loaded.warnings,
            documentIssues: loaded.issues.length,
          },
        });
        return true;
      })) ?? false
    );
  }

  /** Saves what is pending and goes back to the explorer. */
  async closeModel(): Promise<void> {
    if (!this.current.open) return;
    await this.flush();
    this.stopStore?.();
    this.stopStore = null;
    this.set({ open: null, phase: this.workspace ? 'workspace' : 'start' });
    await this.refresh();
  }

  // Saving ------------------------------------------------------------------------------------

  private changed(): void {
    clearTimeout(this.saveTimer);
    this.set({ save: 'saving' });
    this.saveTimer = setTimeout(() => void this.flush(), this.saveDelayMs);
  }

  /** Saves the open model now; resolves when the write is done. */
  flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    const open = this.current.open;
    if (!open || this.current.save === 'saved') return this.saving;
    const document = open.store.state as Model;
    this.saving = this.saving.then(async () => {
      try {
        await this.need().saveModel(open.slug, document);
        // Another change may have come in while writing; it set `saving` again and has its own timer.
        if (open.store.state === document)
          this.set({ save: 'saved', error: null });
      } catch (error) {
        this.set({ save: 'error', error: `Saving failed: ${message(error)}` });
      }
    });
    return this.saving;
  }

  // Reading across models ---------------------------------------------------------------------

  /**
   * Every model of the workspace with its tool library, for the reference picker and find across
   * models. The open model is read from its live store, so unsaved edits count.
   */
  async readAllModels(): Promise<
    { entry: ModelEntry; model: Model; tool: ToolLibrary }[]
  > {
    const ws = this.need();
    const tools = new Map<string, ToolLibrary>();
    const result: { entry: ModelEntry; model: Model; tool: ToolLibrary }[] = [];
    for (const entry of this.current.models) {
      try {
        const open = this.current.open;
        if (open && open.slug === entry.slug) {
          result.push({
            entry,
            model: open.store.state as Model,
            tool: open.tool,
          });
          continue;
        }
        const toolSlug = await ws.findToolSlug(entry.tool);
        if (!toolSlug) continue;
        let tool = tools.get(toolSlug);
        if (!tool) {
          tool = (await ws.loadTool(toolSlug)).document;
          tools.set(toolSlug, tool);
        }
        result.push({
          entry,
          model: (await ws.loadModel(entry.slug)).document,
          tool,
        });
      } catch {
        // A model that cannot be read is left out of searches; opening it shows the reason.
      }
    }
    return result;
  }

  // Organising --------------------------------------------------------------------------------

  /** Runs a manifest change on a model: the open one through its store, others by loading and saving. */
  private async updateManifest(
    slug: string,
    command: { name?: string; folder?: string | null },
  ): Promise<void> {
    const open = this.current.open;
    if (open && open.slug === slug) {
      const result = open.store.execute({ type: 'updateManifest', ...command });
      if (!result.ok) throw new Error(result.reason);
      await this.flush();
    } else {
      const ws = this.need();
      const loaded: Loaded<Model> = await ws.loadModel(slug);
      const store = createModelStore(loaded.document);
      store.execute({ type: 'updateManifest', ...command });
      await ws.saveModel(slug, store.state as Model);
    }
    await this.refresh();
  }

  renameModel(slug: string, name: string): Promise<void | undefined> {
    return this.attempt(() => this.updateManifest(slug, { name }));
  }

  /** Moves a model to a folder of the explorer; an empty path means the top level. */
  moveModel(slug: string, folder: string | null): Promise<void | undefined> {
    return this.attempt(() =>
      this.updateManifest(slug, { folder: normalizeFolder(folder) }),
    );
  }

  /** Marks the model as deleted; it stays in the workspace and can be restored. */
  trashModel(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      if (this.current.open?.slug === slug) await this.closeModel();
      await this.need().trashModel(slug);
      await this.refresh();
    });
  }

  restoreModel(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      await this.need().restoreModel(slug);
      await this.refresh();
    });
  }
}
