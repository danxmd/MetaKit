import type { App } from './app';

export interface Stats {
  p50: number;
  p95: number;
  max: number;
  mean: number;
  /** Share of frames longer than 20 ms (a missed 60 Hz frame), in percent. */
  slowPct: number;
}

export interface BenchRow {
  scenario: string;
  frames: number;
  /** Time between animation frames. At 60 Hz the floor is 16.7 ms, so this shows dropped frames. */
  rafMs: Stats;
  /** CPU time spent issuing draw commands per frame; a finer measure than the interval. */
  workMs: Stats;
  /** One-off costs around the scenario, e.g. the scene redraw when a drag starts. */
  extra: Record<string, number>;
}

export interface BenchReport {
  rows: BenchRow[];
  openMs: number;
  userAgent: string;
  viewport: string;
  devicePixelRatio: number;
  nodes: number;
  connectors: number;
}

function stats(values: number[]): Stats {
  if (values.length === 0)
    return { p50: 0, p95: 0, max: 0, mean: 0, slowPct: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return {
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1]!,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    slowPct: (100 * values.filter((v) => v > 20).length) / values.length,
  };
}

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

/** Frames to discard at the start of each scenario while the browser warms up. */
const WARMUP_FRAMES = 10;

export async function scriptedDrag(
  app: App,
  count: number,
  frames: number,
): Promise<BenchRow['extra'] & { frames: number }> {
  const target = app.renderer.active;
  const chosen = app.selectNearestToCenter(count);
  const first = app.scene.nodes[chosen[0]!]!;
  const start = app.toClient(first.x + first.w / 2, first.y + first.h / 2);
  await app.nextFrame();
  target.dispatchEvent(pointer('pointerdown', start.x, start.y));
  await app.nextFrame();
  const dragStartMs = app.lastDragStartMs;
  // The drag follows a circle so connectors bend in every direction.
  const radius = 150;
  for (let f = 0; f < WARMUP_FRAMES; f++) {
    await app.nextFrame();
    const a = (f / 40) * Math.PI * 2;
    target.dispatchEvent(
      pointer(
        'pointermove',
        start.x + Math.sin(a) * radius,
        start.y + (1 - Math.cos(a)) * radius,
      ),
    );
  }
  app.startRecording();
  for (let f = 0; f < frames; f++) {
    await app.nextFrame();
    const a = ((f + WARMUP_FRAMES) / 40) * Math.PI * 2;
    target.dispatchEvent(
      pointer(
        'pointermove',
        start.x + Math.sin(a) * radius,
        start.y + (1 - Math.cos(a)) * radius,
      ),
    );
  }
  await app.nextFrame();
  const log = app.stopRecording();
  target.dispatchEvent(pointer('pointerup', start.x, start.y));
  await app.nextFrame();
  const commitMs = app.lastCommitMs;
  await app.nextFrame();
  lastLog = log;
  return {
    frames: log.raf.length - 1,
    dragStartMs,
    commitMs,
    sharpRenderMs: app.lastSharpRenderMs,
  };
}

let lastLog: { raf: number[]; work: number[] } = { raf: [], work: [] };

/** Interval and work statistics of the most recent scripted scenario. */
export function lastScenarioStats(): {
  raf: Stats;
  work: Stats;
  frames: number;
} {
  const raf = lastLog.raf.slice(1);
  return {
    raf: stats(raf),
    work: stats(lastLog.work.slice(1)),
    frames: raf.length,
  };
}

async function scriptedPan(app: App, frames: number): Promise<void> {
  const target = app.renderer.active;
  const rect = target.getBoundingClientRect();
  const x = rect.left + 100;
  const y = rect.top + 100;
  target.dispatchEvent(pointer('pointerdown', x, y, 1));
  await app.nextFrame();
  app.startRecording();
  for (let f = 0; f < frames; f++) {
    await app.nextFrame();
    target.dispatchEvent(
      pointer('pointermove', x + Math.sin(f / 20) * 300, y + f * 2),
    );
  }
  await app.nextFrame();
  lastLog = app.stopRecording();
  target.dispatchEvent(pointer('pointerup', x, y, 1));
}

async function scriptedZoom(app: App, frames: number): Promise<void> {
  const target = app.renderer.active;
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  app.startRecording();
  for (let f = 0; f < frames; f++) {
    await app.nextFrame();
    // In for half the frames, then out, so the zoom ends where it started.
    const delta = f < frames / 2 ? -40 : 40;
    target.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: x,
        clientY: y,
        deltaY: delta,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  await app.nextFrame();
  lastLog = app.stopRecording();
}

async function settle(app: App): Promise<void> {
  const deadline = performance.now() + 2000;
  while (!app.isSettled() && performance.now() < deadline)
    await app.nextFrame();
  await app.nextFrame();
}

function row(scenario: string, extra: BenchRow['extra'] = {}): BenchRow {
  const raf = lastLog.raf.slice(1);
  return {
    scenario,
    frames: raf.length,
    rafMs: stats(raf),
    workMs: stats(lastLog.work.slice(1)),
    extra,
  };
}

export async function runBenchmarks(
  app: App,
  onProgress: (message: string) => void = () => undefined,
  frames = 240,
): Promise<BenchReport> {
  const rows: BenchRow[] = [];
  const zooms: [string, () => void][] = [
    ['zoomed out (whole model)', () => app.fitAll()],
    ['100%', () => app.zoomTo(1)],
  ];
  for (const [zoomName, setZoom] of zooms) {
    for (const count of [1, 10, 50]) {
      onProgress(`drag ${count} at ${zoomName}`);
      setZoom();
      await settle(app);
      const { frames: _frames, ...extra } = await scriptedDrag(
        app,
        count,
        frames,
      );
      void _frames;
      rows.push(
        row(`drag ${count} object${count > 1 ? 's' : ''}, ${zoomName}`, extra),
      );
      app.clearSelection();
      await settle(app);
    }
    onProgress(`pan at ${zoomName}`);
    setZoom();
    await settle(app);
    await scriptedPan(app, frames);
    rows.push(row(`pan, ${zoomName}`));
    await settle(app);
    const sharp = app.lastSharpRenderMs;
    onProgress(`zoom at ${zoomName}`);
    setZoom();
    await settle(app);
    await scriptedZoom(app, frames);
    rows.push(
      row(`zoom in and out, ${zoomName}`, {
        sharpRenderMs: app.lastSharpRenderMs,
        panSharpRenderMs: sharp,
      }),
    );
    await settle(app);
  }
  return {
    rows,
    openMs: app.openMs,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    nodes: app.scene.nodes.length,
    connectors: app.scene.connectors.length,
  };
}

export function formatReport(report: BenchReport): string {
  const f = (n: number) => n.toFixed(1);
  const lines = [
    `Model: ${report.nodes} nodes, ${report.connectors} connectors; open ${f(report.openMs)} ms`,
    `Viewport ${report.viewport} @${report.devicePixelRatio}x; ${report.userAgent}`,
    '',
    'scenario | frames | interval p50/p95/max (ms) | frames over 20 ms | work p50/p95/max (ms) | one-off (ms)',
  ];
  for (const r of report.rows) {
    const extra = Object.entries(r.extra)
      .map(([k, v]) => `${k} ${f(v)}`)
      .join(', ');
    lines.push(
      `${r.scenario} | ${r.frames} | ${f(r.rafMs.p50)}/${f(r.rafMs.p95)}/${f(r.rafMs.max)} | ${f(r.rafMs.slowPct)}% | ${f(r.workMs.p50)}/${f(r.workMs.p95)}/${f(r.workMs.max)} | ${extra}`,
    );
  }
  return lines.join('\n');
}
