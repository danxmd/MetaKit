<script lang="ts">
  import type { ModelingAssist } from '../shell/assist';
  import type { Snippet } from 'svelte';
  import { menuBehaviour } from '../shell/menu-action';
  import Icon from './Icon.svelte';

  interface Command {
    id: string;
    label: string;
  }
  type AlignMode = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
  type DataExport = 'model-file' | 'bundle' | 'csv';

  let {
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onFit,
    onZoomIn,
    onZoomOut,
    selectedElements,
    selectedAny,
    onSelectAll,
    onDelete,
    onFind,
    onAlign,
    onDistribute,
    onAutoLayout,
    onExport,
    onExportData,
    exportBusy,
    minimapOn,
    onToggleMinimap,
    paletteOn,
    onTogglePalette,
    attributesOn,
    onToggleAttributes,
    assist,
    onAssist,
    problemsOpen,
    issueCount,
    onToggleProblems,
    consoleAvailable,
    consoleOpen,
    onToggleConsole,
    toolbarCommands,
    modelCommands,
    onRunCommand,
    trailing,
  }: {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onFit: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    selectedElements: number;
    selectedAny: boolean;
    onSelectAll: () => void;
    onDelete: () => void;
    onFind: () => void;
    onAlign: (mode: AlignMode) => void;
    onDistribute: (axis: 'horizontal' | 'vertical') => void;
    onAutoLayout: () => void;
    /** Opens the image and PDF export dialog. */
    onExport: () => void;
    /** Downloads the model as data. */
    onExportData: (kind: DataExport) => void;
    /** A data export is running; its items wait. */
    exportBusy: boolean;
    minimapOn: boolean;
    onToggleMinimap: () => void;
    paletteOn: boolean;
    onTogglePalette: () => void;
    attributesOn: boolean;
    onToggleAttributes: () => void;
    /** Help while modelling; a preference of the person, not part of the model. */
    assist: ModelingAssist;
    onAssist: (patch: Partial<ModelingAssist>) => void;
    problemsOpen: boolean;
    issueCount: number;
    onToggleProblems: () => void;
    consoleAvailable: boolean;
    consoleOpen: boolean;
    onToggleConsole: () => void;
    toolbarCommands: Command[];
    modelCommands: Command[];
    onRunCommand: (command: Command) => void;
    /** The find box, which the model view owns. */
    trailing?: Snippet;
  } = $props();

  const alignments: [AlignMode, string][] = [
    ['left', 'Align left'],
    ['centre', 'Align centres'],
    ['right', 'Align right'],
    ['top', 'Align top'],
    ['middle', 'Align middle'],
    ['bottom', 'Align bottom'],
  ];
  const dataExports: [DataExport, string, string][] = [
    [
      'model-file',
      'Model file (.mkmodel.json)',
      'The model as an editable file that MetaKit can import again',
    ],
    [
      'bundle',
      'Bundle with Kit (.mkbundle)',
      'The model and its Kit in one file, for a workspace that does not have the Kit',
    ],
    [
      'csv',
      'CSV files (.csv.zip)',
      'One table per class and relation, for a spreadsheet',
    ],
  ];
</script>

{#snippet dataItems(prefix: string)}
  {#each dataExports as [kind, label, hint] (kind)}
    <button
      onclick={() => onExportData(kind)}
      disabled={exportBusy}
      title={hint}
      data-testid="{prefix}-{kind}">{label}</button
    >
  {/each}
{/snippet}

<header class="header" data-testid="model-header">
  <div
    class="tools"
    role="toolbar"
    aria-label="Model tools"
    data-tour="model-menus"
  >
    <details class="menu" use:menuBehaviour>
      <summary>File</summary>
      <div class="menu-list">
        <button onclick={onExport} data-testid="export-open"
          >Export as image or PDF…</button
        >
        <div class="menu-sep"></div>
        <div class="menu-heading">Export data</div>
        {@render dataItems('file-export')}
      </div>
    </details>

    <details class="menu" use:menuBehaviour>
      <summary>Edit</summary>
      <div class="menu-list">
        <button onclick={onUndo} disabled={!canUndo}
          >Undo<span class="keys">Ctrl+Z</span></button
        >
        <button onclick={onRedo} disabled={!canRedo}
          >Redo<span class="keys">Ctrl+Shift+Z</span></button
        >
        <div class="menu-sep"></div>
        <button onclick={onFind}>Find<span class="keys">Ctrl+F</span></button>
        <button onclick={onSelectAll}
          >Select all<span class="keys">Ctrl+A</span></button
        >
        <button onclick={onDelete} disabled={!selectedAny}
          >Delete selection<span class="keys">Del</span></button
        >
      </div>
    </details>

    <details class="menu" use:menuBehaviour>
      <summary>View</summary>
      <div class="menu-list">
        <button onclick={onFit}>Fit to window</button>
        <button onclick={onZoomIn}>Zoom in</button>
        <button onclick={onZoomOut}>Zoom out</button>
        <div class="menu-sep"></div>
        <button
          role="menuitemcheckbox"
          aria-checked={minimapOn}
          onclick={onToggleMinimap}
          data-testid="minimap-toggle">{minimapOn ? '✓ ' : ''}Minimap</button
        >
        <button
          role="menuitemcheckbox"
          aria-checked={paletteOn}
          onclick={onTogglePalette}
          data-testid="palette-toggle">{paletteOn ? '✓ ' : ''}Palette</button
        >
        <button
          role="menuitemcheckbox"
          aria-checked={attributesOn}
          onclick={onToggleAttributes}
          data-testid="attributes-toggle"
          >{attributesOn ? '✓ ' : ''}Attribute panel</button
        >
        <div class="menu-sep"></div>
        <div class="menu-heading">Assistance</div>
        <button
          role="menuitemcheckbox"
          aria-checked={assist.hints}
          onclick={() => onAssist({ hints: !assist.hints })}
          title="Short hints about what you are doing and what a relation connects"
          data-testid="assist-hints"
          >{assist.hints ? '✓ ' : ''}Interaction hints</button
        >
        <button
          role="menuitemcheckbox"
          aria-checked={assist.smart}
          onclick={() => onAssist({ smart: !assist.smart })}
          title="Hover a concept to see what it can be connected to"
          data-testid="assist-smart"
          >{assist.smart ? '✓ ' : ''}Smart modelling</button
        >
      </div>
    </details>

    <details class="menu" use:menuBehaviour>
      <summary>Arrange</summary>
      <div class="menu-list">
        <div class="menu-heading">Align</div>
        {#each alignments as [mode, label] (mode)}
          <button disabled={selectedElements < 2} onclick={() => onAlign(mode)}
            >{label}</button
          >
        {/each}
        <div class="menu-heading">Distribute</div>
        <button
          disabled={selectedElements < 3}
          onclick={() => onDistribute('horizontal')}
          >Distribute horizontally</button
        >
        <button
          disabled={selectedElements < 3}
          onclick={() => onDistribute('vertical')}>Distribute vertically</button
        >
        <div class="menu-sep"></div>
        <button onclick={onAutoLayout} data-testid="auto-layout"
          >Auto-layout</button
        >
      </div>
    </details>

    <details class="menu" use:menuBehaviour>
      <summary data-tour="model-check"
        >Check{#if issueCount > 0}<span class="badge count">{issueCount}</span
          >{/if}</summary
      >
      <div class="menu-list">
        <button
          onclick={onToggleProblems}
          aria-expanded={problemsOpen}
          data-testid="problems-toggle"
          >Problems{#if issueCount > 0}<span class="badge count"
              >{issueCount}</span
            >{/if}</button
        >
        {#if consoleAvailable}
          <button
            onclick={onToggleConsole}
            aria-expanded={consoleOpen}
            data-testid="console-toggle">Script console</button
          >
        {/if}
      </div>
    </details>

    {#if modelCommands.length > 0}
      <details class="menu" use:menuBehaviour data-testid="commands-menu">
        <summary>Commands</summary>
        <div class="menu-list">
          {#each modelCommands as command (command.id)}
            <button
              onclick={() => onRunCommand(command)}
              data-testid="command-{command.id}">{command.label}</button
            >
          {/each}
        </div>
      </details>
    {/if}

    <span class="sep"></span>

    <button
      class="icon ghost"
      onclick={onUndo}
      disabled={!canUndo}
      aria-label="Undo"
      title="Undo (Ctrl+Z)"
      data-tour="model-undo"
    >
      <Icon name="undo" />
    </button>
    <button
      class="icon ghost"
      onclick={onRedo}
      disabled={!canRedo}
      aria-label="Redo"
      title="Redo (Ctrl+Shift+Z)"
    >
      <Icon name="redo" />
    </button>

    <span class="sep"></span>

    <button
      class="icon ghost"
      onclick={onZoomOut}
      aria-label="Zoom out"
      title="Zoom out"><Icon name="zoom-out" /></button
    >
    <button
      class="icon ghost"
      onclick={onFit}
      aria-label="Fit to window"
      title="Show the whole model"
    >
      <Icon name="fit" />
    </button>
    <button
      class="icon ghost"
      onclick={onZoomIn}
      aria-label="Zoom in"
      title="Zoom in"><Icon name="zoom-in" /></button
    >

    <span class="sep"></span>

    <details class="menu export" use:menuBehaviour>
      <summary data-testid="model-export-menu" title="Export this model"
        ><Icon name="export" />Export</summary
      >
      <div class="menu-list">
        <button onclick={onExport} data-testid="model-export-image"
          >Image or PDF…</button
        >
        {@render dataItems('model-export')}
      </div>
    </details>

    {#if toolbarCommands.length > 0}
      <span class="sep"></span>
      {#each toolbarCommands as command (command.id)}
        <button
          onclick={() => onRunCommand(command)}
          data-testid="command-{command.id}">{command.label}</button
        >
      {/each}
    {/if}

    <span class="grow"></span>
    {@render trailing?.()}
  </div>
</header>

<style>
  .header {
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-2);
    padding: var(--gap-2) var(--gap-4);
    min-width: 0;
  }
  .grow {
    flex: 1;
  }
  .sep {
    width: 1px;
    height: 1.2rem;
    background: var(--line);
    margin: 0 var(--gap-1);
  }
  .keys {
    float: right;
    margin-left: var(--gap-5);
    color: var(--text-faint);
    font-size: 0.72rem;
  }
  .export > summary {
    display: inline-flex;
    align-items: center;
    gap: var(--gap-2);
  }
  .badge.count {
    margin-left: var(--gap-2);
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
