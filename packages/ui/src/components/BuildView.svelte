<script lang="ts">
  import type { DocContext } from '@metakit-app/docs';
  import { openDocs, pushDocsContext } from '../docs/context';
  import {
    effectiveAttributes,
    effectiveRelationAttributes,
    findKeyUsages,
    newId,
    type ClassId,
    type KeyOwner,
    type NodeShape,
    type ModelTypeId,
    type RelationId,
    type Kit,
  } from '@metakit-app/core';
  import { uniqueKey } from '../build/attributes';
  import type { AppState, BuildPort } from '../shell/controller';
  import { menuBehaviour } from '../shell/menu-action';
  import { tours, type TourRun } from '../tours/tour-state';
  import Icon from './Icon.svelte';
  import { confirmAction } from '../shell/feedback';
  import { provideBuildUndo, useBuildUndo } from '../build/undo-context';
  import type { AssistantPort } from '../assistant/assistant-service';
  import CommitDialog from './git/CommitDialog.svelte';
  import ConflictDialog from './git/ConflictDialog.svelte';
  import ReleasePicker from './git/ReleasePicker.svelte';
  import ClassEditor from './build/ClassEditor.svelte';
  import ModelTypeEditor from './build/ModelTypeEditor.svelte';
  import RelationEditor from './build/RelationEditor.svelte';
  import ScriptsSection from './build/scripts/ScriptsSection.svelte';
  import RulesSection from './build/rules/RulesSection.svelte';
  import SettingsEditor from './build/SettingsEditor.svelte';
  import ShapesSection from './build/ShapesSection.svelte';
  import KitPreview from './build/KitPreview.svelte';
  import PanelLayoutEditor from './PanelLayoutEditor.svelte';
  import ShapeEditor from './shape-editor/ShapeEditor.svelte';
  import { defaultLayout } from '../build/panel-layout-model';
  import {
    newNodeLookShape,
    newRelationLookShape,
  } from '../build/appearance-model';
  import AppearanceEditor from './build/appearance/AppearanceEditor.svelte';
  import type { CatalogAddResult } from '../build/catalog/catalog';
  import type CatalogDialogType from './build/CatalogDialog.svelte';
  import RelationLookEditor from './build/appearance/RelationLookEditor.svelte';

  let {
    app,
    controller,
    onBack,
    assistant,
  }: {
    app: AppState;
    controller: BuildPort;
    onBack: () => void;
    /** The optional assistant; the "Draft with assistant" buttons appear only when it is on. */
    assistant?: AssistantPort;
  } = $props();

  provideBuildUndo(() => controller.buildUndoSource());
  const offerUndo = useBuildUndo();

  type Section =
    | 'classes'
    | 'relations'
    | 'modelTypes'
    | 'shapes'
    | 'rules'
    | 'scripts'
    | 'settings';
  const LABELS: Record<Section, string> = {
    classes: 'Classes',
    relations: 'Relation classes',
    modelTypes: 'Model types',
    shapes: 'Shapes',
    rules: 'Rules',
    scripts: 'Scripts',
    settings: 'Settings',
  };
  // Panel layouts are reached from a class or relation class ("Panel layout" in its editor).
  const GROUPS: { id: string; title: string; sections: Section[] }[] = [
    {
      id: 'metamodel',
      title: 'Metamodel',
      sections: ['classes', 'relations', 'modelTypes'],
    },
    { id: 'appearance', title: 'Appearance', sections: ['shapes'] },
    { id: 'behaviour', title: 'Behaviour', sections: ['rules', 'scripts'] },
    { id: 'kit', title: 'Kit', sections: ['settings'] },
  ];
  // The topic the "?" button of the header opens for each page of Build mode.
  const HELP_TOPIC: Partial<Record<DocContext, string>> = {
    'build.classes': 'classes',
    'build.relations': 'relations',
    'build.modelTypes': 'model-types',
    'build.shapes': 'shapes-section',
    'build.rules': 'rules',
    'build.scripts': 'scripts',
    'build.settings': 'kit-settings',
    'build.panel-layout': 'panel-layout',
    'build.appearance': 'appearance-editor',
    'build.shape-editor': 'shape-editor',
  };
  const NEW_LABEL: Record<string, string> = {
    classes: 'New class',
    relations: 'New relation class',
    modelTypes: 'New model type',
  };
  const NEW_PLACEHOLDER: Record<string, string> = {
    classes: 'For example Task',
    relations: 'For example Assigned to',
    modelTypes: 'For example Process map',
  };
  const EMPTY_LIST: Record<string, string> = {
    classes:
      'A class describes one kind of object, such as Task. Add your first class above.',
    relations:
      'A relation class describes how two kinds of object connect, such as Assigned to. Add one above.',
    modelTypes:
      'A model type chooses which classes and relations a modeller can use in one kind of model. Add one above.',
  };
  const EMPTY_TITLE: Record<string, string> = {
    classes: 'No class selected',
    relations: 'No relation class selected',
    modelTypes: 'No model type selected',
  };
  const EMPTY_HELP: Record<string, string> = {
    classes: 'Choose a class in the list, or add a new one.',
    relations: 'Choose a relation class in the list, or add a new one.',
    modelTypes: 'Choose a model type in the list, or add a new one.',
  };

  const build = $derived(app.build!);
  // Reading `revision` makes this run again after every change to the Kit.
  const kit = $derived.by((): Kit => {
    void build.revision;
    return build.store.state;
  });
  const language = $derived(kit.manifest.languages[0] ?? 'en');

  let section = $state<Section>('classes');
  let selected = $state<Record<string, string | undefined>>({});
  let newName = $state('');
  let message = $state<string | null>(null);
  // What the last catalog add did; cleared by the next change.
  let note = $state<string | null>(null);
  // The catalog and its dialog load on first use, so they stay out of the main bundle.
  let CatalogDialog = $state<typeof CatalogDialogType | null>(null);
  let catalogOpen = $state(false);
  let overlay = $state<
    | { kind: 'panel'; id: string }
    | { kind: 'shape'; id: string }
    | { kind: 'appearance'; id: string }
    | null
  >(null);
  // A Build tour starts on the plain Build view: an editor left open would cover what it shows.
  let lastRun: TourRun | null = null;
  $effect(() =>
    tours.subscribe(({ run }) => {
      const started =
        run !== null &&
        run !== lastRun &&
        run.index === 0 &&
        run.direction === 1;
      if (started && run.tour.page === 'build') {
        overlay = null;
        catalogOpen = false;
      }
      lastRun = run;
    }),
  );
  // A line shape whose form the Shapes list opens first (a relation class asked to edit it).
  let openLine = $state<string | null>(null);
  // What Help shows: an open editor wins over the section behind it.
  const docsContextNow = $derived<DocContext>(
    overlay?.kind === 'panel'
      ? 'build.panel-layout'
      : overlay?.kind === 'appearance'
        ? 'build.appearance'
        : overlay?.kind === 'shape'
          ? 'build.shape-editor'
          : `build.${section}`,
  );
  $effect(() => pushDocsContext(docsContextNow));
  let showPreview = $state(true);
  let committing = $state(false);
  const git = $derived(app.git);

  function openCommit() {
    controller.gitRefreshPending();
    committing = true;
  }
  async function commit(text: string) {
    if (await controller.gitCommit(text)) committing = false;
  }

  const run = (command: never) => {
    const result = controller.runBuild(command);
    if (!result.ok) message = result.error;
    else message = null;
    note = null;
    return result;
  };

  async function openCatalog() {
    catalogOpen = true;
    try {
      CatalogDialog ??= (await import('./build/CatalogDialog.svelte')).default;
    } catch {
      catalogOpen = false;
      message =
        'The catalog could not be loaded. Check the connection and try again.';
    }
  }

  function addFromCatalog(result: CatalogAddResult, text: string): boolean {
    const outcome = run(result.batch as never);
    if (!outcome.ok) return false;
    const first = result.added.classes[0];
    if (first) selected = { ...selected, classes: first.id };
    note = text;
    return true;
  }

  const items = $derived.by(() => {
    const labelOf = (x: {
      id: string;
      key: string;
      labels: Record<string, string>;
    }) => ({
      id: x.id,
      key: x.key,
      text: x.labels[language] ?? x.key,
    });
    if (section === 'classes') return Object.values(kit.classes).map(labelOf);
    if (section === 'relations')
      return Object.values(kit.relations).map(labelOf);
    if (section === 'modelTypes')
      return Object.values(kit.modelTypes).map(labelOf);
    return [];
  });
  const sortedItems = $derived(
    [...items].sort((a, b) => a.key.localeCompare(b.key)),
  );
  const current = $derived(selected[section]);
  const isListSection = $derived(
    section === 'classes' ||
      section === 'relations' ||
      section === 'modelTypes',
  );
  const counts = $derived<Partial<Record<Section, number>>>({
    classes: Object.keys(kit.classes).length,
    relations: Object.keys(kit.relations).length,
    modelTypes: Object.keys(kit.modelTypes).length,
    shapes: Object.keys(kit.shapes).length,
  });

  function add() {
    const name = newName.trim();
    if (name === '') {
      message = 'Type a name first.';
      return;
    }
    const taken = items.map((i) => i.key);
    const key = uniqueKey(name, taken);
    const labels = { [language]: name };
    let result;
    if (section === 'classes') {
      const id = newId('class');
      // A new class starts with a good look, so it never needs drawing.
      const shape = newNodeLookShape(key, 'node');
      result = run({
        type: 'batch',
        commands: [
          { type: 'putShape', def: shape },
          {
            type: 'putClass',
            def: {
              id,
              key,
              kind: 'node',
              labels,
              attributes: [],
              shape: shape.id,
            },
          },
        ],
      } as never);
      if (result.ok) selected = { ...selected, classes: id };
    } else if (section === 'relations') {
      const id = newId('relation');
      const shape = newRelationLookShape(key);
      result = run({
        type: 'batch',
        commands: [
          { type: 'putShape', def: shape },
          {
            type: 'putRelation',
            def: {
              id,
              key,
              labels,
              from: [],
              to: [],
              attributes: [],
              shape: shape.id,
            },
          },
        ],
      } as never);
      if (result.ok) selected = { ...selected, relations: id };
    } else if (section === 'modelTypes') {
      const id = newId('modelType');
      result = run({
        type: 'putModelType',
        def: {
          id,
          key,
          labels,
          classes: [],
          relations: [],
          views: [],
          cardinalities: [],
          attributes: [],
        },
      } as never);
      if (result.ok) selected = { ...selected, modelTypes: id };
    }
    if (result?.ok) newName = '';
  }

  const KIND_NAMES = {
    classes: 'class',
    relations: 'relation class',
    modelTypes: 'model type',
  } as const;

  /** Deletes at once; the toast offers Undo (ui-coherence: no confirm for undoable steps). */
  function remove(id: string, key: string) {
    if (
      section !== 'classes' &&
      section !== 'relations' &&
      section !== 'modelTypes'
    )
      return;
    const command =
      section === 'classes'
        ? { type: 'removeClass', id }
        : section === 'relations'
          ? { type: 'removeRelation', id }
          : { type: 'removeModelType', id };
    const result = run(command as never);
    if (!result.ok) return;
    if (selected[section] === id)
      selected = { ...selected, [section]: undefined };
    offerUndo(`Deleted ${KIND_NAMES[section]} ${key}`);
  }

  const usagesFor = (owner: KeyOwner) => (attributeId: string) =>
    findKeyUsages(kit, { kind: 'attribute', owner, id: attributeId as never });

  function editPanel(classId: string) {
    if (!kit.panels[classId]) {
      const defs = classId.startsWith('rel_')
        ? effectiveRelationAttributes(kit, classId as RelationId)
        : effectiveAttributes(kit, classId as ClassId);
      const result = run({
        type: 'putPanel',
        layout: defaultLayout(classId as ClassId, defs),
      } as never);
      if (!result.ok) return;
    }
    overlay = { kind: 'panel', id: classId };
  }

  /**
   * Opens the advanced drawing editor. A shape made from a simple look becomes a hand-drawn one
   * once it is edited as a drawing, so that is confirmed first.
   */
  async function editShape(id: string) {
    const shape = kit.shapes[id as keyof typeof kit.shapes];
    if (!shape) return;
    if (
      shape.look &&
      !(await confirmAction({
        title: 'Edit as a drawing?',
        message:
          'This turns the look into a hand-drawn one. The simple controls will no longer work for it.',
        action: 'Edit as drawing',
      }))
    )
      return;
    if (shape.kind === 'relation') {
      openLine = id;
      section = 'shapes';
    } else overlay = { kind: 'shape', id };
  }

  function rename(text: string) {
    if (text.trim() === '' || text === kit.manifest.name) return;
    run({ type: 'updateManifest', name: text.trim() } as never);
  }
  function setVersion(text: string) {
    if (text === kit.manifest.version) return;
    if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(text)) {
      message = 'A version looks like 1.0.0.';
      return;
    }
    run({ type: 'updateManifest', version: text } as never);
  }

  const status = $derived(
    app.sync.error
      ? app.sync.error
      : app.sync.pending > 0
        ? 'Saving…'
        : 'Saved',
  );

  async function back() {
    await controller.closeBuild();
    onBack();
  }
</script>

<div class="build" data-testid="build-view">
  <header class="bar">
    <button
      type="button"
      class="ghost"
      onclick={back}
      data-testid="build-back"
      data-tour="build-back">← Kits</button
    >
    <input
      class="name"
      value={kit.manifest.name}
      onchange={(e) => rename(e.currentTarget.value)}
      aria-label="Kit name"
      data-testid="build-name"
    />
    <label class="version"
      >Version <input
        value={kit.manifest.version}
        onchange={(e) => setVersion(e.currentTarget.value)}
        data-testid="build-version"
      /></label
    >
    <span class="status" data-testid="build-status">{status}</span>
    <span class="spacer"></span>
    <button
      type="button"
      class="icon ghost"
      disabled={!build.canUndo}
      onclick={() => controller.undoBuild()}
      title="Undo"
      aria-label="Undo"
      data-testid="build-undo"
      data-tour="build-undo"><Icon name="undo" /></button
    >
    <button
      type="button"
      class="icon ghost"
      disabled={!build.canRedo}
      onclick={() => controller.redoBuild()}
      title="Redo"
      aria-label="Redo"
      data-testid="build-redo"><Icon name="redo" /></button
    >
    {#if git.link}
      <details class="menu" use:menuBehaviour data-testid="git-menu">
        <summary data-testid="git-menu-summary" data-tour="build-git"
          >Source control</summary
        >
        <div class="menu-list right">
          <div class="menu-heading">Linked repository</div>
          <div class="repo">
            <span
              class="badge accent"
              data-testid="git-repo"
              title="Linked repository"
              >{git.link.repo} · {git.link.branch}</span
            >
          </div>
          <div class="menu-sep"></div>
          <button
            type="button"
            onclick={() => openCommit()}
            data-testid="git-commit"
            >Commit and push{git.pending.length > 0
              ? ` (${git.pending.length})`
              : ''}</button
          >
          <button
            type="button"
            disabled={git.busy}
            onclick={() => controller.gitPull()}
            data-testid="git-pull">Pull</button
          >
          <button
            type="button"
            disabled={git.busy}
            onclick={() => controller.gitLoadReleases()}
            data-testid="git-releases">Releases</button
          >
        </div>
      </details>
    {/if}
    <button
      type="button"
      class="icon"
      onclick={() => openDocs(HELP_TOPIC[docsContextNow])}
      title="Help on this section"
      aria-label="Help on this section"
      data-testid="build-help">?</button
    >
    <button
      type="button"
      aria-pressed={showPreview}
      onclick={() => (showPreview = !showPreview)}
      data-testid="build-preview-toggle"
      data-tour="build-try">Try it</button
    >
  </header>
  {#if git.note}<p class="notice success" data-testid="git-note">
      {git.note}
    </p>{/if}
  {#if git.error && !committing}<p
      class="notice error"
      role="alert"
      data-testid="git-error"
    >
      {git.error}
    </p>{/if}
  {#if committing}
    <CommitDialog
      changes={git.pending}
      busy={git.busy}
      error={git.error}
      onCommit={commit}
      onCancel={() => (committing = false)}
    />
  {/if}
  {#if git.conflicts}
    <ConflictDialog
      conflicts={git.conflicts.conflicts}
      busy={git.busy}
      error={git.error}
      onApply={(choices) => controller.gitResolve(choices)}
      onCancel={() => controller.gitCancelPull()}
    />
  {/if}
  {#if git.releases}
    <ReleasePicker
      releases={git.releases}
      busy={git.busy}
      error={git.error}
      onPick={(name) => {
        const tag = git.releases?.find((t) => t.name === name);
        if (tag) controller.gitUseRelease(tag);
      }}
      onCancel={() => controller.gitCloseReleases()}
    />
  {/if}
  {#if message}<p class="notice error" role="alert" data-testid="build-message">
      {message}
    </p>{/if}
  {#if note}<p
      class="notice success"
      role="status"
      data-testid="catalog-result"
    >
      {note}
    </p>{/if}
  {#if build.issues.length > 0}
    <details class="notice warning issues" data-testid="build-issues">
      <summary
        >{build.issues.length} problem{build.issues.length === 1 ? '' : 's'} in this
        Kit</summary
      >
      <ul>
        {#each build.issues.slice(0, 20) as issue (issue.path + issue.message)}<li
          >
            {issue.path}: {issue.message}
          </li>{/each}
      </ul>
    </details>
  {/if}

  <div class="body">
    <nav aria-label="Kit sections" data-tour="build-sections">
      {#each GROUPS as group (group.id)}
        <div class="group" role="group" aria-labelledby="grp-{group.id}">
          <h3 id="grp-{group.id}" class="group-title">{group.title}</h3>
          <div role="tablist" aria-orientation="vertical">
            {#each group.sections as id (id)}
              <button
                type="button"
                role="tab"
                aria-selected={section === id}
                class="tab"
                class:on={section === id}
                onclick={() => (section = id)}
                data-testid="build-tab-{id}"
                data-tour="build-tab-{id}"
                ><span>{LABELS[id]}</span>
                {#if counts[id] !== undefined}<span class="count"
                    >{counts[id]}</span
                  >{/if}</button
              >
            {/each}
          </div>
        </div>
      {/each}
    </nav>
    {#if isListSection}
      <section class="items" aria-label={LABELS[section]}>
        <form
          class="new"
          data-tour="build-new"
          onsubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label for="build-new-name">{NEW_LABEL[section]}</label>
          <div class="new-row">
            <input
              id="build-new-name"
              bind:value={newName}
              placeholder={NEW_PLACEHOLDER[section]}
              data-testid="build-new-name"
            />
            <button type="submit" class="primary" data-testid="build-add"
              >Add</button
            >
          </div>
        </form>
        {#if section === 'classes'}
          <button
            type="button"
            class="catalog-open"
            onclick={openCatalog}
            data-testid="catalog-open"
            data-tour="build-catalog">Add from catalog…</button
          >
        {/if}
        {#if sortedItems.length === 0}
          <p class="empty muted" data-testid="build-list-empty">
            {EMPTY_LIST[section]}
          </p>
        {:else}
          <ul class="list">
            {#each sortedItems as item, i (item.id)}
              <li class:on={current === item.id}>
                <button
                  type="button"
                  class="pick"
                  aria-current={current === item.id ? 'true' : undefined}
                  onclick={() =>
                    (selected = { ...selected, [section]: item.id })}
                  data-testid="build-item-{item.key}"
                  data-tour={(current ? current === item.id : i === 0)
                    ? 'build-item'
                    : undefined}
                  >{item.key}<small
                    >{item.text !== item.key ? item.text : ''}</small
                  ></button
                >
                <button
                  type="button"
                  class="ghost icon delete"
                  onclick={() => remove(item.id, item.key)}
                  title="Delete {item.key}"
                  aria-label="Delete {item.key}"
                  data-testid="build-delete-{item.key}">✕</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
    <main data-tour="build-editor">
      {#if section === 'classes' && current && kit.classes[current as ClassId]}
        {#key current}
          <ClassEditor
            {assistant}
            {kit}
            id={current as ClassId}
            {run}
            onEditShape={editShape}
            onEditAppearance={(cid) =>
              (overlay = { kind: 'appearance', id: cid })}
            onEditPanel={editPanel}
            usages={usagesFor({ kind: 'class', id: current as ClassId })}
          />
        {/key}
      {:else if section === 'relations' && current && kit.relations[current as RelationId]}
        {#key current}
          <RelationEditor
            {kit}
            id={current as RelationId}
            {run}
            onEditShape={editShape}
            onEditAppearance={(rid) =>
              (overlay = { kind: 'appearance', id: rid })}
            usages={usagesFor({ kind: 'relation', id: current as RelationId })}
          />
        {/key}
      {:else if section === 'modelTypes' && current && kit.modelTypes[current as ModelTypeId]}
        {#key current}
          <ModelTypeEditor
            {kit}
            id={current as ModelTypeId}
            {run}
            usages={usagesFor({
              kind: 'modelType',
              id: current as ModelTypeId,
            })}
          />
        {/key}
      {:else if section === 'shapes'}
        <ShapesSection
          {assistant}
          {kit}
          {run}
          onEditShape={editShape}
          onEditAppearance={(oid) =>
            (overlay = { kind: 'appearance', id: oid })}
          open={openLine}
        />
      {:else if section === 'rules'}
        <RulesSection {kit} {run} {assistant} />
      {:else if section === 'scripts'}
        <ScriptsSection {kit} {run} {assistant} />
      {:else if section === 'settings'}
        <SettingsEditor {kit} {run} />
      {:else}
        <div class="empty-state" data-testid="build-empty">
          <h2>{EMPTY_TITLE[section]}</h2>
          <p class="muted">{EMPTY_HELP[section]}</p>
        </div>
      {/if}
    </main>
    {#if showPreview}
      <aside class="dock" aria-label="Try it">
        <KitPreview {kit} onCollapse={() => (showPreview = false)} />
      </aside>
    {/if}
  </div>

  {#if overlay?.kind === 'shape'}
    {@const id = overlay.id}
    {@const shape = kit.shapes[id as keyof typeof kit.shapes]}
    {#if shape?.kind === 'node'}
      {@const user = Object.values(kit.classes).find((c) => c.shape === id)}
      <div
        class="overlay"
        role="dialog"
        aria-label="Advanced drawing editor"
        data-testid="shape-overlay"
      >
        {#key id}
          <ShapeEditor
            shape={shape as NodeShape}
            attributes={user ? effectiveAttributes(kit, user.id) : []}
            className={user?.key ?? ''}
            shapes={(sid) => kit.shapes[sid]}
            onChange={(next) => run({ type: 'putShape', def: next } as never)}
            onClose={() => (overlay = null)}
          />
        {/key}
      </div>
    {/if}
  {/if}

  {#if overlay?.kind === 'appearance'}
    {@const id = overlay.id}
    {#if id.startsWith('rel_') && kit.relations[id as RelationId]}
      <div
        class="overlay"
        role="dialog"
        aria-label="Appearance of a relation"
        data-testid="appearance-overlay"
      >
        {#key id}
          <RelationLookEditor
            {kit}
            relationId={id as RelationId}
            {run}
            onClose={() => (overlay = null)}
          />
        {/key}
      </div>
    {:else if kit.classes[id as ClassId]}
      <div
        class="overlay"
        role="dialog"
        aria-label="Appearance of a concept"
        data-testid="appearance-overlay"
      >
        {#key id}
          <AppearanceEditor
            {kit}
            classId={id as ClassId}
            {run}
            onClose={() => (overlay = null)}
          />
        {/key}
      </div>
    {/if}
  {/if}

  {#if catalogOpen && CatalogDialog}
    <CatalogDialog
      {kit}
      onAdd={addFromCatalog}
      onClose={() => (catalogOpen = false)}
    />
  {/if}

  {#if overlay?.kind === 'panel'}
    {@const id = overlay.id}
    {@const layout = kit.panels[id]}
    {#if layout}
      <div
        class="overlay"
        role="dialog"
        aria-label="Panel layout"
        data-testid="panel-overlay"
      >
        <PanelLayoutEditor
          {layout}
          attributes={id.startsWith('rel_')
            ? effectiveRelationAttributes(kit, id as RelationId)
            : effectiveAttributes(kit, id as ClassId)}
          onChange={(next) => run({ type: 'putPanel', layout: next } as never)}
          onClose={() => (overlay = null)}
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .build {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--app-bg);
  }
  .bar {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
    padding: var(--gap-2) var(--gap-4);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .name {
    font-size: var(--text-m);
    font-weight: 650;
    min-width: 12rem;
  }
  .version {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
  }
  .version input {
    width: 6rem;
  }
  .spacer {
    flex: 1;
  }
  .status {
    color: var(--text-muted);
    font-size: var(--text-s);
  }
  .repo {
    padding: 0.2rem 0.6rem;
  }
  .notice {
    margin: 0;
    border-radius: 0;
    border-width: 0 0 1px;
  }
  .issues ul {
    margin: var(--gap-2) 0 0;
    padding-left: 1.2rem;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  nav {
    flex: 0 0 13rem;
    background: var(--surface);
    border-right: 1px solid var(--line);
    padding: var(--gap-3);
    overflow: auto;
    display: grid;
    align-content: start;
    gap: var(--gap-4);
  }
  .group-title {
    font-size: 0.7rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    padding: 0 var(--gap-2) var(--gap-1);
  }
  .group [role='tablist'] {
    display: grid;
    gap: 2px;
  }
  .tab {
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: left;
    border-color: transparent;
    background: transparent;
  }
  .tab.on {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
  .count {
    font-size: 0.72rem;
    color: var(--text-faint);
  }
  .items {
    flex: 0 0 15rem;
    background: var(--surface);
    border-right: 1px solid var(--line);
    padding: var(--gap-3);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--gap-3);
  }
  .new {
    display: grid;
    gap: var(--gap-1);
  }
  .new-row {
    display: flex;
    gap: var(--gap-1);
  }
  .catalog-open {
    margin-top: calc(-1 * var(--gap-2));
  }
  .new-row input {
    flex: 1;
    min-width: 0;
    width: 0;
  }
  .empty {
    font-size: var(--text-s);
    margin: 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .list li {
    display: flex;
    gap: 2px;
    border-radius: var(--radius-s);
  }
  .list li.on {
    background: var(--accent-soft);
  }
  .pick {
    flex: 1;
    min-width: 0;
    text-align: left;
    display: flex;
    gap: var(--gap-2);
    align-items: baseline;
    border-color: transparent;
    background: transparent;
  }
  .list li.on .pick {
    color: var(--accent);
    font-weight: 600;
  }
  .pick small {
    color: var(--text-muted);
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .delete {
    color: var(--text-faint);
    opacity: 0;
  }
  .list li:hover .delete,
  .delete:focus-visible {
    opacity: 1;
  }
  main {
    flex: 1;
    min-width: 0;
    padding: var(--gap-5);
    overflow: auto;
  }
  .empty-state {
    max-width: 28rem;
    display: grid;
    gap: var(--gap-2);
    padding: var(--gap-6) 0;
  }
  .dock {
    flex: 0 0 24rem;
    min-height: 0;
    background: var(--surface);
    border-left: 1px solid var(--line);
    padding: var(--gap-3);
    display: flex;
    flex-direction: column;
  }
  /* One look for the pieces every editor shares, so each editor keeps only its own layout. */
  main :global(h2) {
    margin-bottom: var(--gap-1);
  }
  main :global(.problem) {
    margin: 0;
    padding: var(--gap-2) var(--gap-3);
    border-radius: var(--radius);
    background: var(--danger-soft);
    color: var(--danger);
    font-size: var(--text-s);
  }
  main :global(.confirm) {
    padding: var(--gap-2) var(--gap-3);
    border-radius: var(--radius);
    background: var(--warning-soft);
    font-size: var(--text-s);
  }
  main :global(fieldset) {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }
  main :global(button.ghost.danger) {
    border-color: transparent;
  }
  main :global(.muted) {
    color: var(--text-muted);
  }
  .overlay {
    position: absolute;
    inset: 0;
    background: var(--app-bg);
    overflow: auto;
    padding: var(--gap-4);
    z-index: 20;
  }
</style>
