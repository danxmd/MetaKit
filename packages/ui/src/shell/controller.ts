import {
  CommandError,
  createEmptyModel,
  cloneToolLibrary,
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
  type ToolPermissions,
} from '@metakit-app/core';
import {
  GitHubRemote,
  GitLabRemote,
  TokenStore,
  commitPending,
  createGitLinkStore,
  finishPull,
  fromLayout,
  linkFromSnapshot,
  listReleases,
  openRelease,
  pendingChanges,
  pull,
  pullBatch,
  type GitFile,
  type GitLink,
  type GitLinkStore,
  type GitRemote,
  type GitTag,
  type PartChange,
  type PullMerged,
  type Resolutions,
  applyToolUpdate,
  createToolPermissionBacking,
  exportBundle,
  exportCsvZip,
  exportModelFile,
  exportToolPackageFrom,
  importBundle,
  importModelFile,
  migrate,
  NewerFormatError,
  NotFoundError,
  Workspace,
  prepareToolImport,
  type HealthFinding,
  type ModelEntry,
  type PreparedToolImport,
  type StorageAdapter,
  type ToolEntry,
  type ToolUpdatePlan,
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
  attachRules,
  attachScripts,
  createPermissionStore,
  createBehaviour,
  type Behaviour,
  type BehaviourHost,
  type PermissionStore,
  type ScriptsHandle,
} from '@metakit-app/behaviour';
import { downloadFile, importFiles } from './files';
import type { GitTarget } from '../git/settings-model';
import { browserHttp, workspaceFiles } from './script-services';
import { describeClash, type ClashNotice } from './clash';
import { normalizeFolder } from './explorer';
import type { UndoSource } from './feedback';

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

/** Git mode for the tool library open in Build mode (ADR 0007). */
export interface GitState {
  /** The repository the open tool library is linked to, or null. */
  link: GitLink | null;
  pending: PartChange[];
  busy: boolean;
  error: string | null;
  /** A pull that found clashes and waits for the person's choices. */
  conflicts: PullMerged | null;
  releases: GitTag[] | null;
  /** The settings page (tokens, repository) is open. */
  settings: boolean;
  /** What the last commit or pull did. */
  note: string | null;
}

const NO_GIT: GitState = {
  link: null,
  pending: [],
  busy: false,
  error: null,
  conflicts: null,
  releases: null,
  settings: false,
  note: null,
};

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
  /** What the last import did, in plain English; cleared by the next import. */
  notes: string[];
  /** A tool library file waiting for the user to confirm it (see `importToolPackage`). */
  toolImport: ToolUpdatePlan | null;
  /** A tool asking to use the network or files; answered with `answerPermission`. */
  permissionAsk: { toolName: string; wanted: ToolPermissions } | null;
  git: GitState;
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
  /** Builds the remote for Git mode; tests replace the real services with their own. */
  makeGitRemote?: (
    service: 'github' | 'gitlab',
    host: string,
    repo: string,
    folder: string,
    token: string,
  ) => GitRemote | undefined;
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
type RulesHandle = ReturnType<typeof attachRules>;

export interface ControllerPort {
  setSelection(ids: Iterable<string>): void;
  setEditing(item: string | null): void;
  dismissMessage(id: number): void;
  pushMessage?(kind: 'info' | 'warning' | 'error', text: string): void;
  editorsOf(item: string): PresenceFile[];
  dismissNotice(id: number): void;
  /** The rule engine of an open model's behaviour, for panel buttons. */
  rulesOf(behaviour: Behaviour): RulesHandle | undefined;
  scriptsOf(behaviour: Behaviour): Promise<ScriptsHandle> | undefined;
}

/** What the Build mode view asks of the controller. */
export interface BuildPort {
  runBuild(command: ToolCommandOrBatch): CommandResult;
  undoBuild(): boolean;
  redoBuild(): boolean;
  /** Undo bound to the tool library open now, for an Undo offered after a step. */
  buildUndoSource(): UndoSource | null;
  closeBuild(): Promise<void>;
  gitRefreshPending(): void;
  gitCommit(message: string): Promise<boolean | undefined>;
  gitPull(): Promise<void | undefined>;
  gitResolve(choices: Resolutions): Promise<void | undefined>;
  gitCancelPull(): void;
  gitLoadReleases(): Promise<void | undefined>;
  gitCloseReleases(): void;
  gitUseRelease(tag: GitTag): Promise<void | undefined>;
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
  notes: [],
  toolImport: null,
  permissionAsk: null,
  git: NO_GIT,
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
    this.emitOpen('app.closing', null);
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
    this.selected = [...ids];
    this.presence?.setSelection(this.selected);
  }

  /** Tells others that an item is open in an editor here, or null when it is closed. */
  setEditing(item: string | null): void {
    this.presence?.setEditing(item);
  }

  rulesOf(behaviour: Behaviour): RulesHandle | undefined {
    // The view holds a reactive proxy of the behaviour, which is not the key the map was filled with.
    return (
      this.rulesByBehaviour.get(behaviour) ??
      this.rulesByBehaviour.get(this.current.open?.behaviour as Behaviour)
    );
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
      // The model does not exist yet, so a rule of the tool hears it on a model held in memory.
      const probe = createModelStore(model, { tool });
      const temp = this.makeBehaviour(probe, () => tool);
      const verdict = temp.bus.emit({
        event: 'model.creating',
        target: model.manifest.id,
        user: this.current.me.instance,
      });
      this.disposeBehaviour(temp);
      if (verdict.cancelled) throw new Error(verdict.reason);
      const slug = await ws.createModel(model);
      await this.refresh();
      await this.openModel(slug);
      this.emitOpen('model.created', slug);
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
        const currentTool = () => this.current.open?.tool ?? tool;
        const behaviour = this.makeBehaviour(opened.store, currentTool);
        // Scripts run only in a model that is open, not in the probe made for `model.creating`.
        this.startScripts(behaviour, opened.store, currentTool);
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
        if (!this.startedEmitted) {
          this.startedEmitted = true;
          this.emitOpen('app.started', null);
        }
        this.emitOpen('model.opened', slug);
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
    this.rulesByBehaviour.get(open.behaviour)?.reload();
    void this.scriptsByBehaviour
      .get(open.behaviour)
      ?.then((h) => h.setTool(tool))
      .catch((error) => this.pushMessage('error', message(error)));
    this.set({ open: { ...open, tool } });
  }

  private startedEmitted = false;
  private selected: string[] = [];
  private scriptsByBehaviour = new WeakMap<Behaviour, Promise<ScriptsHandle>>();
  private permissionStore: Promise<PermissionStore> | null = null;
  private permissionAnswer: ((allowed: boolean) => void) | null = null;

  /** The scripts of an open model; resolves once the tool's scripts are loaded. */
  scriptsOf(behaviour: Behaviour): Promise<ScriptsHandle> | undefined {
    return (
      this.scriptsByBehaviour.get(behaviour) ??
      this.scriptsByBehaviour.get(this.current.open?.behaviour as Behaviour)
    );
  }

  answerPermission(allowed: boolean): void {
    const answer = this.permissionAnswer;
    this.permissionAnswer = null;
    this.set({ permissionAsk: null });
    answer?.(allowed);
  }

  private permissions(): Promise<PermissionStore> {
    this.permissionStore ??= createPermissionStore(
      // The storage package keeps ids as plain strings; they are tool ids when they come back.
      createToolPermissionBacking() as unknown as Parameters<
        typeof createPermissionStore
      >[0],
      (toolId, wanted) =>
        new Promise<boolean>((resolve) => {
          const tool = this.current.open?.tool;
          this.permissionAnswer = resolve;
          this.set({
            permissionAsk: {
              toolName: tool?.manifest.name ?? String(toolId),
              wanted,
            },
          });
        }),
    );
    return this.permissionStore;
  }

  /** Starts the scripts of a model; the engine itself loads only when the tool has a script. */
  private startScripts(
    behaviour: Behaviour,
    store: ModelStore,
    tool: () => ToolLibrary,
  ): void {
    const handle = (async () => {
      const wanted = tool().manifest.permissions;
      const permissions =
        wanted && (wanted.network || wanted.files)
          ? await this.permissions()
          : undefined;
      if (permissions && wanted)
        await permissions.request(tool().manifest.id, wanted);
      return attachScripts(behaviour, {
        store,
        tool,
        http: browserHttp(),
        selection: () => this.selected,
        ...(this.workspace
          ? { files: workspaceFiles(this.workspace.adapter) }
          : {}),
        ...(permissions ? { permissions } : {}),
      });
    })();
    // A failed start (for example a blocked WebAssembly download) is reported, not thrown at the model.
    handle.catch((error) => this.pushMessage('error', message(error)));
    this.scriptsByBehaviour.set(behaviour, handle);
  }
  /** Rule engines by behaviour: they need the store and the tool, which `Behaviour` does not hold. */
  private rulesByBehaviour = new WeakMap<Behaviour, RulesHandle>();

  private disposeBehaviour(behaviour: Behaviour) {
    this.rulesByBehaviour.get(behaviour)?.dispose();
    this.rulesByBehaviour.delete(behaviour);
    void this.scriptsByBehaviour.get(behaviour)?.then(
      (h) => h.dispose(),
      () => undefined,
    );
    this.scriptsByBehaviour.delete(behaviour);
    behaviour.dispose();
  }

  /** Builds the formulas, events, rules and scripts of a model store; the hook for later phases. */
  private makeBehaviour(store: ModelStore, tool: () => ToolLibrary): Behaviour {
    const behaviour = createBehaviour({
      store,
      tool,
      host: this.behaviourHost(() => this.current.open?.behaviour ?? behaviour),
    });
    this.rulesByBehaviour.set(
      behaviour,
      attachRules(behaviour, { store, tool }),
    );
    return behaviour;
  }

  /** Announces an event of the open model, or of the app when none is open. */
  private emitOpen(
    event: Parameters<Behaviour['bus']['emit']>[0]['event'],
    target: string | null,
  ) {
    return this.current.open?.behaviour.bus.emit({
      event,
      target,
      user: this.current.me.instance,
    });
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
      runScript: (id, target) => {
        const current = behaviour();
        const handle = current && this.scriptsByBehaviour.get(current);
        if (!handle) {
          this.pushMessage('info', 'No scripts are running in this model.');
          return;
        }
        void handle
          .then((h) => h.runScript(id, target))
          .catch((error) => this.pushMessage('error', message(error)));
      },
      prompt: (text, initial) =>
        typeof globalThis.prompt === 'function'
          ? globalThis.prompt(text, initial)
          : null,
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
      this.disposeBehaviour(open.behaviour);
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
      const tool = this.parseToolText(text);
      const existing = await ws.findToolSlug(tool.manifest.id);
      if (existing)
        throw new Error(
          `The tool library "${tool.manifest.name}" is already in this workspace.`,
        );
      const slug = await ws.createTool(tool);
      await this.refresh();
      return slug;
    });
  }

  /** Reads the text of a tool library file, bringing an older format up to date. */
  private parseToolText(text: string): ToolLibrary {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error('That file is not a tool library: it is not valid JSON.');
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
    return parsed.value;
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

  // Files and packages --------------------------------------------------------------------------

  private pendingTool: PreparedToolImport | null = null;

  /** Downloads one model as a `.mkmodel.json` file. */
  exportModelFile(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      const { fileName, text } = await exportModelFile(this.need(), slug);
      downloadFile(fileName, text, 'application/json');
    });
  }

  /** Downloads models, with their tool library, as one `.mkbundle` file. */
  exportBundle(slugs: string[]): Promise<void | undefined> {
    return this.attempt(async () => {
      const { fileName, bytes } = await exportBundle(this.need(), {
        models: slugs,
        includeTool: true,
      });
      downloadFile(fileName, bytes);
    });
  }

  /** Downloads one CSV file per class of a model, zipped. */
  exportCsv(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      const ws = this.need();
      const model = (await ws.loadModel(slug)).document;
      const toolSlug = await ws.findToolSlug(model.manifest.tool);
      if (!toolSlug)
        throw new Error('The tool library of this model is missing.');
      const tool = (await ws.loadTool(toolSlug)).document;
      downloadFile(
        `${slug}.csv.zip`,
        exportCsvZip(tool, model, { bom: true }),
        'application/zip',
      );
    });
  }

  exportToolPackage(toolSlug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      const { fileName, bytes } = await exportToolPackageFrom(
        this.need(),
        toolSlug,
      );
      downloadFile(fileName, bytes, 'application/zip');
    });
  }

  /** Reads a `.mktool` file and asks for confirmation through `state.toolImport`. */
  async importToolPackage(bytes: Uint8Array): Promise<void> {
    this.pendingTool = await prepareToolImport(this.need(), bytes);
    this.set({ toolImport: this.pendingTool.plan });
  }

  confirmToolImport(): Promise<void | undefined> {
    return this.attempt(async () => {
      const prepared = this.pendingTool;
      if (!prepared) return;
      this.pendingTool = null;
      const { slug, created } = await applyToolUpdate(this.need(), prepared);
      this.set({
        toolImport: null,
        notes: [
          `${created ? 'Added' : 'Updated'} the tool library "${prepared.incoming.manifest.name}".`,
        ],
      });
      await this.refresh();
      // A tool library that is open in Build mode was rewritten under it.
      if (this.current.build?.slug === slug) await this.openBuild(slug);
    });
  }

  cancelToolImport(): void {
    this.pendingTool = null;
    this.set({ toolImport: null });
  }

  /** Imports the files the user chose or dropped: models, bundles and tool packages. */
  importFiles(files: File[]): Promise<void | undefined> {
    return this.attempt(async () => {
      const ws = this.need();
      const ordered = [...files].sort(
        (a, b) =>
          Number(/\.mkmodel\.json$/i.test(a.name)) -
          Number(/\.mkmodel\.json$/i.test(b.name)),
      );
      const results = await importFiles(ordered, {
        model: (text) => importModelFile(ws, text),
        bundle: (bytes) => importBundle(ws, bytes),
        tool: (bytes) => this.importToolPackage(bytes),
      });
      const notes: string[] = [];
      for (const r of results) {
        if (!r.ok) notes.push(r.message);
        else if (r.kind === 'model')
          notes.push(
            r.value.report.messages.length > 0
              ? r.value.report.messages.join(' ')
              : `Imported "${r.fileName}".`,
          );
        else if (r.kind === 'bundle')
          notes.push(
            r.value.messages.length > 0
              ? r.value.messages.join(' ')
              : `Imported "${r.fileName}".`,
          );
      }
      this.set({ notes });
      await this.refresh();
    });
  }

  // Git mode ---------------------------------------------------------------------------------

  readonly gitTokens = new TokenStore();
  private gitLinks: GitLinkStore | null = null;

  private links(): GitLinkStore {
    this.gitLinks ??= createGitLinkStore();
    return this.gitLinks;
  }

  private setGit(patch: Partial<GitState>): void {
    this.set({ git: { ...this.current.git, ...patch } });
  }

  /** Builds the remote for a stored token; the token itself is never kept in state. */
  makeGitRemote(
    service: 'github' | 'gitlab',
    host: string,
    repo: string,
    folder: string,
    token: string,
  ): GitRemote {
    const replaced = this.options.makeGitRemote?.(
      service,
      host,
      repo,
      folder,
      token,
    );
    if (replaced) return replaced;
    return service === 'github'
      ? new GitHubRemote({ host, repo, folder, token })
      : new GitLabRemote({ host, repo, folder, token });
  }

  private async remoteFor(link: GitLink): Promise<GitRemote> {
    const tokens = await this.gitTokens.list();
    const match = tokens.find(
      (t) => t.service === link.service && t.host === link.host,
    );
    const token = match ? await this.gitTokens.reveal(match.id) : undefined;
    if (!token)
      throw new Error(
        `There is no ${link.service === 'github' ? 'GitHub' : 'GitLab'} token for ${link.host} in this browser. Add one in the Git settings.`,
      );
    return this.makeGitRemote(
      link.service,
      link.host,
      link.repo,
      link.folder,
      token,
    );
  }

  openGitSettings(open: boolean): void {
    this.setGit({ settings: open });
  }

  /** Brings a tool library from a repository into the workspace and opens it in Build mode. */
  openFromGit(target: GitTarget): Promise<boolean | undefined> {
    return this.gitRun(async () => {
      const ws = this.need();
      const token = await this.gitTokens.reveal(target.tokenId);
      if (!token)
        throw new Error('That token is no longer stored in this browser.');
      const remote = this.makeGitRemote(
        target.service,
        target.host,
        target.repo,
        target.folder,
        token,
      );
      const snapshot = await remote.read(target.branch);
      const { tool, issues, assets } = fromLayout(snapshot.files);
      if (!tool)
        throw new Error(
          `This folder does not hold a tool library: ${issues.map((i) => i.message).join('; ') || 'tool.json is missing'}.`,
        );
      const slug = await ws.createTool(tool);
      // Asset names get a hash in the workspace, so shapes that name them by their old file name show a gap until fixed.
      for (const asset of assets) {
        if (asset.encoding !== 'base64') continue;
        const bytes = Uint8Array.from(atob(asset.content), (c) =>
          c.charCodeAt(0),
        );
        await ws.addToolAsset(slug, asset.path.replace(/^assets\//, ''), bytes);
      }
      await this.links().put(
        linkFromSnapshot(
          {
            toolSlug: slug,
            service: target.service,
            host: target.host,
            repo: target.repo,
            folder: target.folder,
            branch: target.branch,
          },
          snapshot,
        ),
      );
      await this.refresh();
      this.setGit({ settings: false });
      return this.openBuild(slug);
    });
  }

  /** Reads the link of the tool library that was just opened in Build mode. */
  private async loadGitLink(slug: string): Promise<void> {
    // Without IndexedDB (tests in Node, a blocked profile) there are no links, and Git mode is off.
    const link = await this.links()
      .get(slug)
      .then(
        (found) => found ?? null,
        () => null,
      );
    this.setGit({ ...NO_GIT, link });
    if (link) this.gitRefreshPending();
  }

  /** Assets stay as they are in the repository: Build mode does not edit them in Git mode. */
  private repositoryAssets(link: GitLink): GitFile[] {
    return link.baseFiles.filter((f) => f.path.startsWith('assets/'));
  }

  gitRefreshPending(): void {
    const { link } = this.current.git;
    const build = this.current.build;
    if (!link || !build) return;
    this.setGit({
      pending: pendingChanges(
        link,
        build.store.state,
        this.repositoryAssets(link),
      ),
    });
  }

  private async gitRun<T>(action: () => Promise<T>): Promise<T | undefined> {
    this.setGit({ busy: true, error: null, note: null });
    try {
      return await action();
    } catch (error) {
      this.setGit({ error: message(error) });
      return undefined;
    } finally {
      this.setGit({ busy: false });
    }
  }

  /** Commit and push: every changed part in one commit. */
  gitCommit(commitMessage: string): Promise<boolean | undefined> {
    return this.gitRun(async () => {
      const { link } = this.current.git;
      const build = this.current.build;
      if (!link || !build)
        throw new Error('This tool library is not linked to a repository.');
      const remote = await this.remoteFor(link);
      const done = await commitPending({
        remote,
        link,
        tool: build.store.state,
        assets: this.repositoryAssets(link),
        message: commitMessage,
      });
      await this.links().put(done.link);
      this.setGit({
        link: done.link,
        note: `Committed ${done.files} file${done.files === 1 ? '' : 's'}.`,
      });
      this.gitRefreshPending();
      return true;
    });
  }

  /** Applies a merged tool library to the open one as a single undo step. */
  private async applyGitTool(
    tool: PullMerged['tool'],
    link: GitLink,
  ): Promise<void> {
    const build = this.current.build;
    if (!build) return;
    const batch = pullBatch(build.store.state, tool);
    if (batch) {
      const result = this.runBuild(batch);
      if (!result.ok) throw new Error(result.error);
    }
    await this.links().put(link);
    this.setGit({ link, conflicts: null });
    this.gitRefreshPending();
  }

  /** Pull: merges the branch into the tool library; clashes wait for `gitResolve`. */
  gitPull(): Promise<void | undefined> {
    return this.gitRun(async () => {
      const { link } = this.current.git;
      const build = this.current.build;
      if (!link || !build)
        throw new Error('This tool library is not linked to a repository.');
      const remote = await this.remoteFor(link);
      const outcome = await pull({
        remote,
        link,
        tool: build.store.state,
        assets: this.repositoryAssets(link),
      });
      if (outcome.status === 'up-to-date') {
        this.setGit({ note: 'Already up to date.' });
        return;
      }
      if (outcome.conflicts.length > 0) {
        this.setGit({ conflicts: outcome });
        return;
      }
      await this.applyGitTool(outcome.tool, outcome.link);
      this.setGit({ note: 'Pulled the changes from the repository.' });
    });
  }

  gitResolve(choices: Resolutions): Promise<void | undefined> {
    return this.gitRun(async () => {
      const merged = this.current.git.conflicts;
      if (!merged) return;
      const done = finishPull(merged, choices);
      await this.applyGitTool(done.tool, done.link);
      this.setGit({ note: 'Pulled the changes and kept your choices.' });
    });
  }

  gitCancelPull(): void {
    this.setGit({ conflicts: null });
  }

  gitLoadReleases(): Promise<void | undefined> {
    return this.gitRun(async () => {
      const { link } = this.current.git;
      if (!link)
        throw new Error('This tool library is not linked to a repository.');
      this.setGit({ releases: await listReleases(await this.remoteFor(link)) });
    });
  }

  gitCloseReleases(): void {
    this.setGit({ releases: null });
  }

  /** Switches the tool library to a tagged release; an ordinary edit that can be undone. */
  gitUseRelease(tag: GitTag): Promise<void | undefined> {
    return this.gitRun(async () => {
      const { link } = this.current.git;
      if (!link)
        throw new Error('This tool library is not linked to a repository.');
      const opened = await openRelease(await this.remoteFor(link), tag.name);
      const build = this.current.build;
      if (!build) return;
      const batch = pullBatch(build.store.state, opened.tool);
      if (batch) {
        const result = this.runBuild(batch);
        if (!result.ok) throw new Error(result.error);
      }
      this.setGit({
        releases: null,
        note: `Now showing release ${tag.name}. Commit to keep it on the branch, or undo.`,
      });
      this.gitRefreshPending();
    });
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
      if (this.current.open?.slug === slug) {
        const verdict = this.emitOpen('model.deleting', slug);
        if (verdict?.cancelled) throw new Error(verdict.reason);
        this.emitOpen('model.deleted', slug);
        await this.closeModel();
      }
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

  /**
   * Makes a new tool library from a copy of a workspace library (`slug`) or of the text of a
   * built-in one (`text`), to extend it (ADR 0010). Returns its folder name; the original is not changed.
   */
  copyToolLibrary(
    name: string,
    from: { slug: string } | { text: string },
  ): Promise<string | undefined> {
    return this.attempt(async () => {
      const trimmed = name.trim();
      if (trimmed === '') throw new Error('Give the tool library a name.');
      const ws = this.need();
      const source =
        'slug' in from
          ? (await ws.loadTool(from.slug)).document
          : this.parseToolText(from.text);
      const slug = await ws.createTool(cloneToolLibrary(source, trimmed));
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
        await this.loadGitLink(slug);
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
        git: { ...NO_GIT, settings: this.current.git.settings },
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

  buildUndoSource(): UndoSource | null {
    const store = this.current.build?.store;
    if (!store) return null;
    return {
      // Bound to this library: once it is closed, an old offer cannot undo in another one.
      undo: () => this.current.build?.store === store && store.undo(),
      onLocalChange: (listener) =>
        store.subscribe((event) => {
          if (event.origin !== 'remote') listener();
        }),
    };
  }

  /** Writes the open tool library's pending changes now. */
  async flushBuild(): Promise<void> {
    await this.current.build?.session.flush();
  }
}

export type { ElementId };
