<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    CanvasView,
    Editor,
    Minimap,
    Scene,
    type EditorTool,
    exportPdf,
    exportPng,
    exportSvg,
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
  import {
    buildLayoutPanelFor,
    buildPanel,
    objectMessages,
    editCommands,
    unknownAttributes,
    type Field,
    type UnknownAttribute,
  } from '../panel';
  import type { AppState, ControllerPort } from '../shell/controller';
  import {
    EXPORT_MIME,
    exportFileName,
    saveBlob,
    type ExportRequest,
  } from '../shell/download';
  import { findInModel, type FindHit } from '../shell/find';
  import { canvasTheme } from '../shell/canvas-theme';
  import { labelOf, paletteFor } from '../shell/palette';
  import { pageTheme } from '../theme/theme';
  import type { ReferenceServices } from '../shell/references';
  import {
    runActionAttribute,
    type ConsoleLine,
    type ScriptsHandle,
  } from '@metakit-app/behaviour';
  import ScriptConsole from './build/scripts/ScriptConsole.svelte';
  import ValidationList from './ValidationList.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import AttributePanel from './AttributePanel.svelte';
  import ModelToolbar from './ModelToolbar.svelte';
  import PaletteList from './Palette.svelte';

  let {
    app,
    controller,
    references,
    registerOpenElement,
    onBack,
  }: {
    app: AppState;
    controller: ControllerPort;
    references: ReferenceServices;
    /** Lets the app select an element after switching to this model (from a reference "Open"). */
    registerOpenElement: (fn: (id: ElementId) => void) => void;
    onBack: () => void;
  } = $props();

  // The app mounts one ModelView per open model (keyed by its folder), so these never change.
  // svelte-ignore state_referenced_locally
  const { store, slug, behaviour } = app.open!;
  // svelte-ignore state_referenced_locally
  const firstTool = app.open!.tool;
  // The tool library follows changes made in Build mode, here or by anyone in the folder.
  const tool = $derived(app.open?.tool ?? firstTool);
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
  // True once the canvas exists, so that effects that talk to it can start.
  let ready = $state(false);
  // Ticks every second so that "12 s ago" stays true.
  let now = $state(Date.now());

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
  const calculator = behaviour.calculator;
  const sections = $derived(
    buildPanel(
      tool,
      model,
      targets,
      issues,
      tool.manifest.languages[0] ?? 'en',
      { calculator },
    ),
  );
  const panelMessages = $derived(
    objectMessages(
      issues,
      targets.map((t) => t.id),
    ),
  );
  // The tool's panel layout for the selection, when it has one; conditions follow the values.
  const layoutPanel = $derived(
    buildLayoutPanelFor(
      tool,
      model,
      targets,
      issues,
      tool.manifest.languages[0] ?? 'en',
      { calculator },
    ),
  );
  /** Stored values that the class no longer defines, for a single selected object. */
  const unknown = $derived.by((): UnknownAttribute[] => {
    if (targets.length !== 1) return [];
    const id = targets[0]!.id;
    const element = model.elements[id as ElementId];
    if (element) return unknownAttributes(tool, element.class, element.attrs);
    const connector = model.connectors[id as ConnectorId];
    return connector
      ? unknownAttributes(tool, connector.relation, connector.attrs)
      : [];
  });
  function removeUnknown(entry: UnknownAttribute) {
    const target = targets[0]?.id as ElementId | ConnectorId | undefined;
    if (target)
      store.execute({
        type: 'removeAttributeValue',
        target,
        attr: entry.id,
      });
  }
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

  /** Other people who have this model open, and what they have selected. */
  const here = $derived(
    app.people.filter(
      (p) => p.document?.kind === 'model' && p.document.slug === slug,
    ),
  );
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?';

  $effect(() => {
    const remote = here
      .filter((p) => p.selection.length > 0)
      .map((p) => ({
        colour: p.colour,
        label: initials(p.name),
        elements: p.selection.filter((id) =>
          id.startsWith('el_'),
        ) as ElementId[],
      }));
    if (ready) view.setActive({ remote });
  });

  // The tool library the canvas was built with; it is rebuilt only when this one is replaced.
  let appliedTool = firstTool;
  $effect(() => {
    const next = tool;
    if (!ready || next === appliedTool) return;
    appliedTool = next;
    scene.setTool(next);
    editor.useToolLibrary(next);
    view.setGrid(next.settings.grid);
    scheduleValidation();
  });

  /** "Last change from Anna, 12 s ago", or what is wrong. */
  const statusText = $derived.by(() => {
    if (app.sync.error) return app.sync.error;
    if (app.sync.pending > 0) return 'Saving…';
    const last = app.sync.lastRemote;
    if (last) {
      const who =
        app.people.find((p) => p.instance === last.by)?.name ?? 'someone else';
      const seconds = Math.max(0, Math.round((now - last.at) / 1000));
      const ago =
        seconds < 90
          ? `${seconds} s ago`
          : `${Math.round(seconds / 60)} min ago`;
      return `Saved. Last change from ${who}, ${ago}`;
    }
    return 'Saved';
  });

  /** Switching the palette view is an event: rules may cancel it, and hear when it happened. */
  function changeView(select: HTMLSelectElement) {
    const next = select.value;
    const emit = (event: 'view.changing' | 'view.changed') =>
      behaviour.bus.emit({
        event,
        target: slug,
        view: next || null,
        old: viewId || null,
        new: next || null,
        user: app.me.instance,
      });
    const result = emit('view.changing');
    if (result.cancelled) {
      select.value = viewId;
      controller.pushMessage?.('warning', result.reason);
      return;
    }
    viewId = next;
    emit('view.changed');
  }

  // Commands that rules and scripts add; listed again whenever the set changes.
  let commandTick = $state(0);
  const commandsAt = (place: 'model' | 'toolbar' | 'context') => {
    void commandTick;
    return behaviour.commands.list(place);
  };
  const selectedId = () => targets[0]?.id ?? null;
  let stopCommands: (() => void) | undefined;
  let contextMenu = $state<{ x: number; y: number } | null>(null);

  function openContextMenu(event: MouseEvent) {
    if (behaviour.commands.list('context').length === 0) return;
    const box = host.getBoundingClientRect();
    contextMenu = { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  let consoleOpen = $state(false);
  let scriptLog = $state<ConsoleLine[]>([]);
  let scripts: ScriptsHandle | null = null;
  let stopLog: (() => void) | undefined;

  let problemsOpen = $state(false);

  // The overview can be hidden; the choice is remembered per browser where that is possible.
  const MINIMAP_KEY = 'metakit.minimap';
  function readMinimapChoice(): boolean {
    try {
      return localStorage.getItem(MINIMAP_KEY) !== 'off';
    } catch {
      return true;
    }
  }
  let minimapOn = $state(readMinimapChoice());
  function toggleMinimap() {
    minimapOn = !minimapOn;
    try {
      localStorage.setItem(MINIMAP_KEY, minimapOn ? 'on' : 'off');
    } catch {
      // Not remembered; it still applies to this page.
    }
  }
  const zoomBy = (factor: number) =>
    view.zoomAtScreen({ x: view.width / 2, y: view.height / 2 }, factor);
  function runCommand(command: { id: string }) {
    [...commandsAt('toolbar'), ...commandsAt('model')]
      .find((c) => c.id === command.id)
      ?.run(selectedId());
  }
  function focusFind() {
    findInput?.focus();
    findInput?.select();
  }
  let stopTheme = () => undefined as void;

  function showIssue(target: string) {
    if (target.startsWith('el_')) editor.select([target as ElementId]);
    else if (target.startsWith('cn_'))
      editor.select([], [target as ConnectorId]);
    else return;
    centreOn(target as ElementId | ConnectorId);
  }

  async function autoLayout() {
    const changed = await editor.autoLayout();
    if (changed) say('Laid out the model. Undo restores the old positions.');
  }

  let exportOpen = $state(false);
  let exporting = $state(false);
  let exportProblem = $state<string | null>(null);

  async function runExport(r: ExportRequest) {
    exporting = true;
    exportProblem = null;
    try {
      const chosen =
        r.scope === 'selection'
          ? {
              elements: new Set(selection.elements),
              connectors: new Set(selection.connectors),
            }
          : undefined;
      const title = model.manifest.name;
      const blob =
        r.format === 'svg'
          ? new Blob([exportSvg(scene, { selection: chosen, title })], {
              type: EXPORT_MIME.svg,
            })
          : r.format === 'png'
            ? await exportPng(scene, {
                scale: r.scale ?? 2,
                transparent: !!r.transparent,
                selection: chosen,
              })
            : await exportPdf(scene, {
                pageSize: r.pageSize ?? 'a4',
                orientation: r.orientation ?? 'auto',
                fitToPage: r.fitToPage ?? true,
                selection: chosen,
                title,
              });
      if (await saveBlob(blob, exportFileName(title, r.format)))
        exportOpen = false;
    } catch (e) {
      exportProblem = e instanceof Error ? e.message : String(e);
    } finally {
      exporting = false;
    }
  }

  function say(text: string) {
    message = text;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => (message = ''), 6000);
  }

  function scheduleValidation() {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(() => {
      issues = validateModel(tool, store.state as Model, calculator);
    }, 200);
  }

  onMount(() => {
    void controller.scriptsOf(behaviour)?.then(
      (handle) => {
        scripts = handle;
        scriptLog = [...handle.log];
        stopLog = handle.onLog(() => (scriptLog = [...handle.log]));
      },
      () => undefined,
    );
    stopCommands = behaviour.commands.onChange(() => (commandTick += 1));
    scene = new Scene(store.state as Model, tool, { calculator });
    stopStore = scene.attach(store);
    view = new CanvasView(host, scene, { grid: tool.settings.grid });
    editor = new Editor({
      store,
      tool,
      view,
      allowedRelations: () => palette.relationIds,
      host: {
        onSelectionChange: (s) => {
          selection = s;
          behaviour.bus.emit({
            event: 'selection.changed',
            target: slug,
            selection: [...s.elements, ...s.connectors],
            user: app.me.instance,
          });
          controller.setSelection([...s.elements, ...s.connectors]);
        },
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
    // The canvas and the overview follow the theme; only the grid and the active layer are redrawn.
    const followTheme = () => {
      const theme = canvasTheme();
      view.setPalette(theme.canvas);
      minimap.setPalette(theme.minimap);
    };
    followTheme();
    stopTheme = pageTheme().subscribe(followTheme);
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
    ready = true;
    const tick = setInterval(() => (now = Date.now()), 1000);
    stopStore = ((prev) => () => {
      prev();
      clearInterval(tick);
    })(stopStore);
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
    stopTheme();
    stopCommands?.();
    stopLog?.();
    scene?.destroy();
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
    // A panel button runs its rule, command or script on the selected object instead of storing a value.
    if (field.attr.type === 'action') {
      const rules = controller.rulesOf(behaviour);
      if (rules)
        runActionAttribute(
          behaviour,
          rules.engine,
          field.attr,
          targets[0]?.id ?? null,
        );
      return;
    }
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
    const others = controller.editorsOf(id);
    if (others.length > 0)
      say(
        `${others.map((p) => p.name).join(' and ')} ${others.length === 1 ? 'is' : 'are'} editing this text too. You can go on; the last change wins.`,
      );
    controller.setEditing(id);
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
    controller.setEditing(null);
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
      controller.setEditing(null);
    }
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
    (node as HTMLTextAreaElement).select();
  }

  const align = (mode: Parameters<Editor['align']>[0]) => editor.align(mode);
</script>

<svelte:window
  oncontextmenu={(event) => {
    if (host?.contains(event.target as Node)) openContextMenu(event);
  }}
  onclick={() => (contextMenu = null)}
/>

<div class="workbench" data-testid="model-view">
  <div class="bar">
    <ModelToolbar
      name={model.manifest.name}
      saveText={app.save === 'saved'
        ? 'Saved'
        : app.save === 'saving'
          ? 'Saving…'
          : 'Not saved'}
      saveBad={app.save === 'error'}
      syncText={statusText}
      me={{
        instance: app.me.instance,
        name: app.me.name,
        colour: app.me.colour,
        initials: initials(app.me.name),
      }}
      people={here.map((p) => ({
        instance: p.instance,
        name: p.name,
        colour: p.colour,
        initials: initials(p.name),
      }))}
      {onBack}
      {canUndo}
      {canRedo}
      onUndo={() => editor.undo()}
      onRedo={() => editor.redo()}
      onFit={() => view.fit()}
      onZoomIn={() => zoomBy(1.25)}
      onZoomOut={() => zoomBy(0.8)}
      selectedElements={selection.elements.size}
      selectedAny={selection.elements.size + selection.connectors.size > 0}
      onSelectAll={() => editor.selectAll()}
      onDelete={() => editor.deleteSelection()}
      onFind={focusFind}
      onAlign={align}
      onDistribute={(axis) => editor.distribute(axis)}
      onAutoLayout={autoLayout}
      onExport={() => (exportOpen = true)}
      views={palette.views.map((v) => ({ id: v.id, label: labelOf(v) }))}
      {viewId}
      onViewChange={changeView}
      {minimapOn}
      onToggleMinimap={toggleMinimap}
      {problemsOpen}
      issueCount={issues.length}
      onToggleProblems={() => (problemsOpen = !problemsOpen)}
      consoleAvailable={scriptLog.length > 0 || consoleOpen}
      {consoleOpen}
      onToggleConsole={() => (consoleOpen = !consoleOpen)}
      toolbarCommands={commandsAt('toolbar')}
      modelCommands={commandsAt('model')}
      onRunCommand={runCommand}
    >
      {#snippet trailing()}
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
            <ul class="hits card" role="listbox" data-testid="find-results">
              {#each hits as hit (hit.id)}
                <li role="option" aria-selected="false">
                  <button class="ghost" onclick={() => pick(hit)}>
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
            <p class="no-hits card">Nothing found.</p>
          {/if}
        </div>
      {/snippet}
    </ModelToolbar>
  </div>

  <div class="palette-slot">
    <PaletteList
      {tool}
      {palette}
      {activeTool}
      onSelect={chooseSelect}
      onPlace={choosePlace}
      onConnect={chooseConnect}
      onDragClass={dragStart}
    />
  </div>

  <div class="centre">
    <div
      class="canvas"
      bind:this={host}
      ondragover={(e) => e.preventDefault()}
      ondrop={dropOnCanvas}
      role="application"
      aria-label="Model canvas"
      data-testid="canvas-host"
    >
      <div class="minimap" bind:this={mapHost} hidden={!minimapOn}></div>
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
      {#if contextMenu}
        <div
          class="chooser card"
          style="left:{contextMenu.x}px;top:{contextMenu.y}px"
          role="menu"
          data-testid="context-menu"
        >
          {#each commandsAt('context') as command (command.id)}
            <button
              role="menuitem"
              onclick={() => {
                contextMenu = null;
                command.run(selectedId());
              }}
              data-testid="command-{command.id}">{command.label}</button
            >
          {/each}
        </div>
      {/if}
      {#if chooser}
        <div
          class="chooser card"
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
      {#if app.divergence.length > 0}
        <p class="warning notice warning" role="alert" data-testid="divergence">
          {app.divergence[0]!.a.name} and {app.divergence[0]!.b.name} have read the
          same changes but see different models. Close and reopen the model; if this
          stays, tell whoever looks after MetaKit for you.
        </p>
      {/if}
      {#if app.notices.length > 0}
        <ul class="notices" data-testid="notices">
          {#each app.notices as notice (notice.id)}
            <li class="notice">
              <span>{notice.text}</span>
              <button
                class="ghost icon"
                onclick={() => controller.dismissNotice(notice.id)}
                aria-label="Dismiss">×</button
              >
            </li>
          {/each}
        </ul>
      {/if}
      {#if message}
        <p class="toast" role="status" data-testid="message">{message}</p>
      {/if}
      {#if app.messages.length > 0}
        <ul
          class="behaviour-messages"
          aria-label="Messages from rules and scripts"
        >
          {#each app.messages as m (m.id)}
            <li
              class="notice {m.kind === 'error'
                ? 'error'
                : m.kind === 'warning'
                  ? 'warning'
                  : ''}"
              data-testid="behaviour-message"
            >
              <span>{m.text}</span>
              <button
                type="button"
                class="ghost icon"
                onclick={() => controller.dismissMessage(m.id)}
                aria-label="Dismiss"
                data-testid="behaviour-message-dismiss">×</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if consoleOpen || problemsOpen}
      <div class="dock">
        {#if consoleOpen}
          <aside class="dock-panel" data-testid="script-console-panel">
            <button
              class="ghost icon close"
              onclick={() => (consoleOpen = false)}
              aria-label="Close the script console">×</button
            >
            <ScriptConsole
              lines={scriptLog}
              onClear={() => {
                scripts?.clearLog();
                scriptLog = [];
              }}
            />
          </aside>
        {/if}
        {#if problemsOpen}
          <aside class="dock-panel" data-testid="problems-panel">
            <button
              class="ghost icon close"
              onclick={() => (problemsOpen = false)}
              aria-label="Close the problems list">×</button
            >
            <ValidationList {issues} {model} {tool} onSelect={showIssue} />
          </aside>
        {/if}
      </div>
    {/if}
  </div>

  {#if exportOpen}
    <ExportDialog
      hasSelection={selection.elements.size + selection.connectors.size > 0}
      busy={exporting}
      problem={exportProblem}
      onClose={() => (exportOpen = false)}
      onExport={runExport}
    />
  {/if}

  <div class="side">
    <AttributePanel
      {sections}
      count={targets.length}
      {heading}
      {references}
      onEdit={edit}
      {layoutPanel}
      {unknown}
      onRemoveUnknown={removeUnknown}
      messages={panelMessages}
    />
  </div>
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: 13.5rem minmax(0, 1fr) 20rem;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'bar bar bar' 'palette centre side';
    /* The app shell gives this a container with a height; it fills it. */
    height: 100%;
    /* Without a sized container the canvas would collapse; this keeps it usable. */
    min-height: 32rem;
    background: var(--surface);
  }
  .bar {
    grid-area: bar;
    position: relative;
    z-index: 20;
  }
  .palette-slot {
    grid-area: palette;
    min-height: 0;
    display: grid;
  }
  .centre {
    grid-area: centre;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .canvas {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .minimap {
    position: absolute;
    right: var(--gap-3);
    bottom: var(--gap-3);
    z-index: 5;
    box-shadow: var(--shadow-s);
  }
  .minimap[hidden] {
    display: none;
  }
  .side {
    grid-area: side;
    border-left: 1px solid var(--line);
    background: var(--surface);
    min-height: 0;
  }
  .dock {
    flex: none;
    display: flex;
    height: clamp(10rem, 32%, 20rem);
    border-top: 1px solid var(--line);
    background: var(--surface);
  }
  .dock-panel {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    display: grid;
    align-content: start;
  }
  .dock-panel + .dock-panel {
    border-left: 1px solid var(--line);
  }
  .close {
    position: absolute;
    top: var(--gap-2);
    right: var(--gap-2);
    z-index: 1;
  }
  .find {
    position: relative;
  }
  .find input {
    width: 12rem;
    transition: width 0.15s;
  }
  .find input:focus {
    width: 18rem;
  }
  .hits {
    position: absolute;
    z-index: 30;
    right: 0;
    top: 2.4rem;
    list-style: none;
    margin: 0;
    padding: var(--gap-1);
    width: 22rem;
    max-height: 18rem;
    overflow: auto;
  }
  .hits button {
    width: 100%;
    text-align: left;
    border-color: transparent;
  }
  .where {
    color: var(--text-muted);
    font-size: 0.8rem;
    margin-left: var(--gap-2);
  }
  .no-hits {
    position: absolute;
    z-index: 30;
    right: 0;
    top: 2.4rem;
    padding: var(--gap-2) var(--gap-3);
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-s);
    white-space: nowrap;
  }
  .label-edit {
    position: absolute;
    z-index: 10;
    resize: none;
    text-align: center;
    border: 2px solid var(--accent);
    border-radius: var(--radius-s);
    padding: var(--gap-2);
    font: inherit;
  }
  .chooser {
    position: absolute;
    z-index: 15;
    display: grid;
    padding: var(--gap-1);
    box-shadow: var(--shadow);
  }
  .chooser button {
    text-align: left;
    border-color: transparent;
    background: transparent;
  }
  .chooser button:hover {
    background: var(--hover-bg);
  }
  .warning {
    position: absolute;
    z-index: 13;
    top: var(--gap-3);
    left: 50%;
    transform: translateX(-50%);
    max-width: 70%;
    margin: 0;
    box-shadow: var(--shadow);
  }
  .notices {
    position: absolute;
    z-index: 12;
    left: var(--gap-3);
    bottom: var(--gap-3);
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--gap-1);
    max-width: 60%;
  }
  .notices li,
  .behaviour-messages li {
    display: flex;
    gap: var(--gap-3);
    align-items: flex-start;
    box-shadow: var(--shadow);
  }
  .behaviour-messages {
    position: absolute;
    z-index: 12;
    right: var(--gap-4);
    bottom: 8rem;
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--gap-2);
    max-width: 24rem;
  }
  .behaviour-messages li span,
  .notices li span {
    flex: 1;
  }
  .toast {
    position: absolute;
    z-index: 12;
    left: 50%;
    bottom: var(--gap-4);
    transform: translateX(-50%);
    /* Inverts with the theme: light text on a dark chip, or the other way round. */
    background: var(--text-strong);
    color: var(--surface);
    padding: var(--gap-2) var(--gap-4);
    border-radius: var(--radius);
    max-width: 80%;
    margin: 0;
    box-shadow: var(--shadow);
  }
</style>
