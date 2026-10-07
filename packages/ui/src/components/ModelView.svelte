<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    CanvasView,
    Editor,
    Minimap,
    Scene,
    type EditorTool,
    type Selection,
  } from '@metakit-app/canvas';
  import {
    validateModel,
    type ClassId,
    type ConnectorId,
    type ElementId,
    type Json,
    type Model,
    type RelationDef,
    type RelationId,
    type ValidationIssue,
    type ViewId,
  } from '@metakit-app/core';
  import { buildPanel, editCommands, type Field } from '../panel';
  import type { OpenModel, SaveStatus } from '../shell/controller';
  import { findInModel, type FindHit } from '../shell/find';
  import { labelOf, paletteFor } from '../shell/palette';
  import type { ReferenceServices } from '../shell/references';
  import AttributePanel from './AttributePanel.svelte';

  let {
    open,
    save,
    references,
    registerOpenElement,
    onBack,
  }: {
    open: OpenModel;
    save: SaveStatus;
    references: ReferenceServices;
    /** Lets the app select an element after switching to this model (from a reference "Open"). */
    registerOpenElement: (fn: (id: ElementId) => void) => void;
    onBack: () => void;
  } = $props();

  // The app mounts one ModelView per open model (keyed by its folder), so these never change.
  // svelte-ignore state_referenced_locally
  const { store, tool } = open;
  const modelType = $derived(
    tool.modelTypes[(store.state as Model).manifest.modelType]!,
  );

  let host: HTMLDivElement;
  let mapHost: HTMLDivElement;
  let scene: Scene;
  let view: CanvasView;
  let editor: Editor;
  let minimap: Minimap;
  let stopStore = () => undefined as void;

  let version = $state(0);
  let selection = $state<Selection>({
    elements: new Set(),
    connectors: new Set(),
  });
  let activeTool = $state<EditorTool>({ type: 'select' });
  let viewId = $state<string>('');
  let issues = $state<ValidationIssue[]>([]);
  let message = $state('');
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  let validateTimer: ReturnType<typeof setTimeout> | undefined;
  let canUndo = $state(false);
  let canRedo = $state(false);

  let query = $state('');
  let hits = $state<FindHit[]>([]);
  let findInput: HTMLInputElement | undefined = $state();

  let chooser = $state<{
    options: RelationDef[];
    x: number;
    y: number;
    resolve: (r: RelationDef | null) => void;
  } | null>(null);
  let labelEdit = $state<{
    id: ElementId;
    attr: string;
    value: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const model = $derived.by(() => {
    void version;
    return store.state as Model;
  });
  const palette = $derived(
    paletteFor(tool, modelType, (viewId || null) as ViewId | null),
  );
  const targets = $derived.by(() => {
    const ids: (ElementId | ConnectorId)[] =
      selection.elements.size > 0
        ? [...selection.elements]
        : [...selection.connectors];
    return ids
      .filter((id) => id in model.elements || id in model.connectors)
      .map((id) => ({ id }));
  });
  const sections = $derived(buildPanel(tool, model, targets, issues));
  const heading = $derived.by(() => {
    if (targets.length !== 1) return `${targets.length} objects`;
    const id = targets[0]!.id;
    const element = model.elements[id as ElementId];
    if (element) {
      const cls = tool.classes[element.class];
      return cls ? labelOf(cls) : 'Object';
    }
    const connector = model.connectors[id as ConnectorId];
    const rel = connector && tool.relations[connector.relation];
    return rel ? labelOf(rel) : 'Connection';
  });

  function say(text: string) {
    message = text;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => (message = ''), 6000);
  }

  function scheduleValidation() {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(() => {
      issues = validateModel(tool, store.state as Model);
    }, 200);
  }

  onMount(() => {
    scene = new Scene(store.state as Model, tool);
    stopStore = scene.attach(store);
    view = new CanvasView(host, scene, { grid: tool.settings.grid });
    editor = new Editor({
      store,
      tool,
      view,
      allowedRelations: () => palette.relationIds,
      host: {
        onSelectionChange: (s) => (selection = s),
        onToolChange: (t) => (activeTool = t),
        onMessage: say,
        chooseRelation: (options, screen) =>
          new Promise((resolve) => {
            chooser = { options, x: screen.x, y: screen.y, resolve };
          }),
        onEditText: beginLabelEdit,
      },
    });
    minimap = new Minimap(mapHost, view);
    view.fit();
    const stop = store.subscribe(() => {
      version += 1;
      canUndo = store.canUndo();
      canRedo = store.canRedo();
      scheduleValidation();
      if (labelEdit && !(labelEdit.id in (store.state as Model).elements))
        labelEdit = null;
    });
    stopStore = ((prev) => () => {
      prev();
      stop();
    })(stopStore);
    canUndo = store.canUndo();
    canRedo = store.canRedo();
    scheduleValidation();
    registerOpenElement((id) => {
      editor.select([id]);
      centreOn(id);
    });
    window.addEventListener('keydown', globalKeys);
    // Tests and tooling can reach the editor of the open model.
    (window as unknown as { __metakit?: unknown }).__metakit = {
      editor,
      view,
      scene,
      store,
    };
  });

  onDestroy(() => {
    window.removeEventListener('keydown', globalKeys);
    clearTimeout(messageTimer);
    clearTimeout(validateTimer);
    stopStore();
    editor?.destroy();
    minimap?.destroy();
    view?.destroy();
    delete (window as unknown as { __metakit?: unknown }).__metakit;
  });

  function globalKeys(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      findInput?.focus();
      findInput?.select();
    }
  }

  function centreOn(id: ElementId | ConnectorId) {
    const element = scene.elements.get(id as ElementId);
    if (element)
      return view.centreOnWorld({
        x: element.x + element.w / 2,
        y: element.y + element.h / 2,
      });
    const connector = scene.connectors.get(id as ConnectorId);
    if (connector) {
      const mid = connector.route[Math.floor(connector.route.length / 2)]!;
      view.centreOnWorld(mid);
    }
  }

  // Palette and tools --------------------------------------------------------------------------

  const choosePlace = (cls: ClassId) =>
    editor.setTool({ type: 'place', class: cls });
  const chooseConnect = (relation: RelationId) =>
    editor.setTool({ type: 'connect', relation });
  const chooseSelect = () => editor.setTool({ type: 'select' });

  function dragStart(event: DragEvent, cls: ClassId) {
    event.dataTransfer?.setData('application/x-metakit-class', cls);
    event.dataTransfer!.effectAllowed = 'copy';
  }

  function dropOnCanvas(event: DragEvent) {
    const cls = event.dataTransfer?.getData('application/x-metakit-class');
    if (!cls) return;
    event.preventDefault();
    editor.placeAt(cls as ClassId, view.toWorld(event));
  }

  // Find ---------------------------------------------------------------------------------------

  function runFind() {
    hits = findInModel(tool, store.state as Model, query);
  }

  function pick(hit: FindHit) {
    if (hit.kind === 'element') editor.select([hit.id as ElementId]);
    else editor.select([], [hit.id as ConnectorId]);
    centreOn(hit.id);
    hits = [];
  }

  // Panel edits --------------------------------------------------------------------------------

  function edit(field: Field, value: Json) {
    editor.run(editCommands(targets, field.attr, value));
  }

  // Text on the canvas -------------------------------------------------------------------------

  function beginLabelEdit(id: ElementId) {
    const item = scene.elements.get(id);
    if (!item) return;
    const attr = scene.labelAttribute(item.cls);
    if (!attr) {
      say(
        'This kind of object has no text to edit. Use the panel on the right.',
      );
      return;
    }
    const a = view.toScreenFromWorld({ x: item.x, y: item.y });
    const s = view.view.s;
    const current = (store.state as Model).elements[id]!.attrs[attr as never];
    labelEdit = {
      id,
      attr,
      value: typeof current === 'string' ? current : '',
      left: a.x,
      top: a.y,
      width: Math.max(80, item.w * s),
      height: Math.max(32, item.h * s),
    };
  }

  function commitLabel() {
    const edit = labelEdit;
    labelEdit = null;
    if (!edit) return;
    editor.run([
      {
        type: 'setAttribute',
        target: edit.id,
        attr: edit.attr as never,
        value: edit.value === '' ? null : edit.value,
      },
    ]);
  }

  function labelKey(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commitLabel();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      labelEdit = null;
    }
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
    (node as HTMLTextAreaElement).select();
  }

  const align = (mode: Parameters<Editor['align']>[0]) => editor.align(mode);
  const saveText = $derived(
    save === 'saved' ? 'Saved' : save === 'saving' ? 'Saving…' : 'Not saved',
  );
</script>

<div class="workbench" data-testid="model-view">
  <header class="bar">
    <button onclick={onBack} data-testid="back-to-explorer">← Models</button>
    <strong class="name" data-testid="model-name">{model.manifest.name}</strong>
    <span class="save" class:bad={save === 'error'} data-testid="save-status"
      >{saveText}</span
    >
    <span class="sep"></span>
    <button
      onclick={() => editor.undo()}
      disabled={!canUndo}
      aria-label="Undo"
      title="Undo (Ctrl+Z)">Undo</button
    >
    <button
      onclick={() => editor.redo()}
      disabled={!canRedo}
      aria-label="Redo"
      title="Redo (Ctrl+Shift+Z)">Redo</button
    >
    <span class="sep"></span>
    {#if palette.views.length > 0}
      <label class="inline">
        View
        <select bind:value={viewId} data-testid="view-switcher">
          <option value="">All</option>
          {#each palette.views as v (v.id)}<option value={v.id}
              >{labelOf(v)}</option
            >{/each}
        </select>
      </label>
    {/if}
    <button onclick={() => view.fit()} title="Show the whole model">Fit</button>
    <button
      onclick={() =>
        view.zoomAtScreen({ x: view.width / 2, y: view.height / 2 }, 1.25)}
      aria-label="Zoom in">+</button
    >
    <button
      onclick={() =>
        view.zoomAtScreen({ x: view.width / 2, y: view.height / 2 }, 0.8)}
      aria-label="Zoom out">−</button
    >
    <span class="sep"></span>
    <details class="menu">
      <summary>Arrange</summary>
      <div class="menu-body">
        <button
          disabled={selection.elements.size < 2}
          onclick={() => align('left')}>Align left</button
        >
        <button
          disabled={selection.elements.size < 2}
          onclick={() => align('centre')}>Align centres</button
        >
        <button
          disabled={selection.elements.size < 2}
          onclick={() => align('right')}>Align right</button
        >
        <button
          disabled={selection.elements.size < 2}
          onclick={() => align('top')}>Align top</button
        >
        <button
          disabled={selection.elements.size < 2}
          onclick={() => align('middle')}>Align middle</button
        >
        <button
          disabled={selection.elements.size < 2}
          onclick={() => align('bottom')}>Align bottom</button
        >
        <button
          disabled={selection.elements.size < 3}
          onclick={() => editor.distribute('horizontal')}
          >Distribute horizontally</button
        >
        <button
          disabled={selection.elements.size < 3}
          onclick={() => editor.distribute('vertical')}
          >Distribute vertically</button
        >
      </div>
    </details>
    <span class="grow"></span>
    <div class="find">
      <input
        bind:this={findInput}
        type="search"
        placeholder="Find (Ctrl+F)"
        bind:value={query}
        oninput={runFind}
        onkeydown={(e) => e.key === 'Escape' && ((hits = []), (query = ''))}
        data-testid="find-input"
        aria-label="Find in this model"
      />
      {#if hits.length > 0}
        <ul class="hits" role="listbox" data-testid="find-results">
          {#each hits as hit (hit.id)}
            <li role="option" aria-selected="false">
              <button onclick={() => pick(hit)}>
                {hit.title || hit.id}
                <span class="where"
                  >{hit.field === 'name'
                    ? ''
                    : `${hit.field}: `}{hit.excerpt === hit.title
                    ? ''
                    : hit.excerpt}</span
                >
              </button>
            </li>
          {/each}
        </ul>
      {:else if query.trim() !== ''}
        <p class="no-hits">Nothing found.</p>
      {/if}
    </div>
  </header>

  <nav class="palette" aria-label="Palette" data-testid="palette">
    <button
      class="tool"
      class:on={activeTool.type === 'select'}
      onclick={chooseSelect}
      data-testid="tool-select">Select</button
    >
    <h3>Objects</h3>
    {#each palette.classes as cls (cls.id)}
      <button
        class="tool"
        class:on={activeTool.type === 'place' && activeTool.class === cls.id}
        draggable="true"
        ondragstart={(e) => dragStart(e, cls.id)}
        onclick={() => choosePlace(cls.id)}
        data-testid="palette-class-{cls.key}"
      >
        {labelOf(cls)}
      </button>
    {/each}
    <h3>Relations</h3>
    {#each palette.relations as rel (rel.id)}
      <button
        class="tool"
        class:on={activeTool.type === 'connect' &&
          activeTool.relation === rel.id}
        onclick={() => chooseConnect(rel.id)}
        data-testid="palette-relation-{rel.key}"
      >
        {labelOf(rel)}
      </button>
    {/each}
    {#if palette.classes.length === 0}
      <p class="hint">This view lists no objects.</p>
    {/if}
  </nav>

  <div
    class="canvas"
    bind:this={host}
    ondragover={(e) => e.preventDefault()}
    ondrop={dropOnCanvas}
    role="application"
    aria-label="Model canvas"
    data-testid="canvas-host"
  >
    <div class="minimap" bind:this={mapHost}></div>
    {#if labelEdit}
      <textarea
        class="label-edit"
        style="left:{labelEdit.left}px;top:{labelEdit.top}px;width:{labelEdit.width}px;height:{labelEdit.height}px"
        bind:value={labelEdit.value}
        onblur={commitLabel}
        onkeydown={labelKey}
        use:focusOnMount
        data-testid="label-editor"
        aria-label="Edit text"></textarea>
    {/if}
    {#if chooser}
      <div
        class="chooser"
        style="left:{chooser.x}px;top:{chooser.y}px"
        role="menu"
        data-testid="relation-chooser"
      >
        {#each chooser.options as option (option.id)}
          <button
            role="menuitem"
            onclick={() => {
              chooser?.resolve(option);
              chooser = null;
            }}
          >
            {labelOf(option)}
          </button>
        {/each}
        <button
          role="menuitem"
          onclick={() => {
            chooser?.resolve(null);
            chooser = null;
          }}
        >
          Cancel
        </button>
      </div>
    {/if}
    {#if message}
      <p class="toast" role="status" data-testid="message">{message}</p>
    {/if}
  </div>

  <div class="side">
    <AttributePanel
      {sections}
      count={targets.length}
      {heading}
      {references}
      onEdit={edit}
    />
  </div>
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: 11rem 1fr 20rem;
    grid-template-rows: auto 1fr;
    grid-template-areas: 'bar bar bar' 'palette canvas side';
    height: 100vh;
  }
  .bar {
    grid-area: bar;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.7rem;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    flex-wrap: wrap;
  }
  .name {
    margin: 0 0.3rem;
  }
  .save {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .save.bad {
    color: var(--danger);
  }
  .sep {
    width: 1px;
    height: 1.4rem;
    background: var(--line);
    margin: 0 0.2rem;
  }
  .grow {
    flex: 1;
  }
  .inline {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .menu {
    position: relative;
  }
  .menu summary {
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    list-style: none;
  }
  .menu-body {
    position: absolute;
    z-index: 20;
    top: 2rem;
    left: 0;
    display: grid;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.3rem;
    min-width: 12rem;
    box-shadow: 0 4px 14px rgb(0 0 0 / 12%);
  }
  .menu-body button {
    text-align: left;
    border: none;
    background: none;
    padding: 0.25rem 0.5rem;
  }
  .menu-body button:hover:not(:disabled) {
    background: var(--hover);
  }
  .find {
    position: relative;
  }
  .hits {
    position: absolute;
    z-index: 30;
    right: 0;
    top: 2rem;
    list-style: none;
    margin: 0;
    padding: 0.2rem;
    width: 22rem;
    max-height: 18rem;
    overflow: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: 0 4px 14px rgb(0 0 0 / 12%);
  }
  .hits button {
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 0.3rem 0.5rem;
    cursor: pointer;
  }
  .hits button:hover {
    background: var(--hover);
  }
  .where {
    color: var(--muted);
    font-size: 0.8rem;
    margin-left: 0.4rem;
  }
  .no-hits {
    position: absolute;
    right: 0;
    top: 2rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    margin: 0;
    color: var(--muted);
  }
  .palette {
    grid-area: palette;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.6rem;
    border-right: 1px solid var(--line);
    overflow-y: auto;
    background: var(--panel);
  }
  .palette h3 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0.8rem 0 0.2rem;
  }
  .tool {
    text-align: left;
    border: 1px solid var(--line);
    background: var(--bg);
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    cursor: pointer;
  }
  .tool.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .hint {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .canvas {
    grid-area: canvas;
    position: relative;
    min-width: 0;
    min-height: 0;
  }
  .minimap {
    position: absolute;
    right: 0.6rem;
    bottom: 0.6rem;
    z-index: 5;
  }
  .side {
    grid-area: side;
    border-left: 1px solid var(--line);
    background: var(--panel);
    min-height: 0;
  }
  .label-edit {
    position: absolute;
    z-index: 10;
    box-sizing: border-box;
    resize: none;
    text-align: center;
    border: 2px solid var(--accent);
    border-radius: 4px;
    padding: 0.3rem;
    font: inherit;
  }
  .chooser {
    position: absolute;
    z-index: 15;
    display: grid;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.2rem;
    box-shadow: 0 4px 14px rgb(0 0 0 / 15%);
  }
  .chooser button {
    text-align: left;
    border: none;
    background: none;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
  }
  .chooser button:hover {
    background: var(--hover);
  }
  .toast {
    position: absolute;
    z-index: 12;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    background: #343a40;
    color: #fff;
    padding: 0.5rem 0.9rem;
    border-radius: 6px;
    max-width: 80%;
    margin: 0;
  }
</style>
