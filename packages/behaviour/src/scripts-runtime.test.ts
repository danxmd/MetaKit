import { afterEach, describe, expect, it } from 'vitest';
import {
  createModelStore,
  type Script,
  type ScriptId,
  type ToolLibrary,
} from '@metakit-app/core';
import {
  SAMPLE,
  emptySampleModel,
  sampleTool,
} from '@metakit-app/core/testing';
import {
  attachScripts,
  createBehaviour,
  createPermissionStore,
  memoryPermissionBacking,
  silentHost,
  type Behaviour,
  type ScriptsHandle,
} from './index';

const SCRIPT: Script = {
  id: 'scr_rt',
  name: 'Count',
  source: `import { on, ui } from "metakit";
on("object.created", () => ui.message("created"));`,
};

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((c) => c()));

async function start(tool: ToolLibrary) {
  const store = createModelStore(emptySampleModel(), { tool });
  const messages: string[] = [];
  const behaviour: Behaviour = createBehaviour({
    store,
    tool: () => tool,
    host: silentHost({ message: (_k, t) => void messages.push(t) }),
  });
  const handle: ScriptsHandle = await attachScripts(behaviour, {
    store,
    tool: () => tool,
  });
  cleanup.push(() => {
    handle.dispose();
    behaviour.dispose();
  });
  return { store, behaviour, handle, messages };
}

describe('attachScripts', () => {
  it('makes no engine for a tool without scripts', async () => {
    const { handle } = await start(sampleTool());
    expect(handle.engine).toBeNull();
    expect(handle.log).toEqual([]);
    expect(handle.status('scr_x' as ScriptId).state).toBe('running');
  });

  it('starts the scripts of the tool and listens', async () => {
    const tool = sampleTool();
    tool.scripts = { [SCRIPT.id]: SCRIPT };
    const { handle, store, messages } = await start(tool);
    expect(handle.engine).not.toBeNull();
    store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 });
    expect(messages).toEqual(['created']);
  });

  it('starts the engine when a script is added later, reloads on change and stops when the last is removed', async () => {
    let tool = sampleTool();
    const store = createModelStore(emptySampleModel(), { tool });
    const messages: string[] = [];
    const behaviour = createBehaviour({
      store,
      tool: () => tool,
      host: silentHost({ message: (_k, t) => void messages.push(t) }),
    });
    const handle = await attachScripts(behaviour, { store, tool: () => tool });
    cleanup.push(() => {
      handle.dispose();
      behaviour.dispose();
    });
    expect(handle.engine).toBeNull();

    tool = { ...tool, scripts: { [SCRIPT.id]: SCRIPT } };
    await handle.setTool(tool);
    store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 });
    expect(messages).toEqual(['created']);

    // A tool change that leaves the scripts alone does not reload them.
    const engine = handle.engine;
    await handle.setTool({ ...tool });
    expect(handle.engine).toBe(engine);

    tool = {
      ...tool,
      scripts: {
        [SCRIPT.id]: {
          ...SCRIPT,
          source: SCRIPT.source.replace(
            'message("created")',
            'message("again")',
          ),
        },
      },
    };
    await handle.setTool(tool);
    store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 });
    expect(messages).toEqual(['created', 'again']);

    tool = { ...tool, scripts: {} };
    await handle.setTool(tool);
    store.execute({ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 });
    expect(messages).toEqual(['created', 'again']);
  });

  it('runs a script by hand through the handle, as a rule action would', async () => {
    const tool = sampleTool();
    tool.scripts = {
      scr_cmd: {
        id: 'scr_cmd',
        name: 'Hello',
        source: `import { commands, ui } from "metakit";
commands.register({ id: "hi", label: "Hi", run: () => ui.message("hi!") });`,
      },
    };
    const { handle, messages } = await start(tool);
    await handle.runScript('scr_cmd', null);
    expect(messages).toEqual(['hi!']);
  });

  it('gives scripts the permissions the store allows, per tool', async () => {
    const tool = sampleTool();
    tool.manifest.permissions = { files: true };
    tool.scripts = {
      scr_f: {
        id: 'scr_f',
        name: 'Files',
        source: `import { commands, files } from "metakit";
commands.register({ id: "f", label: "F", run: async () => { console.log(await files.read("a.txt")); } });`,
      },
    };
    const store = createModelStore(emptySampleModel(), { tool });
    const behaviour = createBehaviour({
      store,
      tool: () => tool,
      host: silentHost(),
    });
    const permissions = await createPermissionStore(
      memoryPermissionBacking(),
      () => Promise.resolve(true),
    );
    const handle = await attachScripts(behaviour, {
      store,
      tool: () => tool,
      files: {
        read: () => Promise.resolve('text'),
        write: () => Promise.resolve(),
        list: () => Promise.resolve([]),
        exists: () => Promise.resolve(true),
      },
      permissions,
    });
    cleanup.push(() => {
      handle.dispose();
      behaviour.dispose();
    });
    await handle.runScript('scr_f', null);
    expect(handle.log.at(-1)?.text).toMatch(/not allowed that for this tool/);
    await permissions.request(tool.manifest.id, { files: true });
    handle.clearLog();
    await handle.runScript('scr_f', null);
    expect(handle.log.map((l) => l.text)).toEqual(['text']);
  });
});
