<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { isTypingTarget } from '../../docs/context';
  import { tours, type TourSnapshot } from '../../tours/tour-state';
  import { placePopup, type Box } from '../../tours/placement';

  /** How long a step looks for its control before it says the control is not shown. */
  const WAIT_MS = 1500;
  /** Room around the control inside the cut-out. */
  const PAD = 6;

  let snap = $state<TourSnapshot>(tours.get());
  onMount(() => tours.subscribe((s) => (snap = s)));

  const run = $derived(snap.run);
  const step = $derived(run ? run.tour.steps[run.index] : undefined);
  const last = $derived(run ? run.index === run.tour.steps.length - 1 : false);

  let status = $state<'searching' | 'found' | 'missing'>('searching');
  let target = $state<Box | null>(null);
  let popup: HTMLDivElement | undefined = $state();
  let popupWidth = $state(320);
  let popupHeight = $state(160);
  let innerWidth = $state(0);
  let innerHeight = $state(0);

  const shown = (el: HTMLElement) =>
    el.isConnected && el.getClientRects().length > 0;

  function sameBox(a: Box | null, b: Box | null) {
    return (
      a === b ||
      (!!a &&
        !!b &&
        a.x === b.x &&
        a.y === b.y &&
        a.width === b.width &&
        a.height === b.height)
    );
  }

  // Looks for the step's control, follows it while the page changes, and skips or reports it when
  // it is not there.
  $effect(() => {
    const current = step;
    if (!current) return;
    status = 'searching';
    target = null;
    const started = performance.now();
    const selector = `[data-tour="${CSS.escape(current.anchor)}"]`;
    let el: HTMLElement | null = null;
    let skipped = false;
    const observer = new ResizeObserver(() => measure());

    function measure() {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next = {
        x: Math.round(r.left - PAD),
        y: Math.round(r.top - PAD),
        width: Math.round(r.width + 2 * PAD),
        height: Math.round(r.height + 2 * PAD),
      };
      if (!sameBox(target, next)) target = next;
    }

    function look() {
      if (skipped) return;
      if (el && shown(el)) {
        // Menus opening or lists changing move the control without resizing it.
        measure();
        return;
      }
      if (el) observer.unobserve(el);
      el = null;
      const found = document.querySelector<HTMLElement>(selector);
      if (found && shown(found)) {
        el = found;
        found.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        observer.observe(found);
        measure();
        status = 'found';
        return;
      }
      target = null;
      if (performance.now() - started < WAIT_MS) {
        if (status !== 'searching') status = 'searching';
        return;
      }
      if (current!.optional) {
        skipped = true;
        tours.skip();
        return;
      }
      status = 'missing';
    }

    // The first look reads the state it sets; it must not make this effect depend on it.
    untrack(look);
    const timer = setInterval(look, 150);
    observer.observe(document.documentElement);
    const onScroll = () => measure();
    window.addEventListener('scroll', onScroll, true);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll, true);
    };
  });

  // Focus goes to the pop-up while a tour runs and back to where it was when the tour ends.
  let returnFocus: HTMLElement | null = null;
  let running = false;
  $effect(() => {
    const on = !!run;
    void run?.index;
    if (on && !running) {
      running = true;
      returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    } else if (!on && running) {
      running = false;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
    if (on)
      void tick().then(() => {
        if (popup && !popup.contains(document.activeElement))
          popup.focus({ preventScroll: true });
      });
  });

  $effect(() => {
    if (!run) return;
    const onKey = (event: KeyboardEvent) => {
      const inPopup =
        event.target instanceof Node && !!popup?.contains(event.target);
      if (!inPopup && isTypingTarget(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        tours.end();
        return;
      }
      // Elsewhere the arrows belong to the page (the canvas, lists), so only the pop-up takes them.
      if (!inPopup) return;
      const onButton = event.target instanceof HTMLButtonElement;
      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        (event.key === 'Enter' && !onButton)
      ) {
        event.preventDefault();
        tours.next();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        tours.back();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const hole = $derived(status === 'found' ? target : null);
  const placed = $derived(
    placePopup(
      hole,
      { width: popupWidth, height: popupHeight },
      { width: innerWidth, height: innerHeight },
      step?.placement,
    ),
  );
  /** Where the little arrow sits along the pop-up's edge, pointing at the control. */
  const arrow = $derived.by(() => {
    if (!hole || !placed.side) return null;
    const horizontal = placed.side === 'left' || placed.side === 'right';
    const along = horizontal
      ? hole.y + hole.height / 2 - placed.y
      : hole.x + hole.width / 2 - placed.x;
    const size = horizontal ? popupHeight : popupWidth;
    return Math.max(16, Math.min(size - 16, along));
  });

  const r = 8;
  const backdrop = $derived.by(() => {
    const outer = `M0 0H${innerWidth}V${innerHeight}H0Z`;
    if (!hole) return outer;
    const { x, y, width: w, height: h } = hole;
    return `${outer}M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  });
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#if run && step}
  <div
    class="tour-layer"
    data-testid="tour-layer"
    data-tour-id={run.tour.id}
    data-tour-step={run.index}
    data-tour-anchor={step.anchor}
    data-tour-missing={status === 'searching'
      ? undefined
      : String(status === 'missing')}
  >
    <!-- The dim does not catch clicks: the highlighted control, and Help, stay usable. -->
    <svg
      class="backdrop"
      width={innerWidth}
      height={innerHeight}
      aria-hidden="true"
    >
      <path d={backdrop} fill-rule="evenodd" />
    </svg>
    {#if hole}
      <div
        class="ring"
        style:left="{hole.x}px"
        style:top="{hole.y}px"
        style:width="{hole.width}px"
        style:height="{hole.height}px"
      ></div>
    {/if}
    <div
      bind:this={popup}
      bind:offsetWidth={popupWidth}
      bind:offsetHeight={popupHeight}
      class="pop card"
      data-side={placed.side}
      style:left="{placed.x}px"
      style:top="{placed.y}px"
      style:--arrow={arrow === null ? undefined : `${arrow}px`}
      role="dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      tabindex="-1"
      data-testid="tour-popup"
    >
      <div class="head">
        <span class="tour-name">{run.tour.title}</span>
        <span class="count" data-testid="tour-count"
          >{run.index + 1} of {run.tour.steps.length}</span
        >
      </div>
      <h2 id="tour-title">{step.title}</h2>
      <p id="tour-text">{step.text}</p>
      {#if status === 'missing'}
        <p class="notice warning missing" data-testid="tour-missing">
          This part of the page is not shown right now.
        </p>
      {/if}
      <div class="actions">
        <button
          type="button"
          class="ghost"
          onclick={() => tours.end()}
          data-testid="tour-end">End tour</button
        >
        <span class="spacer"></span>
        <button
          type="button"
          disabled={run.index === 0}
          onclick={() => tours.back()}
          data-testid="tour-back">Back</button
        >
        <button
          type="button"
          class="primary"
          onclick={() => tours.next()}
          data-testid="tour-next">{last ? 'Finish' : 'Next'}</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .tour-layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    pointer-events: none;
  }
  .backdrop {
    position: absolute;
    inset: 0;
  }
  .backdrop path {
    fill: var(--overlay);
    /* Lighter than a dialog's backdrop: the page under a tour should stay readable. */
    opacity: 0.8;
  }
  .ring {
    position: absolute;
    border: 2px solid var(--accent);
    border-radius: 8px;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
    transition:
      left 0.18s,
      top 0.18s,
      width 0.18s,
      height 0.18s;
  }
  .pop {
    position: absolute;
    width: min(21rem, calc(100vw - 24px));
    padding: var(--gap-4);
    display: grid;
    gap: var(--gap-2);
    pointer-events: auto;
    box-shadow: var(--shadow-l);
    border-color: var(--line-strong);
    outline: none;
  }
  .pop:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  /* A small arrow on the side that faces the control. */
  .pop[data-side]::before {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    transform: rotate(45deg);
  }
  .pop[data-side='right']::before {
    left: -7px;
    top: calc(var(--arrow, 50%) - 6px);
    border-top-color: transparent;
    border-right-color: transparent;
  }
  .pop[data-side='left']::before {
    right: -7px;
    top: calc(var(--arrow, 50%) - 6px);
    border-bottom-color: transparent;
    border-left-color: transparent;
  }
  .pop[data-side='bottom']::before {
    top: -7px;
    left: calc(var(--arrow, 50%) - 6px);
    border-bottom-color: transparent;
    border-right-color: transparent;
  }
  .pop[data-side='top']::before {
    bottom: -7px;
    left: calc(var(--arrow, 50%) - 6px);
    border-top-color: transparent;
    border-left-color: transparent;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: var(--gap-2);
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .tour-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .count {
    flex: none;
  }
  h2 {
    font-size: var(--text-m);
  }
  p {
    font-size: var(--text-s);
    color: var(--text);
  }
  .missing {
    padding: var(--gap-2) var(--gap-3);
  }
  .actions {
    display: flex;
    gap: var(--gap-2);
    align-items: center;
    margin-top: var(--gap-1);
  }
  .actions .ghost {
    padding-left: var(--gap-2);
    padding-right: var(--gap-2);
    color: var(--text-muted);
  }
  .spacer {
    flex: 1;
  }
</style>
