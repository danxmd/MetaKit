import {
  CommandError,
  createEmptyModel,
  cloneKit,
  createEmptyKit,
  createModelStore,
  formatIssues,
  parseKit,
  validateKit,
  type ElementId,
  type Issue,
  type Model,
  type ModelStore,
  type ModelTypeDef,
  type ModelTypeId,
  type KitCommandOrBatch,
  type Kit,
  type KitStore,
  type KitPermissions,
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
  applyKitUpdate,
  createKitPermissionBacking,
  exportBundle,
  exportCsvZip,
  exportModelFile,
  exportKitPackageFrom,
  importBundle,
  importModelFile,
  migrate,
  NewerFormatError,
  NotFoundError,
  Workspace,
  prepareKitImport,
  type HealthFinding,
  type ModelEntry,
  type PreparedKitImport,
  type StorageAdapter,
  type KitEntry,
  type KitUpdatePlan,
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
  kitSlug: string;
  /** The Kit as it is now: it follows edits made in Build mode by anyone in the folder. */
  kit: Kit;
  /** The Kit's own store and session, so that the model follows changes to its Kit. */
  kitStore: KitStore;
  kitSession: SyncSession;
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

/** A Kit open in Build mode. */
export interface OpenKit {
  slug: string;
  store: KitStore;
  session: SyncSession;
  warnings: string[];
  /** Counts changes, so that views that read `store.state` know to read it again. */
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
  /** Problems the Kit has now, for example a class that extends itself. */
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

/** Git mode for the Kit open in Build mode (ADR 0007). */
export interface GitState {
  /** The repository the open Kit is linked to, or null. */
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
  kits: KitEntry[];
  models: ModelEntry[];
  /** Deleted less than 30 days ago, so that they can be restored. */
  trashed: ModelEntry[];
  trashedKits: KitEntry[];
  open: OpenModel | null;
  /** Messages from rules and scripts of the open model. */
  messages: BehaviourMessage[];
  /** The Kit being edited in Build mode. */
  build: OpenKit | null;
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
  /** A Kit file waiting for the user to confirm it (see `importKitPackage`). */
  kitImport: KitUpdatePlan | null;
  /** A Kit asking to use the network or files; answered with `answerPermission`. */
  permissionAsk: { kitName: string; wanted: KitPermissions } | null;
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
  runBuild(command: KitCommandOrBatch): CommandResult;
  undoBuild(): boolean;
  redoBuild(): boolean;
  /** Undo bound to the Kit open now, for an Undo offered after a step. */
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
  kits: [],
  models: [],
  trashed: [],
  trashedKits: [],
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
  kitImport: null,
  permissionAsk: null,
  git: NO_GIT,
});

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const saveOf = (s: SyncStatus): SaveStatus =>
  s.error ? 'error' : s.pending > 0 ? 'saving' : 'saved';

/**
 * What Model mode keeps between screens: the open workspace, its Kits and models, the
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

  /** Reads the lists of Kits and models again. */
  async refresh(): Promise<void> {
    const ws = this.need();
    await this.attempt(async () => {
      const [allKits, allModels] = await Promise.all([
        ws.listKits({ includeTrashed: true }),
        ws.listModels({ includeTrashed: true }),
      ]);
      this.set({
        kits: allKits.filter((t) => !t.trashed),
        trashedKits: allKits.filter((t) => t.trashed && !t.expired),
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
    kitSlug: string;
    modelType: ModelTypeId;
    name: string;
    folder?: string | null;
  }): Promise<string | undefined> {
    return this.attempt(async () => {
      const ws = this.need();
      const { document: kit } = await ws.loadKit(input.kitSlug);
      const folder = normalizeFolder(input.folder);
      const model = createEmptyModel(kit, input.modelType, {
        name: input.name,
        ...(folder ? { folder } : {}),
      });
      // The model does not exist yet, so a rule of the Kit hears it on a model held in memory.
      const probe = createModelStore(model, { kit });
      const temp = this.makeBehaviour(probe, () => kit);
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
        const kitSlug = await ws.findKitSlug(header.document.manifest.kit);
        if (!kitSlug)
          throw new Error(
            `This model was made with a Kit that is not in this workspace (${header.document.manifest.kit}).`,
          );
        const kitOpened = await ws.openKit(kitSlug, this.sessionOptions());
        const kit = kitOpened.store.state;
        const opened = await ws
          .openModel(slug, kit, {
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
            await kitOpened.session.close();
            throw error;
          });
        const currentTool = () => this.current.open?.kit ?? kit;
        const behaviour = this.makeBehaviour(opened.store, currentTool);
        // Scripts run only in a model that is open, not in the probe made for `model.creating`.
        this.startScripts(behaviour, opened.store, currentTool);
        opened.session.start();
        kitOpened.session.start();
        kitOpened.store.subscribe(() => this.kitChanged());
        this.set({
          phase: 'model',
          save: 'saved',
          sync: NO_SYNC,
          notices: [],
          open: {
            slug,
            kitSlug,
            kit,
            kitStore: kitOpened.store,
            kitSession: kitOpened.session,
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

  /** The open model's Kit changed (here or in another window): redraw with the new one. */
  private kitChanged(): void {
    const open = this.current.open;
    if (!open) return;
    const kit = open.kitStore.state;
    if (kit === open.kit) return;
    // Commands on the model are checked against the new Kit from now on.
    open.store.updateContext({ kit });
    open.behaviour.setKit(kit);
    this.rulesByBehaviour.get(open.behaviour)?.reload();
    void this.scriptsByBehaviour
      .get(open.behaviour)
      ?.then((h) => h.setKit(kit))
      .catch((error) => this.pushMessage('error', message(error)));
    this.set({ open: { ...open, kit } });
  }

  private startedEmitted = false;
  private selected: string[] = [];
  private scriptsByBehaviour = new WeakMap<Behaviour, Promise<ScriptsHandle>>();
  private permissionStore: Promise<PermissionStore> | null = null;
  private permissionAnswer: ((allowed: boolean) => void) | null = null;

  /** The scripts of an open model; resolves once the Kit's scripts are loaded. */
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
      // The storage package keeps ids as plain strings; they are Kit ids when they come back.
      createKitPermissionBacking() as unknown as Parameters<
        typeof createPermissionStore
      >[0],
      (kitId, wanted) =>
        new Promise<boolean>((resolve) => {
          const kit = this.current.open?.kit;
          this.permissionAnswer = resolve;
          this.set({
            permissionAsk: {
              kitName: kit?.manifest.name ?? String(kitId),
              wanted,
            },
          });
        }),
    );
    return this.permissionStore;
  }

  /** Starts the scripts of a model; the engine itself loads only when the Kit has a script. */
  private startScripts(
    behaviour: Behaviour,
    store: ModelStore,
    kit: () => Kit,
  ): void {
    const handle = (async () => {
      const wanted = kit().manifest.permissions;
      const permissions =
        wanted && (wanted.network || wanted.files)
          ? await this.permissions()
          : undefined;
      if (permissions && wanted)
        await permissions.request(kit().manifest.id, wanted);
      return attachScripts(behaviour, {
        store,
        kit,
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
  /** Rule engines by behaviour: they need the store and the Kit, which `Behaviour` does not hold. */
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
  private makeBehaviour(store: ModelStore, kit: () => Kit): Behaviour {
    const behaviour = createBehaviour({
      store,
      kit,
      host: this.behaviourHost(() => this.current.open?.behaviour ?? behaviour),
    });
    this.rulesByBehaviour.set(
      behaviour,
      attachRules(behaviour, { store, kit }),
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
      open.kit,
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
      await open.kitSession.close();
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
   * Adds a Kit from the text of its file. The file is checked first and a library that
   * is already in the workspace is not added twice. Returns the folder name it was given.
   */
  async addKit(text: string): Promise<string | undefined> {
    return this.attempt(async () => {
      const ws = this.need();
      const kit = this.parseKitText(text);
      const existing = await ws.findKitSlug(kit.manifest.id);
      if (existing)
        throw new Error(
          `The Kit "${kit.manifest.name}" is already in this workspace.`,
        );
      const slug = await ws.createKit(kit);
      await this.refresh();
      return slug;
    });
  }

  /** Reads the text of a Kit file, bringing an older format up to date. */
  private parseKitText(text: string): Kit {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error('That file is not a Kit: it is not valid JSON.');
    }
    let upgraded: unknown = value;
    try {
      // A file from an earlier release is brought up to the current format in memory.
      upgraded = migrate('kit-document', value).value;
    } catch (error) {
      // A file from a newer release is refused; anything else is reported by the checks below.
      if (error instanceof NewerFormatError)
        throw new Error(`That file cannot be read: ${error.message}`, {
          cause: error,
        });
    }
    const parsed = parseKit(upgraded);
    if (!parsed.ok)
      throw new Error(
        `That file is not a valid Kit.\n${formatIssues(parsed.issues)}`,
      );
    return parsed.value;
  }

  /** The model types of a Kit of this workspace, for the new-model dialog. */
  async modelTypesOf(kitSlug: string): Promise<ModelTypeDef[]> {
    const { document } = await this.need().loadKit(kitSlug);
    return Object.values(document.modelTypes).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }

  /**
   * Every model of the workspace with its Kit, for the reference picker and find across
   * models. The open model is read from its live store, so unsaved edits count.
   */
  async readAllModels(): Promise<
    { entry: ModelEntry; model: Model; kit: Kit }[]
  > {
    const ws = this.need();
    const kits = new Map<string, Kit>();
    const result: { entry: ModelEntry; model: Model; kit: Kit }[] = [];
    for (const entry of this.current.models) {
      try {
        const open = this.current.open;
        if (open && open.slug === entry.slug) {
          result.push({
            entry,
            model: open.store.state as Model,
            kit: open.kit,
          });
          continue;
        }
        const kitSlug = await ws.findKitSlug(entry.kit);
        if (!kitSlug) continue;
        let kit = kits.get(kitSlug);
        if (!kit) {
          kit = (await ws.loadKit(kitSlug)).document;
          kits.set(kitSlug, kit);
        }
        result.push({
          entry,
          model: (await ws.loadModel(entry.slug)).document,
          kit,
        });
      } catch {
        // A model that cannot be read is left out of searches; opening it shows the reason.
      }
    }
    return result;
  }

  // Files and packages --------------------------------------------------------------------------

  private pendingKit: PreparedKitImport | null = null;

  /** Downloads one model as a `.mkmodel.json` file. */
  exportModelFile(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      const { fileName, text } = await exportModelFile(this.need(), slug);
      downloadFile(fileName, text, 'application/json');
    });
  }

  /** Downloads models, with their Kit, as one `.mkbundle` file. */
  exportBundle(slugs: string[]): Promise<void | undefined> {
    return this.attempt(async () => {
      const { fileName, bytes } = await exportBundle(this.need(), {
        models: slugs,
        includeKit: true,
      });
      downloadFile(fileName, bytes);
    });
  }

  /** Downloads one CSV file per class of a model, zipped. */
  exportCsv(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      const ws = this.need();
      const model = (await ws.loadModel(slug)).document;
      const kitSlug = await ws.findKitSlug(model.manifest.kit);
      if (!kitSlug) throw new Error('The Kit of this model is missing.');
      const kit = (await ws.loadKit(kitSlug)).document;
      downloadFile(
        `${slug}.csv.zip`,
        exportCsvZip(kit, model, { bom: true }),
        'application/zip',
      );
    });
  }

  exportKitPackage(kitSlug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      const { fileName, bytes } = await exportKitPackageFrom(
        this.need(),
        kitSlug,
      );
      downloadFile(fileName, bytes, 'application/zip');
    });
  }

  /** Reads a `.mkkit` (or `.mktool`) file and asks for confirmation through `state.kitImport`. */
  async importKitPackage(bytes: Uint8Array): Promise<void> {
    this.pendingKit = await prepareKitImport(this.need(), bytes);
    this.set({ kitImport: this.pendingKit.plan });
  }

  confirmKitImport(): Promise<void | undefined> {
    return this.attempt(async () => {
      const prepared = this.pendingKit;
      if (!prepared) return;
      this.pendingKit = null;
      const { slug, created } = await applyKitUpdate(this.need(), prepared);
      this.set({
        kitImport: null,
        notes: [
          `${created ? 'Added' : 'Updated'} the Kit "${prepared.incoming.manifest.name}".`,
        ],
      });
      await this.refresh();
      // A Kit that is open in Build mode was rewritten under it.
      if (this.current.build?.slug === slug) await this.openBuild(slug);
    });
  }

  cancelKitImport(): void {
    this.pendingKit = null;
    this.set({ kitImport: null });
  }

  /** Imports the files the user chose or dropped: models, bundles and Kit packages. */
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
        kit: (bytes) => this.importKitPackage(bytes),
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

  /** Brings a Kit from a repository into the workspace and opens it in Build mode. */
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
      const { kit, issues, assets } = fromLayout(snapshot.files);
      if (!kit)
        throw new Error(
          `This folder does not hold a Kit: ${issues.map((i) => i.message).join('; ') || 'kit.json is missing'}.`,
        );
      const slug = await ws.createKit(kit);
      // Asset names get a hash in the workspace, so shapes that name them by their old file name show a gap until fixed.
      for (const asset of assets) {
        if (asset.encoding !== 'base64') continue;
        const bytes = Uint8Array.from(atob(asset.content), (c) =>
          c.charCodeAt(0),
        );
        await ws.addKitAsset(slug, asset.path.replace(/^assets\//, ''), bytes);
      }
      await this.links().put(
        linkFromSnapshot(
          {
            kitSlug: slug,
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

  /** Reads the link of the Kit that was just opened in Build mode. */
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
        throw new Error('This Kit is not linked to a repository.');
      const remote = await this.remoteFor(link);
      const done = await commitPending({
        remote,
        link,
        kit: build.store.state,
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

  /** Applies a merged Kit to the open one as a single undo step. */
  private async applyGitKit(
    kit: PullMerged['kit'],
    link: GitLink,
  ): Promise<void> {
    const build = this.current.build;
    if (!build) return;
    const batch = pullBatch(build.store.state, kit);
    if (batch) {
      const result = this.runBuild(batch);
      if (!result.ok) throw new Error(result.error);
    }
    await this.links().put(link);
    this.setGit({ link, conflicts: null });
    this.gitRefreshPending();
  }

  /** Pull: merges the branch into the Kit; clashes wait for `gitResolve`. */
  gitPull(): Promise<void | undefined> {
    return this.gitRun(async () => {
      const { link } = this.current.git;
      const build = this.current.build;
      if (!link || !build)
        throw new Error('This Kit is not linked to a repository.');
      const remote = await this.remoteFor(link);
      const outcome = await pull({
        remote,
        link,
        kit: build.store.state,
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
      await this.applyGitKit(outcome.kit, outcome.link);
      this.setGit({ note: 'Pulled the changes from the repository.' });
    });
  }

  gitResolve(choices: Resolutions): Promise<void | undefined> {
    return this.gitRun(async () => {
      const merged = this.current.git.conflicts;
      if (!merged) return;
      const done = finishPull(merged, choices);
      await this.applyGitKit(done.kit, done.link);
      this.setGit({ note: 'Pulled the changes and kept your choices.' });
    });
  }

  gitCancelPull(): void {
    this.setGit({ conflicts: null });
  }

  gitLoadReleases(): Promise<void | undefined> {
    return this.gitRun(async () => {
      const { link } = this.current.git;
      if (!link) throw new Error('This Kit is not linked to a repository.');
      this.setGit({ releases: await listReleases(await this.remoteFor(link)) });
    });
  }

  gitCloseReleases(): void {
    this.setGit({ releases: null });
  }

  /** Switches the Kit to a tagged release; an ordinary edit that can be undone. */
  gitUseRelease(tag: GitTag): Promise<void | undefined> {
    return this.gitRun(async () => {
      const { link } = this.current.git;
      if (!link) throw new Error('This Kit is not linked to a repository.');
      const opened = await openRelease(await this.remoteFor(link), tag.name);
      const build = this.current.build;
      if (!build) return;
      const batch = pullBatch(build.store.state, opened.kit);
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

  trashKit(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      await this.need().trashKit(slug);
      await this.refresh();
    });
  }

  restoreKit(slug: string): Promise<void | undefined> {
    return this.attempt(async () => {
      await this.need().restoreKit(slug);
      await this.refresh();
    });
  }

  // Build mode --------------------------------------------------------------------------------

  /** Makes an empty Kit in the workspace and returns its folder name. */
  createKit(name: string, languages?: string[]): Promise<string | undefined> {
    return this.attempt(async () => {
      const trimmed = name.trim();
      if (trimmed === '') throw new Error('Give the Kit a name.');
      const slug = await this.need().createKit(
        createEmptyKit({ name: trimmed, ...(languages ? { languages } : {}) }),
      );
      await this.refresh();
      return slug;
    });
  }

  /**
   * Makes a new Kit from a copy of a workspace library (`slug`) or of the text of a
   * built-in one (`text`), to extend it (ADR 0010). Returns its folder name; the original is not changed.
   */
  copyKit(
    name: string,
    from: { slug: string } | { text: string },
  ): Promise<string | undefined> {
    return this.attempt(async () => {
      const trimmed = name.trim();
      if (trimmed === '') throw new Error('Give the Kit a name.');
      const ws = this.need();
      const source =
        'slug' in from
          ? (await ws.loadKit(from.slug)).document
          : this.parseKitText(from.text);
      const slug = await ws.createKit(cloneKit(source, trimmed));
      await this.refresh();
      return slug;
    });
  }

  /** Opens a Kit for editing; its changes are written as they are made. */
  async openBuild(slug: string): Promise<boolean> {
    return (
      (await this.attempt(async () => {
        const ws = this.need();
        await this.closeModel();
        await this.closeBuild();
        const opened = await ws.openKit(slug, {
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
        issues: validateKit(build.store.state),
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
   * Runs a command on the Kit being edited. A refused command (a key that is taken, a
   * class that is still in use) comes back as a message, and nothing has changed.
   */
  runBuild(command: KitCommandOrBatch): CommandResult {
    const build = this.current.build;
    if (!build) return { ok: false, error: 'No Kit is open.' };
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

  /** Writes the open Kit's pending changes now. */
  async flushBuild(): Promise<void> {
    await this.current.build?.session.flush();
  }
}

export type { ElementId };
