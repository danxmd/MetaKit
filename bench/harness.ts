// Runs inside Chromium. Builds the 5,000-element, 7,000-connector model with the real core types
// and drives the real editor with synthetic pointer events, one per animation frame.
import {
  createModelStore,
  MODEL_FORMAT_VERSION,
  type ConnectorData,
  type ConnectorId,
  type ElementData,
  type ElementId,
  type Model,
  type ToolLibrary,
} from '@metakit-app/core';
import { CanvasView, Editor, Scene } from '@metakit-app/canvas';

export interface Stats {
  p50: number;
  p95: number;
  max: number;
  slowPct: number;
}

export interface Row {
  scenario: string;
  frames: number;
  intervalMs: Stats;
  workMs: Stats;
  oneOffMs: Record<string, number>;
}

export interface Report {
  rows: Row[];
  openMs: number;
  attributeEditMs: number;
  userAgent: string;
  viewport: string;
  elements: number;
  connectors: number;
}

function stats(values: number[]): Stats {
  if (values.length === 0) return { p50: 0, p95: 0, max: 0, slowPct: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return {
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1]!,
    slowPct: (100 * values.filter((v) => v > 20).length) / values.length,
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
function idPart(n: number): string {
  let out = '';
  let rest = n;
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[rest % 32]! + out;
    rest = Math.floor(rest / 32);
  }
  return out;
}

/** The same layout as the phase-0 spike: 100 columns, near-neighbour connectors, seeded. */
function generate(tool: ToolLibrary, nodes: number, connectors: number): Model {
  const rand = mulberry32(1);
  const columns = 100;
  const rows = Math.ceil(nodes / columns);
  const classes = ['cls_task', 'cls_gateway', 'cls_start'] as const;
  const elements: Record<string, ElementData> = {};
  for (let i = 0; i < nodes; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const id = `el_${idPart(i)}` as ElementId;
    elements[id] = {
      id,
      class: classes[Math.floor(rand() * 3)]!,
      x: col * 200 + Math.floor(rand() * 41) - 20,
      y: row * 120 + Math.floor(rand() * 21) - 10,
      w: 100 + Math.floor(rand() * 41),
      h: 50 + Math.floor(rand() * 21),
      attrs: { att_name: `Node ${i}` },
      pos: String(i).padStart(6, '0'),
    };
  }
  const links: Record<string, ConnectorData> = {};
  const used = new Set<number>();
  let attempts = 0;
  let count = 0;
  while (count < connectors && attempts < connectors * 20) {
    attempts += 1;
    const from = Math.floor(rand() * nodes);
    const dc = Math.floor(rand() * 7) - 3;
    const dr = Math.floor(rand() * 7) - 3;
    const col = (from % columns) + dc;
    const row = Math.floor(from / columns) + dr;
    if (col < 0 || col >= columns || row < 0 || row >= rows) continue;
    const to = row * columns + col;
    if (to >= nodes || to === from) continue;
    const key = Math.min(from, to) * nodes + Math.max(from, to);
    if (used.has(key)) continue;
    used.add(key);
    const id = `cn_${idPart(count)}` as ConnectorId;
    links[id] = {
      id,
      relation: 'rel_flow',
      from: `el_${idPart(from)}` as ElementId,
      to: `el_${idPart(to)}` as ElementId,
      bends: [],
      attrs: {},
      pos: String(count).padStart(6, '0'),
    };
    count += 1;
  }
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: 'mdl_bench000001',
      name: 'Benchmark',
      tool: tool.manifest.id,
      toolVersion: tool.manifest.version,
      modelType: Object.values(tool.modelTypes)[0]!.id,
    },
    attrs: {},
    elements,
    connectors: links,
  };
}

const nextFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));

const pointer = (type: string, x: number, y: number, button = 0) =>
  new PointerEvent(type, {
    clientX: x,
    clientY: y,
    button,
    buttons: type === 'pointerup' ? 0 : 1 << button,
    pointerId: 1,
    bubbles: true,
    cancelable: true,
  });

const WARMUP_FRAMES = 10;

async function run(toolJson: string, frames: number): Promise<Report> {
  const tool = JSON.parse(toolJson) as ToolLibrary;
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:0;top:0;width:100vw;height:100vh;background:#fff;';
  document.body.append(host);

  const opened = performance.now();
  const model = generate(tool, 5000, 7000);
  const store = createModelStore(model, { tool });
  const scene = new Scene(store.state as Model, tool);
  scene.attach(store);
  const view = new CanvasView(host, scene, { grid: tool.settings.grid });
  const editor = new Editor({ store, tool, view });
  view.fit();
  view.paint();
  await nextFrame();
  const openMs = performance.now() - opened;

  const rect = view.surface.getBoundingClientRect();
  const work: number[] = [];
  let capture = false;
  view.onFrame = (ms) => {
    if (capture) work.push(ms);
  };

  const settle = async () => {
    const deadline = performance.now() + 2000;
    while (performance.now() < deadline) {
      await nextFrame();
      if (view.renderer.sceneCanvas.style.transform === '') break;
    }
    await nextFrame();
    await nextFrame();
  };
  const toClient = (x: number, y: number) => ({
    x: rect.left + x * view.view.s + view.view.ox,
    y: rect.top + y * view.view.s + view.view.oy,
  });

  /** Runs `step` once per animation frame and returns the frame intervals; draw work is in `work`. */
  const frameLoop = async (n: number, step: (f: number) => void) => {
    const intervals: number[] = [];
    let last = await nextFrame();
    work.length = 0;
    capture = true;
    for (let f = 0; f < n; f++) {
      step(f);
      const t = await nextFrame();
      intervals.push(t - last);
      last = t;
    }
    capture = false;
    return intervals;
  };

  const rows: Row[] = [];
  const dispatch = (type: string, x: number, y: number, button = 0) =>
    view.surface.dispatchEvent(pointer(type, x, y, button));

  const levels: [string, () => void][] = [
    ['whole model', () => view.fit()],
    [
      '100%',
      () =>
        view.setView(
          { s: 1, ox: -9000 + rect.width / 2, oy: -3000 + rect.height / 2 },
          false,
        ),
    ],
  ];
  for (const [zoomName, setZoom] of levels) {
    for (const count of [1, 10, 50]) {
      setZoom();
      await settle();
      const centre = {
        x: (rect.width / 2 - view.view.ox) / view.view.s,
        y: (rect.height / 2 - view.view.oy) / view.view.s,
      };
      const near = [...scene.elements.values()]
        .sort(
          (a, b) =>
            Math.hypot(a.x - centre.x, a.y - centre.y) -
            Math.hypot(b.x - centre.x, b.y - centre.y),
        )
        .slice(0, count);
      editor.select(near.map((e) => e.id));
      await settle();
      const first = near[0]!;
      const start = toClient(first.x + first.w / 2, first.y + first.h / 2);
      const radius = 150;
      const at = (f: number) => {
        const a = (f / 40) * Math.PI * 2;
        return [
          start.x + Math.sin(a) * radius,
          start.y + (1 - Math.cos(a)) * radius,
        ] as const;
      };
      dispatch('pointerdown', start.x, start.y);
      await nextFrame();
      // The first moves start the drag: the scene is redrawn once without the dragged items.
      await frameLoop(WARMUP_FRAMES, (f) => dispatch('pointermove', ...at(f)));
      const dragStartMs = Math.max(0, ...work);
      const intervals = await frameLoop(frames, (f) =>
        dispatch('pointermove', ...at(f + WARMUP_FRAMES)),
      );
      const measured = work.slice();
      const dropped = performance.now();
      dispatch('pointerup', start.x, start.y);
      await nextFrame();
      const dropMs = performance.now() - dropped;
      rows.push({
        scenario: `drag ${count}, ${zoomName}`,
        frames: intervals.length,
        intervalMs: stats(intervals),
        workMs: stats(measured),
        oneOffMs: { dragStartMs, dropMs },
      });
      store.undo();
      editor.clearSelection();
      await settle();
    }

    setZoom();
    await settle();
    const x = rect.left + 100;
    const y = rect.top + 100;
    dispatch('pointerdown', x, y, 1);
    const panIntervals = await frameLoop(frames, (f) =>
      dispatch('pointermove', x + Math.sin(f / 20) * 300, y + f * 2),
    );
    const panWork = work.slice();
    dispatch('pointerup', x, y, 1);
    const sharpStarted = performance.now();
    await settle();
    rows.push({
      scenario: `pan, ${zoomName}`,
      frames: panIntervals.length,
      intervalMs: stats(panIntervals),
      workMs: stats(panWork),
      oneOffMs: { settleMs: performance.now() - sharpStarted },
    });

    setZoom();
    await settle();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const zoomIntervals = await frameLoop(frames, (f) =>
      view.surface.dispatchEvent(
        new WheelEvent('wheel', {
          clientX: cx,
          clientY: cy,
          deltaY: f < frames / 2 ? -40 : 40,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    rows.push({
      scenario: `zoom in and out, ${zoomName}`,
      frames: zoomIntervals.length,
      intervalMs: stats(zoomIntervals),
      workMs: stats(work.slice()),
      oneOffMs: {},
    });
    await settle();
  }

  // An attribute edit until the shape shows it: command, scene update and the redraw.
  view.setView(
    { s: 1, ox: -9000 + rect.width / 2, oy: -3000 + rect.height / 2 },
    false,
  );
  await settle();
  const visible = [...scene.elements.values()]
    .filter(
      (e) =>
        e.x * view.view.s + view.view.ox > 0 &&
        e.x * view.view.s + view.view.ox < rect.width,
    )
    .slice(0, 40);
  const edits: number[] = [];
  for (const [i, e] of visible.entries()) {
    const t0 = performance.now();
    store.execute({
      type: 'setAttribute',
      target: e.id,
      attr: 'att_name',
      value: `Edited ${i}`,
    });
    view.paint();
    edits.push(performance.now() - t0);
    await nextFrame();
  }

  return {
    rows,
    openMs,
    attributeEditMs: stats(edits).p95,
    userAgent: navigator.userAgent,
    viewport: `${innerWidth}x${innerHeight}`,
    elements: scene.elements.size,
    connectors: scene.connectors.size,
  };
}

(window as unknown as { __bench: { run: typeof run } }).__bench = { run };
