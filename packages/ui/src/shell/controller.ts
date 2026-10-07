import {
  CommandError,
  createEmptyModel,
  createEmptyTool,
  createModelStore,
  formatIssues,
  parseToolLibrary,
  validateToolLibrary,
  type ElementId,
  type Issue,
  type Model,
  type ModelStore,
  type ModelTypeDef,
  type ModelTypeId,
  type ToolCommandOrBatch,
  type ToolLibrary,
  type ToolStore,
} from '@metakit-app/core';
import {
  migrate,
  NewerFormatError,
  NotFoundError,
  Workspace,
  type HealthFinding,
  type ModelEntry,
  type StorageAdapter,
  type ToolEntry,
} from '@metakit-app/storage';
import {
  detectDivergence,
  PresenceService,
  whoIsEditing,
  type Clash,
  type Divergence,
  type PresenceFile,
  type PresenceProfile,
  type SyncSession,
  type SyncStatus,
  type Timers,
} from '@metakit-app/sync';
import {
  createBehaviour,
  type Behaviour,
  type BehaviourHost,
} from '@metakit-app/behaviour';
import { describeClash, type ClashNotice } from './clash';
import { normalizeFolder } from './explorer';

export interface OpenModel {
  slug: string;
  toolSlug: string;
  /** The tool library as it is now: it follows edits made in Build mode by anyone in the folder. */
  tool: ToolLibrary;
  /** The tool library's own store and session, so that the model follows changes to its tool. */
  toolStore: ToolStore;
  toolSession: SyncSession;
  store: ModelStore;
  /** Formulas, events, rules and scripts of this model (phase 5 and 7). */
  behaviour: Behaviour;
  /** Keeps the store and the folder in step: writes edits, reads other people's. */
  session: SyncSession;
  /** Things to tell the user about this model, such as a file that could not be read. */
  warnings: string[];
  /** Problems found in the model document itself. */
  documentIssues: number;
}

/** A tool library open in Build mode. */
export interface OpenTool {
  slug: string;
  store: ToolStore;
  session: SyncSession;
  warnings: string[];
  /** Counts changes, so that views that read `store.state` know to read it again. */
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
  /** Problems the tool library has now, for example a class that extends itself. */
  issues: Issue[];
}

/** What running a Build mode command gave: its value, or the reason it was refused. */
export type CommandResult =
  { ok: true; value: unknown } | { ok: false; error: string };

/** A message from a rule or script, shown until dismissed or for a few seconds. */
export interface BehaviourMessage {
  id: number;
  kind: 'info' | 'warning' | 'error';
  text: string;
}

export type SaveStatus = 'saved' | 'saving' | 'error';

export interface AppState {
  /** `start` before a workspace is open, `workspace` with the explorer, `model` with a model open. */
  phase: 'start' | 'workspace' | 'model' | 'build';
  workspaceName: string;
  tools: ToolEntry[];
  models: ModelEntry[];
  /** Deleted less than 30 days ago, so that they can be restored. */
  trashed: ModelEntry[];
  trashedTools: ToolEntry[];
  open: OpenModel | null;
  /** Messages from rules and scripts of the open model. */
  messages: BehaviourMessage[];
  /** The tool library being edited in Build mode. */
  build: OpenTool | null;
  save: SaveStatus;
  /** What the open document knows about syncing: unwritten edits, the last change from someone else, errors. */
  sync: SyncStatus;
  /** Other people seen in the workspace in the last 30 seconds. */
  people: PresenceFile[];
  /** This instance: its id, and the name and colour it shows. */
  me: { instance: string; name: string; colour: string };
  /** Clashes that were resolved in favour of someone else, until dismissed. */
  notices: ClashNotice[];
  divergence: Divergence[];
  /** What the check of the folder found. */
  health: HealthFinding[];
  /** The last problem, in plain English; cleared by the next successful action. */
  error: string | null;
  warnings: string[];
}

export interface ControllerOptions {
  /** Longest delay between an edit and its change file. */
  flushMs?: number;
  snapshotMs?: number;
  presenceMs?: number;
  /** Name and colour shown to others; can be changed later with `setProfile`. */
  profile?: PresenceProfile;
  /** Native dialogs for rules and scripts; the app uses the browser's, tests pass their own. */
  dialogs?: {
    confirm(text: string): boolean;
    choose(text: string, options: readonly string[]): string | null;
  };
  /** Leave presence out (for tests that do not need it). */
  presence?: boolean;
  /** Look at the folder for sync problems after opening a workspace. */
  health?: boolean;
  timers?: Timers;
  now?: () => number;
}

/**
 * What the model view asks of the controller. A narrow interface rather than the class, so that
 * the view does not depend on how the controller is built (and compiles against a copy of it).
 */
export interface ControllerPort {
  setSelection(ids: Iterable<string>): void;
  setEditing(item: string | null): void;
  dismissMessage(id: number): void;
  pushMessage?(kind: 'info' | 'warning' | 'error', text: string): void;
  editorsOf(item: string): PresenceFile[];
  dismissNotice(id: number): void;
}

/** What the Build mode view asks of the controller. */
export interface BuildPort {
  runBuild(command: ToolCommandOrBatch): CommandResult;
  undoBuild(): boolean;
  redoBuild(): boolean;
  closeBuild(): Promise<void>;
}

const NO_SYNC: SyncStatus = {
  pending: 0,
  lastFlushAt: null,
  lastRemote: null,
  error: null,
};

const initial = (): AppState => ({
  phase: 'start',
  workspaceName: '',
  tools: [],
  models: [],
  trashed: [],
  trashedTools: [],
  open: null,
  messages: [],
  build: null,
  save: 'saved',
  sync: NO_SYNC,
  people: [],
  me: { instance: '', name: '', colour: '#364fc7' },
  notices: [],
  divergence: [],
  health: [],
  error: null,
  warnings: [],
});

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const saveOf = (s: SyncStatus): SaveStatus =>
  s.error ? 'error' : s.pending > 0 ? 'saving' : 'saved';

/**
 * What Model mode keeps between screens: the open workspace, its tool libraries and models, the
 * open model with its sync session, and who else is around. It has no UI code, so it is tested
 * without a browser.
 */
export class AppController {
  private current: AppState = initial();
  private workspace: Workspace | null = null;
  private presence: PresenceService | null = null;
  private readonly listeners = new Set<(state: AppState) => void>();
  private nextNotice = 1;
  private nextMessage = 1;
  private profile: PresenceProfile;

  constructor(private readonly options: ControllerOptions = {}) {
    this.profile = {
      ...(options.profile ?? { name: 'Someone', colour: '#364fc7' }),
    };
    this.current = { ...this.current, me: { instance: '', ...this.profile } };
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
      await this.closeBuild();
      const workspace = options.create
        ? await Workspace.create(adapter, options.create)
        : await Workspace.open(adapter);
      this.workspace = workspace;
      this.set({
        phase: 'workspace',
        workspaceName: workspace.info.name,
        open: null,
        error: null,
        me: { instance: adapter.instanceId, ...this.profile },
      });
      if (this.options.presence !== false) {
        this.presence = new PresenceService({
          adapter,
          profile: this.profile,
          ...(this.options.now ? { now: this.options.now } : {}),
          ...(this.options.timers ? { timers: this.options.timers } : {}),
          ...(this.options.presenceMs
            ? { intervalMs: this.options.presenceMs }
            : {}),
          onPeople: (people) => this.peopleChanged(people),
        });
        this.presence.start();
      }
      await this.refresh();
      if (this.options.health !== false)
        void workspace
          .checkHealth()
          .then((health) => this.set({ health }))
          .catch(() => undefined);
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

  async closeWorkspace(): Promise<void> {
    await this.closeModel();
    await this.closeBuild();
    await this.presence?.stop();
    this.presence = null;
    this.workspace = null;
    this.current = { ...initial(), me: { instance: '', ...this.profile } };
    for (const l of this.listeners) l(this.current);
  }

  /** Reads the lists of tool libraries and models again. */
  async refresh(): Promise<void> {
    const ws = this.need();
    await this.attempt(async () => {
      const [allTools, allModels] = await Promise.all([
        ws.listTools({ includeTrashed: true }),
        ws.listModels({ includeTrashed: true }),
      ]);
      this.set({
        tools: allTools.filter((t) => !t.trashed),
        trashedTools: allTools.filter((t) => t.trashed && !t.expired),
        models: allModels.filter((m) => !m.trashed),
        trashed: allModels.filter((m) => m.trashed && !m.expired),
        warnings: [
          ...new Set([
            ...this.current.warnings.filter((w) => w.startsWith('sync:')),
            ...ws.warnings,
          ]),
        ],
      });
    });
  }

  private need(): Workspace {
    if (!this.workspace) throw new Error('No workspace is open.');
    return this.workspace;
  }

  /** The name and colour shown to others; kept by the app in the browser. */
  setProfile(profile: PresenceProfile): void {
    this.profile = { ...profile };
    this.presence?.setProfile(this.profile);
    this.set({ me: { ...this.current.me, ...profile } });
  }

  // People ------------------------------------------------------------------------------------

  private peopleChanged(people: PresenceFile[]): void {
    const open = this.current.open;
    const mine: PresenceFile[] = open
      ? [
          {
            formatVersion: 1,
            instance: this.current.me.instance,
            name: this.profile.name,
            colour: this.profile.colour,
            at: new Date().toISOString(),
            document: { kind: 'model', slug: open.slug },
            selection: [],
            editing: null,
            hash: open.session.hash,
            seen: open.session.seen(),
          },
        ]
      : [];
    this.set({ people, divergence: detectDivergence([...people, ...mine]) });
  }

  /** Writes this instance's presence now and reads everyone else's. */
  async refreshPeople(): Promise<void> {
    await this.presence?.refresh();
  }

  /** Tells others which elements are selected here. */
  setSelection(ids: Iterable<string>): void {
    this.presence?.setSelection(ids);
  }

  /** Tells others that an item is open in an editor here, or null when it is closed. */
  setEditing(item: string | null): void {
    this.presence?.setEditing(item);
  }

  /** Other people who have this item open in an editor in the open model. */
  editorsOf(item: string): PresenceFile[] {
    const open = this.current.open;
    if (!open) return [];
    return whoIsEditing(
      this.current.people,
      { kind: 'model', slug: open.slug },
      item,
      this.current.me.instance,
    );
  }

  dismissNotice(id: number): void {
    this.set({ notices: this.current.notices.filter((n) => n.id !== id) });
  }

  private nameOf(instance: string): string {
    return (
      this.current.people.find((p) => p.instance === instance)?.name ??
      'Someone else'
    );
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
        await this.closeBuild();
        const header = await ws.loadModel(slug);
        const toolSlug = await ws.findToolSlug(header.document.manifest.tool);
        if (!toolSlug)
          throw new Error(
            `This model was made with a tool library that is not in this workspace (${header.document.manifest.tool}).`,
          );
        const toolOpened = await ws.openTool(toolSlug, this.sessionOptions());
        const tool = toolOpened.store.state;
        const opened = await ws
          .openModel(slug, tool, {
            ...(this.options.flushMs ? { flushMs: this.options.flushMs } : {}),
            ...(this.options.snapshotMs
              ? { snapshotMs: this.options.snapshotMs }
              : {}),
            ...(this.options.timers ? { timers: this.options.timers } : {}),
            onStatus: (sync) => this.set({ sync, save: saveOf(sync) }),
            onClash: (clash) => this.clashed(clash),
            onWarning: (w) =>
              this.set({
                warnings: [
                  ...new Set([...this.current.warnings, `sync: ${w}`]),
                ],
              }),
          })
          .catch(async (error: unknown) => {
            await toolOpened.session.close();
            throw error;
          });
        const behaviour = createBehaviour({
          store: opened.store,
          tool: () => this.current.open?.tool ?? tool,
          host: this.behaviourHost(() => this.current.open?.behaviour),
        });
        opened.session.start();
        toolOpened.session.start();
        toolOpened.store.subscribe(() => this.toolChanged());
        this.set({
          phase: 'model',
          save: 'saved',
          sync: NO_SYNC,
          notices: [],
          open: {
            slug,
            toolSlug,
            tool,
            toolStore: toolOpened.store,
            toolSession: toolOpened.session,
            store: opened.store,
            behaviour,
            session: opened.session,
            warnings: opened.warnings,
            documentIssues: opened.issues.length,
          },
        });
        this.presence?.setDocument({ kind: 'model', slug }, () => ({
          hash: opened.session.hash,
          seen: opened.session.seen(),
        }));
        return true;
      })) ?? false
    );
  }

  /** Session settings shared by every document the controller opens. */
  private sessionOptions() {
    return {
      ...(this.options.flushMs ? { flushMs: this.options.flushMs } : {}),
      ...(this.options.snapshotMs
        ? { snapshotMs: this.options.snapshotMs }
        : {}),
      ...(this.options.timers ? { timers: this.options.timers } : {}),
    };
  }

  /** The open model's tool library changed (here or in another window): redraw with the new one. */
  private toolChanged(): void {
    const open = this.current.open;
    if (!open) return;
    const tool = open.toolStore.state;
    if (tool === open.tool) return;
    // Commands on the model are checked against the new tool library from now on.
    open.store.updateContext({ tool });
    open.behaviour.setTool(tool);
    this.set({ open: { ...open, tool } });
  }

  /** What rules and scripts may ask of the app: messages, questions, other models, commands. */
  private behaviourHost(behaviour: () => Behaviour | undefined): BehaviourHost {
    const native = this.options.dialogs ?? {
      confirm: (text: string) =>
        typeof globalThis.confirm === 'function'
          ? globalThis.confirm(text)
          : false,
      choose: (text: string, options: readonly string[]) => {
        if (typeof globalThis.prompt !== 'function') return null;
        const answer = globalThis.prompt(
          `${text}\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
        );
        const n = Number(answer);
        return Number.isInteger(n) && n >= 1 && n <= options.length
          ? options[n - 1]!
          : (options.find((o) => o === answer) ?? null);
      },
    };
    return {
      message: (kind, text) => this.pushMessage(kind, text),
      confirm: (text) => native.confirm(text),
      choose: (text, options) => native.choose(text, options),
      openModel: (name) => void this.openModelByName(name),
      runCommand: (command, target) =>
        behaviour()?.commands.get(command)?.run(target),
      runScript: () =>
        this.pushMessage(
          'info',
          'Scripts are not available in this version yet.',
        ),
    };
  }

  pushMessage(kind: BehaviourMessage['kind'], text: string): void {
    const message = { id: this.nextMessage++, kind, text };
    this.set({ messages: [...this.current.messages, message].slice(-5) });
  }

  dismissMessage(id: number): void {
    this.set({ messages: this.current.messages.filter((m) => m.id !== id) });
  }

  /** Opens a model by its name or folder name, for rules and scripts. */
  async openModelByName(name: string): Promise<boolean> {
    const entry = this.current.models.find(
      (m) => m.slug === name || m.name === name,
    );
    return entry
      ? this.openModel(entry.slug)
      : (this.pushMessage('warning', `There is no model called "${name}".`),
        false);
  }

  private clashed(clash: Clash): void {
    const open = this.current.open;
    if (!open) return;
    const text = describeClash(
      open.tool,
      open.store.state as Model,
      clash,
      this.nameOf(clash.by),
    );
    this.set({
      notices: [...this.current.notices, { id: this.nextNotice++, text }].slice(
        -5,
      ),
    });
  }

  /** Writes what is pending, folds it into the snapshot, and goes back to the explorer. */
  async closeModel(): Promise<void> {
    const open = this.current.open;
    if (!open) return;
    this.presence?.setDocument(null);
    try {
      open.behaviour.dispose();
      await open.session.close();
      await open.toolSession.close();
    } finally {
      this.set({
        open: null,
        messages: [],
        phase: this.workspace ? 'workspace' : 'start',
        sync: NO_SYNC,
        save: 'saved',
        notices: [],
      });
    }
    await this.refresh();
  }

  /** Writes the open model's pending changes now; resolves when they are in the folder. */
  async flush(): Promise<void> {
    await this.current.open?.session.flush();
  }

  // Reading across models ---------------------------------------------------------------------

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
      let upgraded: unknown = value;
      try {
        // A file from an earlier release is brought up to the current format in memory.
        upgraded = migrate('tool-document', value).value;
      } catch (error) {
        // A file from a newer release is refused; anything else is reported by the checks below.
        if (error instanceof NewerFormatError)
          throw new Error(`That file cannot be read: ${error.message}`, {
            cause: error,
          });
      }
      const parsed = parseToolLibrary(upgraded);
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
      await open.session.flush();
    } else {
      const ws = this.need();
      const loaded = await ws.loadModel(slug);
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

  /** Marks the model as deleted; it stays in the workspace for 30 days and can be restored. */
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

  trashTool(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      await this.need().trashTool(slug);
      await this.refresh();
    });
  }

  restoreTool(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      await this.need().restoreTool(slug);
      await this.refresh();
    });
  }

  // Build mode --------------------------------------------------------------------------------

  /** Makes an empty tool library in the workspace and returns its folder name. */
  createToolLibrary(
    name: string,
    languages?: string[],
  ): Promise<string | undefined> {
    return this.attempt(async () => {
      const trimmed = name.trim();
      if (trimmed === '') throw new Error('Give the tool library a name.');
      const slug = await this.need().createTool(
        createEmptyTool({ name: trimmed, ...(languages ? { languages } : {}) }),
      );
      await this.refresh();
      return slug;
    });
  }

  /** Opens a tool library for editing; its changes are written as they are made. */
  async openBuild(slug: string): Promise<boolean> {
    return (
      (await this.attempt(async () => {
        const ws = this.need();
        await this.closeModel();
        await this.closeBuild();
        const opened = await ws.openTool(slug, {
          ...this.sessionOptions(),
          onStatus: (sync) => this.set({ sync, save: saveOf(sync) }),
          onWarning: (w) =>
            this.set({
              warnings: [...new Set([...this.current.warnings, `sync: ${w}`])],
            }),
        });
        opened.session.start();
        opened.store.subscribe(() => this.buildChanged());
        this.set({
          phase: 'build',
          save: 'saved',
          sync: NO_SYNC,
          build: {
            slug,
            store: opened.store,
            session: opened.session,
            warnings: opened.warnings,
            revision: 0,
            canUndo: false,
            canRedo: false,
            issues: opened.issues,
          },
        });
        return true;
      })) ?? false
    );
  }

  private buildChanged(): void {
    const build = this.current.build;
    if (!build) return;
    this.set({
      build: {
        ...build,
        revision: build.revision + 1,
        canUndo: build.store.canUndo(),
        canRedo: build.store.canRedo(),
        issues: validateToolLibrary(build.store.state),
      },
    });
  }

  /** Writes pending changes, folds them into the snapshot and goes back to the explorer. */
  async closeBuild(): Promise<void> {
    const build = this.current.build;
    if (!build) return;
    try {
      await build.session.close();
    } finally {
      this.set({
        build: null,
        phase: this.workspace ? 'workspace' : 'start',
        sync: NO_SYNC,
        save: 'saved',
      });
    }
    await this.refresh();
  }

  /**
   * Runs a command on the tool library being edited. A refused command (a key that is taken, a
   * class that is still in use) comes back as a message, and nothing has changed.
   */
  runBuild(command: ToolCommandOrBatch): CommandResult {
    const build = this.current.build;
    if (!build) return { ok: false, error: 'No tool library is open.' };
    try {
      const result = build.store.execute(command);
      if (!result.ok)
        return {
          ok: false,
          error: result.reason ?? 'The change was cancelled.',
        };
      return { ok: true, value: result.value };
    } catch (error) {
      if (error instanceof CommandError)
        return { ok: false, error: error.message };
      throw error;
    }
  }

  undoBuild(): boolean {
    return this.current.build?.store.undo() ?? false;
  }

  redoBuild(): boolean {
    return this.current.build?.store.redo() ?? false;
  }

  /** Writes the open tool library's pending changes now. */
  async flushBuild(): Promise<void> {
    await this.current.build?.session.flush();
  }
}

export type { ElementId };
