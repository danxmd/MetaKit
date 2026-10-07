<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExportFormat, ExportRequest } from '../shell/download';

  let {
    onExport,
    onClose,
    hasSelection,
    busy = false,
    problem = null,
  }: {
    onExport: (request: ExportRequest) => Promise<void>;
    onClose: () => void;
    /** Whether anything is selected; without a selection only the whole model can be exported. */
    hasSelection: boolean;
    busy?: boolean;
    problem?: string | null;
  } = $props();

  let format = $state<ExportFormat>('png');
  let scope = $state<'model' | 'selection' | null>(null);
  let scale = $state<1 | 2 | 3 | 4>(2);
  let transparent = $state(false);
  let pageSize = $state<'a4' | 'a3' | 'letter' | 'fit'>('a4');
  let orientation = $state<'portrait' | 'landscape' | 'auto'>('auto');
  let fitToPage = $state(true);
  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => dialog?.showModal());

  // Without a selection the option is disabled, so a stale choice must not survive.
  const effectiveScope = $derived(
    hasSelection ? (scope ?? 'selection') : 'model',
  );

  async function submit(event: Event) {
    event.preventDefault();
    if (busy) return;
    const request: ExportRequest = { format, scope: effectiveScope };
    if (format === 'png') {
      request.scale = scale;
      request.transparent = transparent;
    }
    if (format === 'pdf') {
      request.pageSize = pageSize;
      request.orientation = orientation;
      request.fitToPage = fitToPage;
    }
    await onExport(request);
  }
</script>

<dialog
  bind:this={dialog}
  onclose={onClose}
  aria-labelledby="export-title"
  data-testid="export-dialog"
>
  <form onsubmit={submit}>
    <h2 id="export-title">Export image</h2>

    <label>
      Format
      <select bind:value={format} disabled={busy} data-testid="export-format">
        <option value="png">PNG image</option>
        <option value="svg">SVG (editable vector, text stays text)</option>
        <option value="pdf">PDF document</option>
      </select>
    </label>

    <label>
      What to export
      <select
        value={effectiveScope}
        onchange={(e) =>
          (scope = e.currentTarget.value as 'model' | 'selection')}
        disabled={busy || !hasSelection}
        data-testid="export-scope"
      >
        <option value="model">The whole model</option>
        <option value="selection">The selection only</option>
      </select>
    </label>
    {#if !hasSelection}
      <p class="hint">Select some objects first to export only those.</p>
    {/if}

    {#if format === 'png'}
      <label>
        Size
        <select
          value={String(scale)}
          onchange={(e) =>
            (scale = Number(e.currentTarget.value) as 1 | 2 | 3 | 4)}
          disabled={busy}
          data-testid="export-scale"
        >
          <option value="1">1x (screen size)</option>
          <option value="2">2x</option>
          <option value="3">3x</option>
          <option value="4">4x (print quality)</option>
        </select>
      </label>
      <label class="check">
        <input
          type="checkbox"
          bind:checked={transparent}
          disabled={busy}
          data-testid="export-transparent"
        />
        Transparent background
      </label>
    {/if}

    {#if format === 'pdf'}
      <label>
        Page size
        <select
          bind:value={pageSize}
          disabled={busy}
          data-testid="export-page-size"
        >
          <option value="a4">A4</option>
          <option value="a3">A3</option>
          <option value="letter">US Letter</option>
          <option value="fit">One page sized to the drawing</option>
        </select>
      </label>
      {#if pageSize !== 'fit'}
        <label>
          Orientation
          <select
            bind:value={orientation}
            disabled={busy}
            data-testid="export-orientation"
          >
            <option value="auto">Automatic</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            bind:checked={fitToPage}
            disabled={busy}
            data-testid="export-fit"
          />
          Fit the drawing to one page
        </label>
      {/if}
    {/if}

    {#if problem}<p role="alert" class="notice error">{problem}</p>{/if}

    <div class="actions">
      <button type="button" onclick={() => dialog?.close()}>Cancel</button>
      <button
        class="primary"
        type="submit"
        disabled={busy}
        aria-busy={busy}
        data-testid="export-go"
      >
        {busy ? 'Exporting…' : 'Export'}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    min-width: 22rem;
  }
  form {
    display: grid;
    gap: 0.8rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .hint {
    margin: -0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--muted, #5c6670);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .notice {
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    background: #fff5f5;
    margin: 0;
  }
</style>
