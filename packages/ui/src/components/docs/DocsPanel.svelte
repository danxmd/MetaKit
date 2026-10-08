<script lang="ts">
  import { onMount } from 'svelte';
  import type { DocContext, DocsIndex } from '@metakit-app/docs';
  import {
    clampDocsWidth,
    DOCS_MIN_WIDTH,
    docsContext,
    docsOpen,
    docsPanelNav,
    OVERVIEW,
    setDocsWidth,
    type NavState,
    type PanelState,
  } from '../../docs/context';
  import { loadDocsIndex } from '../../docs/load';
  import DocsOverview from './DocsOverview.svelte';
  import DocsReader from './DocsReader.svelte';
  import DocsSearch from './DocsSearch.svelte';

  let {
    onClose,
    onOpenInDocs,
  }: {
    onClose: () => void;
    /** Opens the Documentation area, at this topic when there is one. */
    onOpenInDocs: (topicId: string | null) => void;
  } = $props();

  let ctx = $state<DocContext>(docsContext.get());
  let panel = $state<PanelState>(docsOpen.get());
  let nav = $state<NavState>({
    current: null,
    canBack: false,
    canForward: false,
    following: true,
  });
  let index = $state<DocsIndex | null>(null);
  let failed = $state(false);
  let searching = $state(false);
  let viewport = $state(
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  let aside: HTMLElement | undefined = $state();

  onMount(() => {
    const stops = [
      docsContext.subscribe((c) => (ctx = c)),
      docsOpen.subscribe((p) => (panel = p)),
      docsPanelNav.subscribe((n) => (nav = n)),
    ];
    loadDocsIndex().then(
      (loaded) => (index = loaded),
      () => (failed = true),
    );
    return () => stops.forEach((stop) => stop());
  });

  const pageTopic = $derived(index?.resolveContext(ctx));
  const pageId = $derived(pageTopic?.id ?? OVERVIEW);

  $effect(() => {
    // Opens at the page's topic, and moves along with the page while the reader follows it.
    if (index) docsPanelNav.syncPage(pageId);
  });

  const topic = $derived(
    index && nav.current && nav.current.id !== OVERVIEW
      ? index.get(nav.current.id)
      : undefined,
  );
  const width = $derived(clampDocsWidth(panel.width, viewport));

  function go(id: string, anchor: string | null = null) {
    docsPanelNav.navigate(id, anchor);
  }

  // Resizing: the bar is docked on the right, so its width is the distance to the window edge.
  function drag(event: PointerEvent) {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const right = aside?.getBoundingClientRect().right ?? window.innerWidth;
    const move = (e: PointerEvent) =>
      setDocsWidth(clampDocsWidth(right - e.clientX, window.innerWidth));
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function resizeKey(event: KeyboardEvent) {
    const step = event.shiftKey ? 80 : 24;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setDocsWidth(clampDocsWidth(width + step, viewport));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setDocsWidth(clampDocsWidth(width - step, viewport));
    }
  }
</script>

<svelte:window bind:innerWidth={viewport} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside
  bind:this={aside}
  class="docs-panel"
  style="--docs-w: {width}px"
  aria-label="Help"
  data-testid="docs-panel"
  data-context={ctx}
  data-topic={topic?.id ?? ''}
  onkeydown={(e) => {
    if (e.key === 'Escape' && !searching) {
      e.stopPropagation();
      onClose();
    }
  }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
  <div
    class="resize"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize the Help side bar"
    aria-valuemin={DOCS_MIN_WIDTH}
    aria-valuenow={width}
    tabindex="0"
    onpointerdown={drag}
    onkeydown={resizeKey}
    data-testid="docs-resize"
  ></div>
  <div class="column">
    <header>
      <div class="row">
        <button
          type="button"
          class="icon"
          disabled={!nav.canBack}
          onclick={() => docsPanelNav.back()}
          aria-label="Back"
          title="Back"
          data-testid="docs-back">←</button
        >
        <button
          type="button"
          class="icon"
          disabled={!nav.canForward}
          onclick={() => docsPanelNav.forward()}
          aria-label="Forward"
          title="Forward"
          data-testid="docs-forward">→</button
        >
        <button
          type="button"
          class="ghost"
          disabled={!index || (nav.following && nav.current?.id === pageId)}
          onclick={() => docsPanelNav.followPage(pageId)}
          title="Show the topic for the page you are on"
          data-testid="docs-this-page">This page</button
        >
        <span class="spacer"></span>
        <button
          type="button"
          class="ghost"
          onclick={() => onOpenInDocs(topic?.id ?? null)}
          title="Open the full Documentation"
          data-testid="docs-open-area">Open in Documentation</button
        >
        <button
          type="button"
          class="icon"
          onclick={onClose}
          aria-label="Close Help"
          title="Close Help"
          data-testid="docs-close">×</button
        >
      </div>
    </header>
    <DocsSearch
      {index}
      onOpen={(id) => go(id)}
      onQuery={(q) => (searching = q !== '')}
    />

    {#if !searching}
      <div class="body">
        {#if failed}
          <p class="notice error pad" role="alert">
            The documentation could not be loaded. Check your connection and
            open Help again.
          </p>
        {:else if !index}
          <p class="muted pad" data-testid="docs-loading">Loading…</p>
        {:else if topic}
          <DocsReader
            {index}
            {topic}
            anchor={nav.current?.anchor ?? null}
            idPrefix="help"
            onNavigate={go}
          />
        {:else}
          <DocsOverview
            {index}
            onNavigate={(id) => go(id)}
            note={nav.current && nav.current.id !== OVERVIEW
              ? 'That topic does not exist.'
              : pageTopic
                ? undefined
                : 'There is no topic for this page yet. Choose one below.'}
          />
        {/if}
      </div>
    {/if}
  </div>
</aside>

<style>
  .docs-panel {
    position: relative;
    flex: none;
    width: var(--docs-w);
    min-width: 0;
    display: flex;
    background: var(--surface);
    border-left: 1px solid var(--line);
    min-height: 0;
  }
  .resize {
    position: absolute;
    left: -3px;
    top: 0;
    bottom: 0;
    width: 7px;
    cursor: col-resize;
    z-index: 2;
    touch-action: none;
  }
  .resize:hover,
  .resize:focus-visible,
  .resize:active {
    background: var(--accent-soft);
    outline: none;
  }
  .column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  header {
    flex: none;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--gap-1);
    padding: var(--gap-2) var(--gap-3);
    flex-wrap: wrap;
  }
  .spacer {
    flex: 1;
  }
  .body {
    flex: 1;
    min-height: 0;
  }
  .pad {
    padding: var(--gap-3) var(--gap-4);
  }

  /* On narrow windows the bar covers the page instead of squeezing it. */
  @media (max-width: 760px) {
    .docs-panel {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(var(--docs-w), 100%);
      z-index: 30;
      box-shadow: var(--shadow-l);
    }
    .resize {
      display: none;
    }
  }
</style>
