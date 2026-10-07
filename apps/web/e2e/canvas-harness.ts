// Bundled and run inside Chromium by canvas.spec.ts. It mounts the canvas, the editor and the
// minimap on a sample tool library so that the tests can drive them with a real mouse and keyboard.
import {
  createModelStore,
  MODEL_FORMAT_VERSION,
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
  Minimap,
  Scene,
  type EditorTool,
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

function mount(tool: ToolLibrary): void {
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
  excluded: () => [...need().view.renderer.excluded],
  stats: () => ({ ...need().view.renderer.stats }),
  drawListBuilds: () => need().scene.cache.builds,
  elementIds: () => [...need().scene.elements.keys()] as ElementId[],
  /** RGBA of the scene canvas at a world point. */
  pixel(p: Point): number[] {
    const m = need();
    const canvas = m.view.renderer.sceneCanvas;
    const dpr = window.devicePixelRatio || 1;
    const x = (p.x * m.view.view.s + m.view.view.ox) * dpr;
    const y = (p.y * m.view.view.s + m.view.view.oy) * dpr;
    return [
      ...canvas
        .getContext('2d')!
        .getImageData(Math.round(x), Math.round(y), 1, 1).data,
    ];
  },
  sceneTransform: () => need().view.renderer.sceneCanvas.style.transform,
  copy: () => need().editor.copy(),
  paste: (text?: string) => need().editor.paste(text),
};

export type CanvasHarness = typeof api;
(window as unknown as { __canvas: CanvasHarness }).__canvas = api;
