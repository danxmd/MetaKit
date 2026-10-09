<script lang="ts">
  import { onMount } from 'svelte';
  import {
    closeDocs,
    DocsLayer,
    docsOpen,
    isTypingTarget,
    pushDocsContext,
    setDocsContext,
    toggleDocs,
    type PanelState,
  } from '@metakit-app/ui/docs';
  import {
    AppController,
    ReferenceIndex,
    type ReferenceServices,
  } from '@metakit-app/ui';
  import type { ElementId, ToolLibrary } from '@metakit-app/core';
  import BuildView from '@metakit-app/ui/components/BuildView.svelte';
  import AssistantSettings from '@metakit-app/ui/components/assistant/AssistantSettings.svelte';
  import {
    AssistantService,
    browserKeyValue,
    typeCheckWithClient,
  } from '@metakit-app/ui/assistant';
  import GitSettings from '@metakit-app/ui/components/git/GitSettings.svelte';
  import DocsPage from '@metakit-app/ui/components/docs/DocsPage.svelte';
  import DocsPanel from '@metakit-app/ui/components/docs/DocsPanel.svelte';
  import ModalPanel from '@metakit-app/ui/components/ModalPanel.svelte';
  import ConfirmDialog from '@metakit-app/ui/components/ConfirmDialog.svelte';
  import Toast from '@metakit-app/ui/components/Toast.svelte';
  import ModelsPage from '@metakit-app/ui/components/ModelsPage.svelte';
  import ToolImportDialog from '@metakit-app/ui/components/ToolImportDialog.svelte';
  import ToolLibrariesPage from '@metakit-app/ui/components/ToolLibrariesPage.svelte';
  import TopBar from '@metakit-app/ui/components/TopBar.svelte';
  import ModelView from '@metakit-app/ui/components/ModelView.svelte';
  import NewModelDialog from '@metakit-app/ui/components/NewModelDialog.svelte';
  import PermissionDialog from '@metakit-app/ui/components/build/scripts/PermissionDialog.svelte';
  import ProfileDialog from '@metakit-app/ui/components/ProfileDialog.svelte';
  import StartPage from '@metakit-app/ui/components/StartPage.svelte';
  import {
    BUILT_IN_TOOLS,
    findAcrossModels,
    folderPaths,
    type BuiltInTool,
    type ToolStart,
  } from '@metakit-app/ui';
  import { toasts } from '@metakit-app/ui/feedback';
  import { PROFILE_COLOURS, type Profile } from '@metakit-app/storage';
  import {
    adapterFor,
    askAccess,
    loadProfile,
    pickFolder,
    saveProfile,
    rememberedFolder,
    testGitRemote,
    type RememberedFolder,
  } from './access';
  import { supportsLocalFolders } from './browser-support';

  const supported = supportsLocalFolders(window);
  // Imported by file, not through the package index, so the assistant stays out of the first download.
  const assistant = new AssistantService({
    kv: browserKeyValue(),
    typeCheck: typeCheckWithClient(async () =>
      (
        await import('@metakit-app/ui/assistant-language')
      ).startLanguageClient(),
    ),
  });
  let showAssistant = $state(false);
  void assistant.load();
  const controller = new AppController({
    // Read when used: the e2e harness sets the replacement after the app has started.
    makeGitRemote: (...args) => testGitRemote()?.(...args),
  });
  // undefined while it is being read; null on the first visit, when the app asks.
  let profile = $state<Profile | null | undefined>(undefined);
  let app = $state(controller.state);
  controller.subscribe((s) => (app = s));

  let remembered = $state<RememberedFolder | null>(null);
  let busy = $state(false);
  let startError = $state<string | null>(null);
  let pendingCreate = $state<{ handle: FileSystemDirectoryHandle } | null>(
    null,
  );
  let showNew = $state(false);

  onMount(() => {
    const stopDocs = docsOpen.subscribe((p) => (docs = p));
    void bootProfile();
    return stopDocs;
  });

  async function bootProfile() {
    const stored = await loadProfile();
    if (stored) controller.setProfile(stored);
    profile = stored;
    if (supported) remembered = await rememberedFolder();
  }

  async function chooseProfile(chosen: Profile) {
    controller.setProfile(chosen);
    // The dialog closes only once the choice is stored, so a quick reload does not ask again.
    await saveProfile(chosen);
    profile = chosen;
  }

  async function openHandle(handle: FileSystemDirectoryHandle) {
    busy = true;
    startError = null;
    try {
      const adapter = await adapterFor(handle);
      const result = await controller.openWorkspace(adapter);
      if (result === 'not-a-workspace') pendingCreate = { handle };
      else if (result === 'failed') startError = controller.state.error;
      else pendingCreate = null;
    } catch (error) {
      startError = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  }

  async function onOpen() {
    try {
      await openHandle(await pickFolder());
    } catch (error) {
      // Closing the folder dialog is not an error.
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        startError = error instanceof Error ? error.message : String(error);
    }
  }

  async function onReopen() {
    if (!remembered) return;
    const folder = remembered;
    if (!folder.granted && !(await askAccess(folder.handle))) {
      startError =
        'The browser did not give access to that folder. Choose it again.';
      return;
    }
    await openHandle(folder.handle);
  }

  async function onCreate(name: string) {
    if (!pendingCreate) return;
    busy = true;
    try {
      const adapter = await adapterFor(pendingCreate.handle);
      const result = await controller.openWorkspace(adapter, {
        create: { name },
      });
      if (result === 'opened') pendingCreate = null;
      else startError = controller.state.error;
    } finally {
      busy = false;
    }
  }

  // References across models ------------------------------------------------------------------

  let refTick = $state(0);
  const index = new ReferenceIndex(() => controller.readAllModels());
  let selectElement: ((id: ElementId) => void) | null = null;
  $effect(() => {
    // The picker reads every model once per workspace change or model switch.
    void [app.models, app.open?.slug];
    if (app.phase === 'start') return;
    index.refresh().then(() => (refTick += 1));
  });

  const references: ReferenceServices = {
    search: (query, attr) => index.search(query, attr),
    resolve: (ref) => {
      void refTick;
      if (!index.isLoaded) return { title: 'Loading…', modelName: '' };
      return index.resolve(ref);
    },
    open: async (ref) => {
      const found = index.resolve(ref);
      if (!found) return;
      if (app.open?.slug !== found.slug) await controller.openModel(found.slug);
      selectElement?.(ref.element);
    },
  };

  const folders = $derived(folderPaths(app.models));

  // Help ----------------------------------------------------------------------------------------

  let docs = $state<PanelState>(docsOpen.get());
  // The Documentation area is a third place next to Model and Build. Whatever is open there (a
  // model, a tool library) stays mounted underneath, so coming back finds it unchanged.
  let docsArea = $state(false);
  let docsVisited = $state(false);
  let docsRequest = $state<{ topic: string | null } | null>(null);

  function showDocsArea(topic: string | null | undefined) {
    docsVisited = true;
    docsArea = true;
    if (topic !== undefined) docsRequest = { topic };
  }

  function openInDocs(topic: string | null) {
    closeDocs();
    showDocsArea(topic);
  }

  $effect(() => {
    // What the person is looking at, for Help. Build mode refines it per section.
    setDocsContext(
      app.phase === 'start'
        ? 'start'
        : app.phase === 'build' && app.build
          ? 'build'
          : app.phase === 'model' && app.open
            ? 'model'
            : area === 'build'
              ? 'tool-libraries'
              : 'models',
    );
  });
  $effect(() =>
    docsArea ? pushDocsContext('docs', DocsLayer.area) : undefined,
  );

  function onWindowKey(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    if (event.key === 'F1') {
      event.preventDefault();
      toggleDocs();
    } else if (
      event.key === '?' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isTypingTarget(event.target)
    ) {
      event.preventDefault();
      toggleDocs();
    }
  }

  // Which area the workspace shows. An open model or tool library decides it; with none open the
  // person's last choice stays, so that "back" from a tool library lands on the tool libraries.
  let area = $state<'model' | 'build'>('model');
  $effect(() => {
    if (app.phase === 'model') area = 'model';
    else if (app.phase === 'build') area = 'build';
  });

  // Deleted models and tool libraries go to the trash, so they are removed at once and the toast
  // offers Undo, which restores them (ui-coherence).
  async function trashModel(slug: string) {
    const name = app.models.find((m) => m.slug === slug)?.name ?? slug;
    await controller.trashModel(slug);
    if (app.trashed.some((m) => m.slug === slug))
      toasts.show(`Deleted model ${name}`, {
        undo: () => void controller.restoreModel(slug),
      });
  }

  async function trashTool(slug: string) {
    const name = app.tools.find((t) => t.slug === slug)?.name ?? slug;
    await controller.trashTool(slug);
    if (app.trashedTools.some((t) => t.slug === slug))
      toasts.show(`Deleted tool library ${name}`, {
        undo: () => void controller.restoreTool(slug),
      });
  }

  async function chooseArea(next: 'model' | 'build') {
    const fromDocs = docsArea;
    docsArea = false;
    // Back from the Documentation to where the person was: nothing to close or open.
    if (fromDocs && next === area) return;
    if (next === 'build' && app.open) await controller.closeModel();
    if (next === 'model' && app.build) await controller.closeBuild();
    area = next;
  }

  let showProfile = $state(false);

  async function closeWorkspace() {
    docsArea = false;
    await controller.closeWorkspace();
    area = 'model';
  }

  /** A new tool library: empty, or a copy of a workspace or built-in one (ADR 0010). */
  async function newTool(name: string, start: ToolStart) {
    if (start.kind === 'empty') return controller.createToolLibrary(name);
    if (start.kind === 'workspace')
      return controller.copyToolLibrary(name, { slug: start.slug });
    return controller.copyToolLibrary(name, { text: await start.tool.load() });
  }

  async function useBuiltIn(tool: BuiltInTool) {
    await controller.addToolLibrary(await tool.load());
  }

  const builtInKey = (tool: BuiltInTool) => `built-in:${tool.id}`;

  /** Model types of a workspace library, or of a built-in one that is not added yet. */
  async function modelTypesFor(key: string) {
    const builtIn = BUILT_IN_TOOLS.find((t) => builtInKey(t) === key);
    if (!builtIn) return controller.modelTypesOf(key);
    const tool = JSON.parse(await builtIn.load()) as ToolLibrary;
    return Object.values(tool.modelTypes).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }

  async function create(input: Parameters<typeof controller.createModel>[0]) {
    showNew = false;
    // A built-in library is added to the workspace first; the model then uses that copy.
    const builtIn = BUILT_IN_TOOLS.find(
      (t) => builtInKey(t) === input.toolSlug,
    );
    if (builtIn) {
      const slug = await controller.addToolLibrary(await builtIn.load());
      if (!slug) return;
      input = { ...input, toolSlug: slug };
    }
    await controller.createModel(input);
  }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if app.phase === 'start'}
  <div class="row start-row">
    <div class="start-scroll">
      <StartPage
        {supported}
        remembered={remembered?.name ?? null}
        {busy}
        error={startError}
        pendingCreate={pendingCreate ? pendingCreate.handle.name : null}
        {onOpen}
        {onReopen}
        {onCreate}
        onCancelCreate={() => (pendingCreate = null)}
        helpOpen={docs.open}
        onHelp={toggleDocs}
      />
    </div>
    {#if docs.open}
      <DocsPanel onClose={closeDocs} onOpenInDocs={openInDocs} />
    {/if}
  </div>
{:else}
  <div class="shell" data-testid="app-shell">
    <TopBar
      workspaceName={app.workspaceName}
      {area}
      docsActive={docsArea}
      helpOpen={docs.open}
      onMode={chooseArea}
      onDocs={() => showDocsArea(undefined)}
      onHelp={toggleDocs}
      onGit={() => controller.openGitSettings(true)}
      onAssistant={() => (showAssistant = true)}
      onProfile={() => (showProfile = true)}
      onCloseWorkspace={closeWorkspace}
    />
    <div class="row">
      <!-- The views fill this box (height: 100%); the home pages scroll inside it. -->
      <div class="content">
        <div class="views" class:covered={docsArea} inert={docsArea}>
          {#if app.phase === 'build' && app.build}
            {#key app.build.slug}
              <BuildView
                {assistant}
                {app}
                {controller}
                onBack={() => undefined}
              />
            {/key}
          {:else if app.phase === 'model' && app.open}
            {#key app.open.slug}
              <ModelView
                {app}
                {controller}
                {references}
                registerOpenElement={(fn) => (selectElement = fn)}
                onBack={() => controller.closeModel()}
              />
            {/key}
          {:else if area === 'build'}
            <ToolLibrariesPage
              tools={app.tools}
              trashedTools={app.trashedTools}
              models={app.models}
              health={app.health}
              warnings={app.warnings}
              error={app.error}
              notes={app.notes}
              builtIns={BUILT_IN_TOOLS}
              onNewTool={newTool}
              onUseBuiltIn={useBuiltIn}
              onAddTool={(text) => controller.addToolLibrary(text)}
              onGit={() => controller.openGitSettings(true)}
              onEditTool={(slug) => controller.openBuild(slug)}
              onExportTool={(slug) => controller.exportToolPackage(slug)}
              onTrashTool={trashTool}
              onRestoreTool={(slug) => controller.restoreTool(slug)}
            />
          {:else}
            <ModelsPage
              models={app.models}
              trashed={app.trashed}
              tools={app.tools}
              health={app.health}
              warnings={app.warnings}
              error={app.error}
              notes={app.notes}
              onNew={() => (showNew = true)}
              onGoBuild={() => chooseArea('build')}
              onOpen={(slug) => controller.openModel(slug)}
              onRename={(slug, name) => controller.renameModel(slug, name)}
              onMove={(slug, folder) => controller.moveModel(slug, folder)}
              onTrash={trashModel}
              onRestore={(slug) => controller.restoreModel(slug)}
              search={async (query) =>
                findAcrossModels(
                  (await controller.readAllModels()).map(
                    ({ entry, model, tool }) => ({
                      slug: entry.slug,
                      name: entry.name,
                      model,
                      tool,
                    }),
                  ),
                  query,
                )}
              onOpenHit={async (hit) => {
                await controller.openModel(hit.slug);
                selectElement?.(hit.element);
              }}
              onExportModel={(slug) => controller.exportModelFile(slug)}
              onExportBundle={(slug) => controller.exportBundle([slug])}
              onExportCsv={(slug) => controller.exportCsv(slug)}
              onImport={(files) => controller.importFiles(files)}
            />
          {/if}
        </div>
        {#if docsVisited}
          <div class="docs-area" hidden={!docsArea}>
            <DocsPage request={docsRequest} />
          </div>
        {/if}
      </div>
      {#if docs.open}
        <DocsPanel onClose={closeDocs} onOpenInDocs={openInDocs} />
      {/if}
    </div>
  </div>

  {#if app.toolImport}
    <ToolImportDialog
      plan={app.toolImport}
      onConfirm={() => controller.confirmToolImport()}
      onCancel={() => controller.cancelToolImport()}
    />
  {/if}
  {#if showNew}
    <NewModelDialog
      tools={app.tools}
      builtIns={BUILT_IN_TOOLS.filter(
        (b) => !app.tools.some((t) => t.id === b.id),
      ).map((b) => ({ key: builtInKey(b), name: b.name, version: b.version }))}
      loadModelTypes={modelTypesFor}
      {folders}
      initialFolder=""
      onCreate={create}
      onCancel={() => (showNew = false)}
    />
  {/if}
{/if}

{#if showAssistant}
  <ModalPanel
    label="Assistant"
    testid="assistant-panel"
    onClose={() => (showAssistant = false)}
  >
    <AssistantSettings service={assistant} tool={app.build?.store.state} />
    <div class="panel-actions">
      <button
        class="primary"
        onclick={() => (showAssistant = false)}
        data-testid="assistant-close">Close</button
      >
    </div>
  </ModalPanel>
{/if}

{#if app.git.settings}
  <ModalPanel
    label="Git settings"
    onClose={() => controller.openGitSettings(false)}
  >
    {#if app.git.error}<p
        role="alert"
        class="notice error"
        data-testid="git-open-error"
      >
        {app.git.error}
      </p>{/if}
    <GitSettings
      store={controller.gitTokens}
      makeRemote={(service, host, repo, folder, token) =>
        controller.makeGitRemote(service, host, repo, folder, token)}
      onChoose={(target) => controller.openFromGit(target)}
      onClose={() => controller.openGitSettings(false)}
    />
  </ModalPanel>
{/if}

{#if app.permissionAsk}
  <PermissionDialog
    toolName={app.permissionAsk.toolName}
    wanted={app.permissionAsk.wanted}
    onAllow={() => controller.answerPermission(true)}
    onDeny={() => controller.answerPermission(false)}
  />
{/if}

{#if profile === null && supported}
  <ProfileDialog
    initial={{
      name: '',
      colour:
        PROFILE_COLOURS[Math.floor(Math.random() * PROFILE_COLOURS.length)]!,
    }}
    colours={PROFILE_COLOURS}
    onSave={chooseProfile}
  />
{:else if showProfile}
  <ProfileDialog
    initial={{ name: app.me.name, colour: app.me.colour }}
    colours={PROFILE_COLOURS}
    onSave={async (chosen) => {
      await chooseProfile(chosen);
      showProfile = false;
    }}
    onCancel={() => (showProfile = false)}
  />
{/if}

<ConfirmDialog />
<Toast />

<style>
  .shell {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--app-bg);
  }
  .row {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .start-row {
    height: 100dvh;
    background: var(--app-bg);
  }
  .start-scroll {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
  .content {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .views {
    height: 100%;
  }
  /* Hidden but still laid out, so the canvas keeps its size and nothing reloads. */
  .views.covered {
    visibility: hidden;
  }
  .docs-area {
    position: absolute;
    inset: 0;
    background: var(--app-bg);
  }
  .docs-area[hidden] {
    display: none;
  }
  .panel-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
