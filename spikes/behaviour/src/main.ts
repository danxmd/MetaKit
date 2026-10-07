import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url';
import { evaluate, FormulaError } from './formula';
import { measureAll, sandboxRequests } from './measure';
import type { Sandbox } from './sandbox';

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

// Formula: no QuickJS involved, so this works before the sandbox is loaded.
$('evaluate').addEventListener('click', () => {
  try {
    const value = evaluate(
      $<HTMLInputElement>('formula').value,
      JSON.parse($<HTMLInputElement>('scope').value),
    );
    $('formula-out').textContent = JSON.stringify(value);
  } catch (e) {
    $('formula-out').textContent =
      e instanceof FormulaError ? `${e.code}: ${e.message}` : String(e);
  }
});

// Sandbox: the module is imported only here, which is what makes it lazy.
let sandbox: Sandbox | null = null;
const attrs = new Map<string, unknown>([['el_1.locked', true]]);
const elements = new Set(['el_1']);

$('load').addEventListener('click', async () => {
  $('status').textContent = 'loading…';
  const started = performance.now();
  const { Sandbox } = await import('./sandbox');
  sandbox = await Sandbox.create(
    {
      getAttr: (id, key) => attrs.get(`${id}.${key}`),
      setAttr: (id, key, value) => void attrs.set(`${id}.${key}`, value),
      log: (m) => ($('script-out').textContent = `log: ${m}`),
    },
    undefined,
    { wasmUrl },
  );
  try {
    await sandbox.load($<HTMLTextAreaElement>('script').value);
    $('status').textContent =
      `loaded in ${(performance.now() - started).toFixed(0)} ms`;
    $<HTMLButtonElement>('run').disabled = false;
  } catch (e) {
    $('status').textContent = `script error: ${(e as Error).message}`;
  }
});

$('run').addEventListener('click', () => {
  if (!sandbox) return;
  const answer = sandbox.fire('before:deleteElement', { id: 'el_1' });
  if (!answer.cancelled) elements.delete('el_1');
  $('script-out').textContent = answer.cancelled
    ? `Cancelled: ${answer.reason}\nel_1 is still in the model`
    : 'Allowed: el_1 deleted';
});

Object.assign(window, {
  __behaviour: {
    measure: () => measureAll(wasmUrl),
    sandboxRequests,
    elements: () => [...elements],
  },
});
