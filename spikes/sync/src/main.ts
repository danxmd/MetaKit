import { TOMBSTONE_FIELD } from './merge';
import { getInstanceId, idbGet, idbSet, randomId } from './idb';
import { Workspace } from './workspace';

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const COLORS = ['#d9480f', '#1971c2', '#2f9e44', '#9c36b5', '#c2255c'];
let workspace: Workspace | null = null;

async function begin(root: FileSystemDirectoryHandle, mode: string) {
  // ?instance= lets two windows of one browser act as two instances; a real second machine
  // gets its own id from IndexedDB.
  const instanceId = params.get('instance') ?? (await getInstanceId());
  const name = params.get('name') ?? `User ${instanceId.slice(0, 4)}`;
  const color =
    params.get('color') ??
    COLORS[parseInt(instanceId.slice(0, 2), 16) % COLORS.length]!;
  workspace = new Workspace({ root, instanceId, name, color });
  workspace.onChange = render;
  await workspace.start();
  $('setup').hidden = true;
  $('app').hidden = false;
  $('me').textContent = name;
  $('me-dot').style.background = color;
  $('mode').textContent = ` (${mode}, instance ${instanceId}, ${
    workspace.stats.observer ? 'FileSystemObserver' : '2 s scan'
  })`;
  render();
  setInterval(renderStatus, 1000);
  // Hooks for the Playwright checks and for debugging in the console.
  Object.assign(window, { __sync: workspace });
}

function render() {
  if (!workspace) return;
  const ws = workspace;
  const body = $('boxes');
  const focused = document.activeElement;
  const elements = ws.elements();
  const ids = Object.keys(elements).sort();
  // Rebuild only rows whose values changed, so typing in another row is not interrupted.
  for (const row of [...body.children] as HTMLElement[]) {
    if (!ids.includes(row.dataset.el!)) row.remove();
  }
  for (const id of ids) {
    let row = body.querySelector<HTMLElement>(`[data-el="${id}"]`);
    if (!row) {
      row = document.createElement('tr');
      row.dataset.el = id;
      row.innerHTML = `<td>${id}</td>
        <td><input type="number" data-f="x" /></td>
        <td><input type="number" data-f="y" /></td>
        <td><input type="text" data-f="name" /></td>
        <td><button data-del>Delete</button></td>`;
      row.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        input.addEventListener('change', () => {
          const field = input.dataset.f!;
          ws.edit(
            id,
            field,
            field === 'name' ? input.value : Number(input.value),
          );
        });
      });
      row
        .querySelector('[data-del]')!
        .addEventListener('click', () => ws.edit(id, TOMBSTONE_FIELD));
      body.append(row);
    }
    for (const input of row.querySelectorAll<HTMLInputElement>('input')) {
      if (input === focused) continue;
      const value = String(elements[id]![input.dataset.f!] ?? '');
      if (input.value !== value) input.value = value;
    }
  }
  renderStatus();
}

function renderStatus() {
  if (!workspace) return;
  const ws = workspace;
  $('present').textContent =
    ws.presence.length === 0
      ? 'nobody else'
      : ws.presence.map((p) => p.name).join(', ');
  $('status').textContent = ws.lastRemote
    ? `Last change from ${ws.nameOf(ws.lastRemote.by)}, ${Math.round(
        (Date.now() - ws.lastRemote.at) / 1000,
      )} s ago`
    : 'No changes from others yet';
}

$('add').addEventListener('click', () => {
  if (!workspace) return;
  const id = `el_${randomId(3)}`;
  workspace.edit(id, 'x', 40);
  workspace.edit(id, 'y', 40);
  workspace.edit(id, 'name', 'Box');
});

$('pick').addEventListener('click', async () => {
  const root = await window.showDirectoryPicker({ mode: 'readwrite' });
  await idbSet('lastFolder', root);
  await begin(root, `folder "${root.name}"`);
});

$('reopen').addEventListener('click', async () => {
  const root = await idbGet<FileSystemDirectoryHandle>('lastFolder');
  if (!root) return;
  if ((await root.requestPermission({ mode: 'readwrite' })) === 'granted') {
    await begin(root, `folder "${root.name}"`);
  }
});

async function openPrivate(name: string) {
  const origin = await navigator.storage.getDirectory();
  await begin(
    await origin.getDirectoryHandle(name, { create: true }),
    `test folder "${name}"`,
  );
}
$('opfs').addEventListener('click', () => void openPrivate('spike-default'));

async function init() {
  if (!('showDirectoryPicker' in window)) {
    $('pick').hidden = true;
  }
  const remembered = await idbGet<FileSystemDirectoryHandle>('lastFolder');
  $('reopen').hidden = !remembered;
  const opfs = params.get('opfs');
  if (opfs) await openPrivate(opfs);
}
void init();
