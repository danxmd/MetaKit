// Bundled and run inside Chromium by canvas.spec.ts. It mounts the canvas, the editor and the
// minimap on a sample tool library so that the tests can drive them with a real mouse and keyboard.
import {
  createModelStore,
  MODEL_FORMAT_VERSION,
  type ClassId,
  type ConnectorId,
  type ElementId,
  type Model,
  type ModelCommand,
  type ModelStore,
  type Point,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  CanvasView,
  Editor,
  LayoutService,
  Minimap,
  Scene,
  exportPdf,
  exportPng,
  exportSvg,
  type EditorTool,
  type ExportSelection,
  type PdfExportOptions,
  type PngExportOptions,
  type SvgExportOptions,
} from '@metakit-app/canvas';

interface Mounted {
  tool: ToolLibrary;
  store: ModelStore;
  scene: Scene;
  view: CanvasView;
  editor: Editor;
  minimap: Minimap;
  host: HTMLElement;
  messages: string[];
}

let current: Mounted | null = null;

function newModel(tool: ToolLibrary): Model {
  const modelType = Object.values(tool.modelTypes)[0]!;
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: 'mdl_harness001',
      name: 'Harness',
      tool: tool.manifest.id,
      toolVersion: tool.manifest.version,
      modelType: modelType.id,
    },
    attrs: {},
    elements: {},
    connectors: {},
  };
}

/**
 * `workerSource` is the bundled ELK worker as text: this harness is itself bundled without the
 * app's build tool, which is what resolves `new Worker(new URL(...))` in the app.
 */
function mount(tool: ToolLibrary, workerSource?: string): void {
  current?.editor.destroy();
  current?.minimap.destroy();
  current?.view.destroy();
  current?.host.remove();

  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:0;top:0;width:1000px;height:700px;z-index:1000;background:#fff;';
  document.body.append(host);
  const store = createModelStore(newModel(tool), { tool });
  const scene = new Scene(store.state as Model, tool);
  scene.attach(store);
  const view = new CanvasView(host, scene, { grid: tool.settings.grid });
  view.setView({ s: 1, ox: 0, oy: 0 }, false);
  const messages: string[] = [];
  const editor = new Editor({
    store,
    tool,
    view,
    host: { onMessage: (t) => messages.push(t) },
    layout: workerSource
      ? new LayoutService({
          workerFactory: () =>
            new Worker(
              URL.createObjectURL(
                new Blob([workerSource], { type: 'text/javascript' }),
              ),
            ) as never,
        })
      : undefined,
  });
  const mapHost = document.createElement('div');
  mapHost.style.cssText = 'position:absolute;right:8px;bottom:8px;';
  host.append(mapHost);
  const minimap = new Minimap(mapHost, view);
  current = { tool, store, scene, view, editor, minimap, host, messages };
  view.paint();
}

function need(): Mounted {
  if (!current) throw new Error('Nothing is mounted');
  return current;
}

/** Fills the page's scene and active layers now, without waiting for the next animation frame. */
function flush(): void {
  need().view.paint();
  need().minimap.render();
}

/** Selection as ids from the test, turned into the sets the exporters take. */
interface IdSelection {
  elements: string[];
  connectors: string[];
}
const toSelection = (
  s: IdSelection | undefined,
): ExportSelection | undefined =>
  s
    ? {
        elements: new Set(s.elements as ElementId[]),
        connectors: new Set(s.connectors as ConnectorId[]),
      }
    : undefined;

/** RGBA at a point of a canvas that holds a decoded image. */
function readPixels(
  source: CanvasImageSource,
  width: number,
  height: number,
  points: Point[],
): number[][] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  return points.map((p) => [
    ...ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data,
  ]);
}

/** RGBA of the scene canvas at a world point. */
function screenPixel(p: Point): number[] {
  const m = need();
  const canvas = m.view.renderer.sceneCanvas;
  const dpr = window.devicePixelRatio || 1;
  const x = (p.x * m.view.view.s + m.view.view.ox) * dpr;
  const y = (p.y * m.view.view.s + m.view.view.oy) * dpr;
  return [
    ...canvas.getContext('2d')!.getImageData(Math.round(x), Math.round(y), 1, 1)
      .data,
  ];
}

function viewBoxOf(svg: string) {
  const m = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg)!;
  return { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) };
}

const api = {
  mount,
  flush,
  exec(command: ModelCommand | { type: 'batch'; commands: ModelCommand[] }) {
    const result = need().store.execute(command);
    flush();
    return result.ok ? result.value : null;
  },
  model(): Model {
    return JSON.parse(JSON.stringify(need().store.state)) as Model;
  },
  undo() {
    need().store.undo();
    flush();
  },
  canUndo: () => need().store.canUndo(),
  selection() {
    const s = need().editor.selection;
    return { elements: [...s.elements], connectors: [...s.connectors] };
  },
  messages: () => need().messages,
  clearMessages: () => {
    need().messages.length = 0;
  },
  /** Client coordinates of a world point. */
  client(p: Point): Point {
    const m = need();
    const r = m.host.getBoundingClientRect();
    return {
      x: r.left + p.x * m.view.view.s + m.view.view.ox,
      y: r.top + p.y * m.view.view.s + m.view.view.oy,
    };
  },
  setView(view: { s: number; ox: number; oy: number }) {
    need().view.setView(view, false);
    flush();
  },
  viewState: () => ({ ...need().view.view }),
  setTool(tool: EditorTool) {
    need().editor.setTool(tool);
  },
  editor: () => need().editor,
  /** The route a connector is drawn with right now, including a drag in progress. */
  drawnRoute(id: ConnectorId): Point[] {
    const m = need();
    const item = m.scene.connectors.get(id);
    if (!item) return [];
    const override = m.view.active.routes.get(id);
    if (override) return [...override];
    return m.scene.routeWithRects(
      item,
      m.view.active.previews.get(item.from),
      m.view.active.previews.get(item.to),
    );
  },
  previews() {
    return [...need().view.active.previews.entries()].map(([id, r]) => ({
      id,
      r,
    }));
  },
  guides: () => need().view.active.guides,
  /** The element highlighted as the drop target during a drag, or null. */
  dropTarget: () => need().view.active.target,
  /** Creates an element of a class centred at a world point, as a click from the palette does. */
  placeAt(cls: string, at: Point) {
    const id = need().editor.placeAt(cls as ClassId, at);
    flush();
    return id;
  },
  /** How many undo steps the model has. */
  historyLength: () => need().store.history().length,
  excluded: () => [...need().view.renderer.excluded],
  stats: () => ({ ...need().view.renderer.stats }),
  drawListBuilds: () => need().scene.cache.builds,
  elementIds: () => [...need().scene.elements.keys()] as ElementId[],
  /** RGBA of the scene canvas at a world point. */
  pixel: screenPixel,
  sceneTransform: () => need().view.renderer.sceneCanvas.style.transform,
  /** The SVG export of the mounted model. */
  exportSvg(
    options: Omit<SvgExportOptions, 'selection'> & {
      selection?: IdSelection;
    } = {},
  ) {
    const { selection, ...rest } = options;
    const sel = toSelection(selection);
    return exportSvg(need().scene, sel ? { ...rest, selection: sel } : rest);
  },
  /**
   * Renders an SVG export into an image and reads it at world points, next to what the screen's
   * scene canvas shows there. The export has no padding, so its origin is the content's corner.
   */
  async compareSvg(points: Point[]) {
    const svg = exportSvg(need().scene, { padding: 0 });
    const box = viewBoxOf(svg);
    const origin = { x: box.x, y: box.y };
    const w = Math.ceil(box.w);
    const h = Math.ceil(box.h);
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await img.decode();
    const shifted = points.map((p) => ({
      x: p.x - origin.x,
      y: p.y - origin.y,
    }));
    return {
      svg: readPixels(img, w, h, shifted),
      screen: points.map((p) => screenPixel(p)),
    };
  },
  /** Exports a PNG and reports its size and a few pixels. */
  async exportPng(
    options: Omit<PngExportOptions, 'selection'> & { selection?: IdSelection },
    worldPoints: Point[] = [],
  ) {
    const { selection, ...rest } = options;
    const sel = toSelection(selection);
    const blob = await exportPng(
      need().scene,
      sel ? { ...rest, selection: sel } : rest,
    );
    const bitmap = await createImageBitmap(blob);
    // The PNG has the default padding, so its origin is the SVG's.
    const origin = viewBoxOf(
      exportSvg(need().scene, sel ? { selection: sel } : {}),
    );
    return {
      type: blob.type,
      width: bitmap.width,
      height: bitmap.height,
      // The first pixel is the corner; the others are the given world points.
      pixels: readPixels(bitmap, bitmap.width, bitmap.height, [
        { x: 0, y: 0 },
        ...worldPoints.map((p) => ({
          x: (p.x - origin.x) * options.scale,
          y: (p.y - origin.y) * options.scale,
        })),
      ]),
    };
  },
  /** Exports a PDF and reports its start and page count. */
  async exportPdf(
    options: Omit<PdfExportOptions, 'selection'> & { selection?: IdSelection },
  ) {
    const { selection, ...rest } = options;
    const sel = toSelection(selection);
    const blob = await exportPdf(
      need().scene,
      sel ? { ...rest, selection: sel } : rest,
    );
    const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
    return {
      size: blob.size,
      type: blob.type,
      head: text.slice(0, 5),
      pages: (text.match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length,
    };
  },
  autoLayout: (options?: Parameters<Editor['autoLayout']>[0]) =>
    need()
      .editor.autoLayout(options)
      .then((changed) => {
        flush();
        return changed;
      }),
  /**
   * Fills the model with `count` shapes and about `links` connectors that mostly point forward,
   * as a flow does. Returns the element ids.
   */
  seedGraph(count: number, links: number, cls: string, relation: string) {
    const store = need().store;
    const made = store.execute({
      type: 'batch',
      commands: Array.from({ length: count }, (_, i) => ({
        type: 'createElement' as const,
        class: cls as ClassId,
        x: (i % 25) * 10,
        y: Math.floor(i / 25) * 10,
      })),
    });
    if (!made.ok) throw new Error(made.reason);
    const ids = made.value as ElementId[];
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const commands: ModelCommand[] = [];
    for (let i = 0; i < links; i++) {
      const from = rand() % count;
      const to = Math.min(count - 1, from + 1 + (rand() % 8));
      if (from === to) continue;
      commands.push({
        type: 'createConnector',
        relation: relation as never,
        from: ids[from]!,
        to: ids[to]!,
      });
    }
    const linked = store.execute({ type: 'batch', commands });
    if (!linked.ok) throw new Error(linked.reason);
    flush();
    return ids;
  },
  /**
   * Runs an auto-layout and watches the page meanwhile: the longest gap between animation frames
   * and between 10 ms timer ticks says whether the main thread stayed free.
   */
  async timedLayout() {
    let last = performance.now();
    let maxFrameGap = 0;
    let running = true;
    const frame = () => {
      const now = performance.now();
      maxFrameGap = Math.max(maxFrameGap, now - last);
      last = now;
      if (running) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    let lastTick = performance.now();
    let maxTickGap = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      maxTickGap = Math.max(maxTickGap, now - lastTick);
      lastTick = now;
    }, 10);
    const started = performance.now();
    const changed = await need().editor.autoLayout();
    const ms = performance.now() - started;
    running = false;
    clearInterval(timer);
    flush();
    return {
      changed,
      ms,
      maxFrameGap,
      maxTickGap,
      messages: [...need().messages],
    };
  },
  copy: () => need().editor.copy(),
  paste: (text?: string) => need().editor.paste(text),
};

export type CanvasHarness = typeof api;
(window as unknown as { __canvas: CanvasHarness }).__canvas = api;
