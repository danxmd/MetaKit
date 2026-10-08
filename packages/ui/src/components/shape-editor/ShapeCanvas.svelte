<script lang="ts">
  import { paintOps, type ImageCache } from '@metakit-app/canvas';
  import { hitTestParts, type PartBox } from '@metakit-app/shapes';
  import type { ShapeEditorModel } from '../../build/shape-editor-model';

  let {
    model,
    version,
    images,
  }: {
    model: ShapeEditorModel;
    version: number;
    images: ImageCache;
  } = $props();

  /** Room around the shape so that handles on its edge stay inside the canvas. */
  const PAD = 28;
  const ZOOMS = [0.5, 1, 1.5, 2, 3, 4];
  const HANDLE = 4;
  const HIT = 7;

  type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  const CURSOR: Record<Handle, string> = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
  };

  let canvas: HTMLCanvasElement | undefined = $state();
  // A canvas cannot take the application role, so its wrapper holds the focus and the keys.
  let focusTarget: HTMLDivElement | undefined = $state();
  let zoom = $state(2);
  let zoomChosen = false;

  const size = $derived.by(() => {
    void version;
    return model.draft.size;
  });
  const cssWidth = $derived(Math.round(size.width * zoom + PAD * 2));
  const cssHeight = $derived(Math.round(size.height * zoom + PAD * 2));

  // A new shape starts at the largest zoom that fits the usual workspace; after that it is the
  // user's choice.
  $effect(() => {
    if (zoomChosen) return;
    const fit = ZOOMS.filter(
      (z) => size.width * z <= 520 && size.height * z <= 300,
    );
    zoom = fit[fit.length - 1] ?? ZOOMS[0]!;
  });

  function setZoom(next: number) {
    zoomChosen = true;
    zoom = next;
  }

  function stepZoom(delta: number) {
    const i = ZOOMS.indexOf(zoom);
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + delta))];
    if (next !== undefined) setZoom(next);
  }

  function handlePoints(box: PartBox['box']): [Handle, number, number][] {
    const x0 = PAD + box.x * zoom;
    const y0 = PAD + box.y * zoom;
    const x1 = x0 + box.w * zoom;
    const y1 = y0 + box.h * zoom;
    const xm = (x0 + x1) / 2;
    const ym = (y0 + y1) / 2;
    return [
      ['nw', x0, y0],
      ['n', xm, y0],
      ['ne', x1, y0],
      ['e', x1, ym],
      ['se', x1, y1],
      ['s', xm, y1],
      ['sw', x0, y1],
      ['w', x0, ym],
    ];
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cssWidth;
    const h = cssHeight;
    if (canvas.width !== Math.round(w * dpr))
      canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr))
      canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const sw = size.width * zoom;
    const sh = size.height * zoom;
    // Theme colours are read at draw time so the canvas follows light and dark mode.
    const css = getComputedStyle(canvas);
    const token = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    const paper = token('--canvas-bg', '#ffffff');
    const gridColour = token('--canvas-grid', '#f1f3f5');
    const edgeColour = token('--canvas-grid-strong', '#adb5bd');
    const selectColour = token('--canvas-selection', '#364fc7');
    ctx.fillStyle = paper;
    ctx.fillRect(PAD, PAD, sw, sh);
    // A faint grid every 10 px of the shape; the drag snaps to whole pixels.
    ctx.strokeStyle = gridColour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 10; gx < size.width; gx += 10) {
      ctx.moveTo(PAD + gx * zoom + 0.5, PAD);
      ctx.lineTo(PAD + gx * zoom + 0.5, PAD + sh);
    }
    for (let gy = 10; gy < size.height; gy += 10) {
      ctx.moveTo(PAD, PAD + gy * zoom + 0.5);
      ctx.lineTo(PAD + sw, PAD + gy * zoom + 0.5);
    }
    ctx.stroke();

    ctx.save();
    ctx.translate(PAD, PAD);
    ctx.scale(zoom, zoom);
    paintOps(ctx, model.compilePreview(1).compiled.ops, {
      scale: zoom * dpr,
      minTextPx: 0,
      images,
    });
    ctx.restore();

    ctx.strokeStyle = edgeColour;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(PAD - 0.5, PAD - 0.5, sw + 1, sh + 1);
    ctx.setLineDash([]);

    const paths = model.selectedPaths;
    const primary = model.selection;
    for (const p of paths) {
      const b = model.boxOf(p);
      if (!b) continue;
      ctx.strokeStyle = selectColour;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(b.exact ? [] : [4, 3]);
      ctx.strokeRect(
        PAD + b.box.x * zoom,
        PAD + b.box.y * zoom,
        b.box.w * zoom,
        b.box.h * zoom,
      );
      ctx.setLineDash([]);
      if (b.exact && primary && p === primary)
        for (const [, hx, hy] of handlePoints(b.box)) {
          ctx.fillStyle = paper;
          ctx.fillRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2);
          ctx.strokeRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2);
        }
    }
  }

  $effect(() => {
    void version;
    void zoom;
    void cssWidth;
    void cssHeight;
    draw();
  });

  // Draw again when the theme switch changes data-theme.
  $effect(() => {
    const observer = new MutationObserver(() => draw());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  });

  // Pointer handling ------------------------------------------------------------------------

  type Drag =
    | { kind: 'move'; x: number; y: number; ax: number; ay: number }
    | {
        kind: 'resize';
        handle: Handle;
        x: number;
        y: number;
        ax: number;
        ay: number;
        w: number;
        h: number;
      };
  let drag: Drag | null = null;
  let began = false;

  function local(e: PointerEvent) {
    const r = canvas!.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  function handleAt(sx: number, sy: number): Handle | null {
    const path = model.selection;
    const b = path ? model.boxOf(path) : undefined;
    if (!b || !b.exact) return null;
    for (const [h, hx, hy] of handlePoints(b.box))
      if (Math.abs(sx - hx) <= HIT && Math.abs(sy - hy) <= HIT) return h;
    return null;
  }

  function down(e: PointerEvent) {
    if (e.button !== 0 || !canvas) return;
    focusTarget?.focus();
    const { sx, sy } = local(e);
    const handle = handleAt(sx, sy);
    if (handle) {
      const b = model.boxOf(model.selection!)!;
      drag = {
        kind: 'resize',
        handle,
        x: sx,
        y: sy,
        ax: 0,
        ay: 0,
        w: b.box.w,
        h: b.box.h,
      };
    } else {
      const x = (sx - PAD) / zoom;
      const y = (sy - PAD) / zoom;
      const hit = hitTestParts(model.boxes(), x, y);
      if (hit === null) {
        if (!(e.shiftKey || e.ctrlKey || e.metaKey)) model.select(null);
        return;
      }
      if (e.shiftKey || e.ctrlKey || e.metaKey) model.toggleSelect(hit);
      else if (!model.isSelected(hit)) model.select(hit);
      const movable = model.selectedPaths.every(
        (p) => model.boxOf(p)?.exact ?? false,
      );
      if (!movable) return;
      drag = { kind: 'move', x: sx, y: sy, ax: 0, ay: 0 };
    }
    began = false;
    canvas.setPointerCapture(e.pointerId);
  }

  function moved(e: PointerEvent) {
    const { sx, sy } = local(e);
    if (!drag) {
      const h = handleAt(sx, sy);
      if (canvas) canvas.style.cursor = h ? CURSOR[h] : 'default';
      return;
    }
    // Whole pixels of the shape, so numbers stay tidy.
    const tx = Math.round((sx - drag.x) / zoom);
    const ty = Math.round((sy - drag.y) / zoom);
    const dx = tx - drag.ax;
    const dy = ty - drag.ay;
    if (dx === 0 && dy === 0) return;
    if (!began) {
      model.beginGesture();
      began = true;
    }
    if (drag.kind === 'move') {
      model.moveSelected(dx, dy);
    } else {
      const h = drag.handle;
      const change: { dw?: number; dh?: number; dx?: number; dy?: number } = {};
      let nextW = drag.w;
      let nextH = drag.h;
      if (h.includes('e')) {
        change.dw = dx;
        nextW += dx;
      }
      if (h.includes('w')) {
        change.dx = dx;
        change.dw = -dx;
        nextW -= dx;
      }
      if (h.includes('s')) {
        change.dh = dy;
        nextH += dy;
      }
      if (h.includes('n')) {
        change.dy = dy;
        change.dh = -dy;
        nextH -= dy;
      }
      // A part never shrinks to nothing; the pointer may go further and come back.
      if (nextW < 1 || nextH < 1) return;
      drag.w = nextW;
      drag.h = nextH;
      model.resizeSelected(change);
    }
    drag.ax = tx;
    drag.ay = ty;
  }

  function up(e: PointerEvent) {
    if (!drag) return;
    if (began) model.endGesture();
    drag = null;
    began = false;
    if (canvas?.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  }

  function key(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    const step = e.shiftKey ? 10 : 1;
    if (mod && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) model.redo();
      else model.undo();
    } else if (mod && e.key.toLowerCase() === 'y') model.redo();
    else if (mod && e.key.toLowerCase() === 'd') model.duplicateSelected();
    else if (e.key === 'Delete' || e.key === 'Backspace')
      model.removeSelected();
    else if (e.key === 'Escape') model.select(null);
    else if (e.key === 'ArrowLeft') model.moveSelected(-step, 0);
    else if (e.key === 'ArrowRight') model.moveSelected(step, 0);
    else if (e.key === 'ArrowUp') model.moveSelected(0, -step);
    else if (e.key === 'ArrowDown') model.moveSelected(0, step);
    else return;
    e.preventDefault();
  }
</script>

<section class="stage" aria-label="Shape canvas">
  <div class="zoom">
    <button
      type="button"
      aria-label="Zoom out"
      disabled={zoom <= ZOOMS[0]!}
      data-testid="shape-zoom-out"
      onclick={() => stepZoom(-1)}
    >
      -
    </button>
    <span aria-live="polite" data-testid="shape-zoom"
      >{Math.round(zoom * 100)}%</span
    >
    <button
      type="button"
      aria-label="Zoom in"
      disabled={zoom >= ZOOMS[ZOOMS.length - 1]!}
      data-testid="shape-zoom-in"
      onclick={() => stepZoom(1)}
    >
      +
    </button>
  </div>
  <div class="scroll">
    <!-- The application role is the right one for a drawing surface; Svelte does not know it as interactive. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      bind:this={focusTarget}
      tabindex="0"
      role="application"
      aria-label="Shape canvas. Click a part to select it, drag to move it, use the arrow keys to nudge it."
      data-testid="shape-canvas-focus"
      onkeydown={key}
    >
      <canvas
        bind:this={canvas}
        data-testid="shape-canvas"
        style:width={`${cssWidth}px`}
        style:height={`${cssHeight}px`}
        onpointerdown={down}
        onpointermove={moved}
        onpointerup={up}
        onpointercancel={up}
      ></canvas>
    </div>
  </div>
</section>

<style>
  .stage {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
    min-height: 0;
  }
  .zoom {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .scroll {
    overflow: auto;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  canvas {
    display: block;
    touch-action: none;
  }
</style>
