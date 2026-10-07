import { App } from './app';
import {
  formatReport,
  lastScenarioStats,
  runBenchmarks,
  scriptedDrag,
} from './bench';
import { generateModel } from './model';

const params = new URLSearchParams(location.search);
const num = (key: string, fallback: number) =>
  Number(params.get(key) ?? fallback);

const container = document.getElementById('stage')!;
const model = generateModel({
  nodes: num('nodes', 5000),
  connectors: num('connectors', 7000),
  seed: num('seed', 1),
});
const app = new App(container, model);

const overlay = document.getElementById('overlay')!;
const recent: number[] = [];
let lastPaint = 0;
app.onFrame = (interval, work) => {
  recent.push(interval);
  if (recent.length > 60) recent.shift();
  const now = performance.now();
  if (now - lastPaint < 500) return;
  lastPaint = now;
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const { stats } = app.renderer;
  overlay.textContent =
    `${(1000 / mean).toFixed(0)} fps · frame ${mean.toFixed(1)} ms · work ${work.toFixed(1)} ms\n` +
    `scene ${stats.sceneMs.toFixed(0)} ms · ${stats.visibleNodes} nodes, ${stats.visibleConnectors} connectors, ${stats.labels} labels\n` +
    `zoom ${(app.renderer.view.s * 100).toFixed(0)}% · selected ${app.selection.nodes.size}`;
};
app.start();

const output = document.getElementById('output')!;
async function run() {
  const button = document.getElementById('run') as HTMLButtonElement;
  button.disabled = true;
  const report = await runBenchmarks(
    app,
    (m) => (output.textContent = `Running: ${m}…`),
  );
  output.textContent = formatReport(report);
  button.disabled = false;
  app.fitAll();
  return report;
}
document.getElementById('run')!.addEventListener('click', () => void run());
document.getElementById('fit')!.addEventListener('click', () => app.fitAll());
document.getElementById('z100')!.addEventListener('click', () => app.zoomTo(1));

// Hooks for Playwright and for the console.
Object.assign(window, {
  __cv: app,
  __runBench: run,
  __drag: async (count: number, frames: number) => {
    await scriptedDrag(app, count, frames);
    return lastScenarioStats();
  },
});
document.body.classList.toggle('bench', params.has('bench'));
