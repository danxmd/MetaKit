<script lang="ts">
  import { onMount } from 'svelte';
  import {
    AppController,
    ReferenceIndex,
    type ReferenceServices,
  } from '@metakit-app/ui';
  import type { ElementId } from '@metakit-app/core';
  import BuildView from '@metakit-app/ui/components/BuildView.svelte';
  import AssistantSettings from '@metakit-app/ui/components/assistant/AssistantSettings.svelte';
  import {
    AssistantService,
    browserKeyValue,
    typeCheckWithClient,
  } from '@metakit-app/ui/assistant';
  import GitSettings from '@metakit-app/ui/components/git/GitSettings.svelte';
  import Explorer from '@metakit-app/ui/components/Explorer.svelte';
  import ModelView from '@metakit-app/ui/components/ModelView.svelte';
  import NewModelDialog from '@metakit-app/ui/components/NewModelDialog.svelte';
  import PermissionDialog from '@metakit-app/ui/components/build/scripts/PermissionDialog.svelte';
  import ProfileDialog from '@metakit-app/ui/components/ProfileDialog.svelte';
  import StartPage from '@metakit-app/ui/components/StartPage.svelte';
  import { findAcrossModels } from '@metakit-app/ui';
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

  onMount(async () => {
    const stored = await loadProfile();
    if (stored) controller.setProfile(stored);
    profile = stored;
    if (supported) remembered = await rememberedFolder();
  });

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

  const folders = $derived(
    [
      ...new Set(app.models.flatMap((m) => (m.folder ? [m.folder] : []))),
    ].sort(),
  );

  async function create(input: Parameters<typeof controller.createModel>[0]) {
    showNew = false;
    await controller.createModel(input);
  }
</script>

{#if app.phase === 'start'}
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
  />
{:else if app.phase === 'build' && app.build}
  {#key app.build.slug}
    <BuildView {assistant} {app} {controller} onBack={() => undefined} />
  {/key}
{:else if app.phase === 'workspace' || !app.open}
  <Explorer
    workspaceName={app.workspaceName}
    models={app.models}
    trashed={app.trashed}
    tools={app.tools}
    trashedTools={app.trashedTools}
    health={app.health}
    warnings={app.warnings}
    error={app.error}
    onNew={() => (showNew = true)}
    onGit={() => controller.openGitSettings(true)}
    onAssistant={() => (showAssistant = true)}
    onAddTool={(text) => controller.addToolLibrary(text)}
    onNewTool={(name) => controller.createToolLibrary(name)}
    onEditTool={(slug) => controller.openBuild(slug)}
    onOpen={(slug) => controller.openModel(slug)}
    onRename={(slug, name) => controller.renameModel(slug, name)}
    onMove={(slug, folder) => controller.moveModel(slug, folder)}
    onTrash={(slug) => controller.trashModel(slug)}
    onRestore={(slug) => controller.restoreModel(slug)}
    onTrashTool={(slug) => controller.trashTool(slug)}
    onRestoreTool={(slug) => controller.restoreTool(slug)}
    onClose={() => controller.closeWorkspace()}
    notes={app.notes}
    toolImport={app.toolImport}
    search={async (query) =>
      findAcrossModels(
        (await controller.readAllModels()).map(({ entry, model, tool }) => ({
          slug: entry.slug,
          name: entry.name,
          model,
          tool,
        })),
        query,
      )}
    onOpenHit={async (hit) => {
      await controller.openModel(hit.slug);
      selectElement?.(hit.element);
    }}
    onExportModel={(slug) => controller.exportModelFile(slug)}
    onExportBundle={(slugs) => controller.exportBundle(slugs)}
    onExportCsv={(slug) => controller.exportCsv(slug)}
    onExportTool={(slug) => controller.exportToolPackage(slug)}
    onImport={(files) => controller.importFiles(files)}
    onConfirmToolImport={() => controller.confirmToolImport()}
    onCancelToolImport={() => controller.cancelToolImport()}
  />
  {#if showNew}
    <NewModelDialog
      tools={app.tools}
      loadModelTypes={(slug) => controller.modelTypesOf(slug)}
      {folders}
      initialFolder=""
      onCreate={create}
      onCancel={() => (showNew = false)}
    />
  {/if}
{:else}
  {#key app.open.slug}
    <ModelView
      {app}
      {controller}
      {references}
      registerOpenElement={(fn) => (selectElement = fn)}
      onBack={() => controller.closeModel()}
    />
  {/key}
{/if}

{#if showAssistant}
  <div class="assistant-panel" data-testid="assistant-panel">
    <button
      onclick={() => (showAssistant = false)}
      data-testid="assistant-close">Close</button
    >
    <AssistantSettings service={assistant} tool={app.build?.store.state} />
  </div>
{/if}

{#if app.git.settings}
  <GitSettings
    store={controller.gitTokens}
    makeRemote={(service, host, repo, folder, token) =>
      controller.makeGitRemote(service, host, repo, folder, token)}
    onChoose={(target) => controller.openFromGit(target)}
    onClose={() => controller.openGitSettings(false)}
  />
  {#if app.git.error}<p
      role="alert"
      class="git-error"
      data-testid="git-open-error"
    >
      {app.git.error}
    </p>{/if}
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
{/if}

<style>
  .assistant-panel {
    position: fixed;
    inset: 4rem 1rem auto auto;
    z-index: 50;
    width: min(32rem, calc(100vw - 2rem));
    max-height: 80vh;
    overflow: auto;
    padding: 1rem;
    background: var(--panel, #fff);
    border: 1px solid var(--line, #ccc);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgb(0 0 0 / 20%);
  }
</style>
