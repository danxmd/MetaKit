<script lang="ts">
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
    type ToolLibrary,
  } from '@metakit-app/core';
  import { uniqueKey } from '../build/attributes';
  import type { AppState, BuildPort } from '../shell/controller';
  import ClassEditor from './build/ClassEditor.svelte';
  import ModelTypeEditor from './build/ModelTypeEditor.svelte';
  import RelationEditor from './build/RelationEditor.svelte';
  import SettingsEditor from './build/SettingsEditor.svelte';
  import ShapesSection from './build/ShapesSection.svelte';
  import ToolPreview from './build/ToolPreview.svelte';
  import PanelLayoutEditor from './PanelLayoutEditor.svelte';
  import ShapeEditor from './shape-editor/ShapeEditor.svelte';
  import { defaultLayout } from '../build/panel-layout-model';

  let {
    app,
    controller,
    onBack,
  }: { app: AppState; controller: BuildPort; onBack: () => void } = $props();

  type Section = 'classes' | 'relations' | 'modelTypes' | 'shapes' | 'settings';
  const SECTIONS: [Section, string][] = [
    ['classes', 'Classes'],
    ['relations', 'Relation classes'],
    ['modelTypes', 'Model types'],
    ['shapes', 'Shapes'],
    ['settings', 'Settings'],
  ];

  const build = $derived(app.build!);
  // Reading `revision` makes this run again after every change to the tool library.
  const tool = $derived.by((): ToolLibrary => {
    void build.revision;
    return build.store.state;
  });
  const language = $derived(tool.manifest.languages[0] ?? 'en');

  let section = $state<Section>('classes');
  let selected = $state<Record<string, string | undefined>>({});
  let newName = $state('');
  let message = $state<string | null>(null);
  let overlay = $state<
    { kind: 'panel'; id: string } | { kind: 'shape'; id: string } | null
  >(null);
  let showPreview = $state(true);

  const run = (command: never) => {
    const result = controller.runBuild(command);
    if (!result.ok) message = result.error;
    else message = null;
    return result;
  };

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
    if (section === 'classes') return Object.values(tool.classes).map(labelOf);
    if (section === 'relations')
      return Object.values(tool.relations).map(labelOf);
    if (section === 'modelTypes')
      return Object.values(tool.modelTypes).map(labelOf);
    return [];
  });
  const sortedItems = $derived(
    [...items].sort((a, b) => a.key.localeCompare(b.key)),
  );
  const current = $derived(selected[section]);

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
      result = run({
        type: 'putClass',
        def: { id, key, kind: 'node', labels, attributes: [] },
      } as never);
      if (result.ok) selected = { ...selected, classes: id };
    } else if (section === 'relations') {
      const id = newId('relation');
      result = run({
        type: 'putRelation',
        def: { id, key, labels, from: [], to: [], attributes: [] },
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

  function remove(id: string) {
    const command =
      section === 'classes'
        ? { type: 'removeClass', id }
        : section === 'relations'
          ? { type: 'removeRelation', id }
          : { type: 'removeModelType', id };
    const result = run(command as never);
    if (result.ok && selected[section] === id)
      selected = { ...selected, [section]: undefined };
  }

  const usagesFor = (owner: KeyOwner) => (attributeId: string) =>
    findKeyUsages(tool, { kind: 'attribute', owner, id: attributeId as never });

  function editPanel(classId: string) {
    if (!tool.panels[classId]) {
      const defs = classId.startsWith('rel_')
        ? effectiveRelationAttributes(tool, classId as RelationId)
        : effectiveAttributes(tool, classId as ClassId);
      const result = run({
        type: 'putPanel',
        layout: defaultLayout(classId as ClassId, defs),
      } as never);
      if (!result.ok) return;
    }
    overlay = { kind: 'panel', id: classId };
  }

  function rename(text: string) {
    if (text.trim() === '' || text === tool.manifest.name) return;
    run({ type: 'updateManifest', name: text.trim() } as never);
  }
  function setVersion(text: string) {
    if (text === tool.manifest.version) return;
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
    <button type="button" onclick={back} data-testid="build-back"
      >← Tool libraries</button
    >
    <input
      class="name"
      value={tool.manifest.name}
      onchange={(e) => rename(e.currentTarget.value)}
      aria-label="Tool library name"
      data-testid="build-name"
    />
    <label class="version"
      >Version <input
        value={tool.manifest.version}
        onchange={(e) => setVersion(e.currentTarget.value)}
        data-testid="build-version"
      /></label
    >
    <span class="spacer"></span>
    <button
      type="button"
      disabled={!build.canUndo}
      onclick={() => controller.undoBuild()}
      data-testid="build-undo">Undo</button
    >
    <button
      type="button"
      disabled={!build.canRedo}
      onclick={() => controller.redoBuild()}
      data-testid="build-redo">Redo</button
    >
    <span class="status" data-testid="build-status">{status}</span>
    <button type="button" onclick={() => (showPreview = !showPreview)}
      >{showPreview ? 'Hide preview' : 'Show preview'}</button
    >
  </header>
  {#if message}<p class="message" role="alert" data-testid="build-message">
      {message}
    </p>{/if}
  {#if build.issues.length > 0}
    <details class="issues" data-testid="build-issues">
      <summary
        >{build.issues.length} problem{build.issues.length === 1 ? '' : 's'} in this
        tool library</summary
      >
      <ul>
        {#each build.issues.slice(0, 20) as issue (issue.path + issue.message)}<li
          >
            {issue.path}: {issue.message}
          </li>{/each}
      </ul>
    </details>
  {/if}

  <div class="body" class:with-preview={showPreview}>
    <nav>
      <div class="tabs" role="tablist">
        {#each SECTIONS as [id, label] (id)}
          <button
            type="button"
            role="tab"
            aria-selected={section === id}
            class:on={section === id}
            onclick={() => (section = id)}
            data-testid="build-tab-{id}">{label}</button
          >
        {/each}
      </div>
      {#if section === 'classes' || section === 'relations' || section === 'modelTypes'}
        <ul class="list">
          {#each sortedItems as item (item.id)}
            <li class:on={current === item.id}>
              <button
                type="button"
                class="pick"
                onclick={() => (selected = { ...selected, [section]: item.id })}
                data-testid="build-item-{item.key}"
                >{item.key}<small
                  >{item.text !== item.key ? item.text : ''}</small
                ></button
              >
              <button
                type="button"
                onclick={() => remove(item.id)}
                aria-label="Delete {item.key}"
                data-testid="build-delete-{item.key}">Delete</button
              >
            </li>
          {/each}
        </ul>
        <form
          class="new"
          onsubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            bind:value={newName}
            placeholder="Name"
            aria-label="Name of the new item"
            data-testid="build-new-name"
          />
          <button type="submit" data-testid="build-add">Add</button>
        </form>
      {/if}
    </nav>
    <main>
      {#if section === 'classes' && current && tool.classes[current as ClassId]}
        {#key current}
          <ClassEditor
            {tool}
            id={current as ClassId}
            {run}
            onEditShape={(id) => (overlay = { kind: 'shape', id })}
            onEditPanel={editPanel}
            usages={usagesFor({ kind: 'class', id: current as ClassId })}
          />
        {/key}
      {:else if section === 'relations' && current && tool.relations[current as RelationId]}
        {#key current}
          <RelationEditor
            {tool}
            id={current as RelationId}
            {run}
            onEditShape={(id) => (overlay = { kind: 'shape', id })}
            usages={usagesFor({ kind: 'relation', id: current as RelationId })}
          />
        {/key}
      {:else if section === 'modelTypes' && current && tool.modelTypes[current as ModelTypeId]}
        {#key current}
          <ModelTypeEditor
            {tool}
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
          {tool}
          {run}
          onEditShape={(id) => (overlay = { kind: 'shape', id })}
        />
      {:else if section === 'settings'}
        <SettingsEditor {tool} {run} />
      {:else}
        <p class="muted">Choose an item on the left, or add one.</p>
      {/if}
    </main>
    {#if showPreview}
      <div class="side"><ToolPreview {tool} /></div>
    {/if}
  </div>

  {#if overlay?.kind === 'shape'}
    {@const id = overlay.id}
    {@const shape = tool.shapes[id as keyof typeof tool.shapes]}
    {#if shape?.kind === 'node'}
      {@const user = Object.values(tool.classes).find((c) => c.shape === id)}
      <div
        class="overlay"
        role="dialog"
        aria-label="Shape editor"
        data-testid="shape-overlay"
      >
        {#key id}
          <ShapeEditor
            shape={shape as NodeShape}
            attributes={user ? effectiveAttributes(tool, user.id) : []}
            className={user?.key ?? ''}
            shapes={(sid) => tool.shapes[sid]}
            onChange={(next) => run({ type: 'putShape', def: next } as never)}
            onClose={() => (overlay = null)}
          />
        {/key}
      </div>
    {/if}
  {/if}

  {#if overlay?.kind === 'panel'}
    {@const id = overlay.id}
    {@const layout = tool.panels[id]}
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
            ? effectiveRelationAttributes(tool, id as RelationId)
            : effectiveAttributes(tool, id as ClassId)}
          onChange={(next) => run({ type: 'putPanel', layout: next } as never)}
          onClose={() => (overlay = null)}
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .build {
    display: grid;
    grid-template-rows: auto auto auto 1fr;
    height: 100vh;
    min-height: 0;
  }
  .bar {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.5rem 0.8rem;
    border-bottom: 1px solid var(--line);
  }
  .name {
    font-size: 1.05rem;
    font-weight: 600;
    min-width: 12rem;
  }
  .version {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .version input {
    width: 6rem;
  }
  .spacer {
    flex: 1;
  }
  .status {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .message {
    margin: 0;
    padding: 0.4rem 0.8rem;
    background: #fff5f5;
    color: #c92a2a;
  }
  .issues {
    margin: 0;
    padding: 0.3rem 0.8rem;
    background: #fff4e6;
    font-size: 0.9rem;
  }
  .body {
    display: grid;
    grid-template-columns: 16rem 1fr;
    min-height: 0;
  }
  .body.with-preview {
    grid-template-columns: 16rem 1fr 24rem;
  }
  nav {
    border-right: 1px solid var(--line);
    padding: 0.6rem;
    overflow: auto;
    display: grid;
    align-content: start;
    gap: 0.6rem;
  }
  .tabs {
    display: grid;
    gap: 0.2rem;
  }
  .tabs button {
    text-align: left;
  }
  .tabs .on {
    background: #e7f5ff;
    border-color: #1971c2;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.2rem;
  }
  .list li {
    display: flex;
    gap: 0.2rem;
  }
  .list li.on .pick {
    background: #e7f5ff;
  }
  .pick {
    flex: 1;
    text-align: left;
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }
  .pick small {
    color: var(--muted);
  }
  .new {
    display: flex;
    gap: 0.3rem;
  }
  .new input {
    flex: 1;
    min-width: 0;
  }
  main {
    padding: 1rem 1.2rem;
    overflow: auto;
  }
  .side {
    border-left: 1px solid var(--line);
    padding: 0.6rem;
    min-height: 0;
  }
  .muted {
    color: var(--muted);
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(255, 255, 255, 0.98);
    overflow: auto;
    padding: 1rem;
    z-index: 20;
  }
</style>
