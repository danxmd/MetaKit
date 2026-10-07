// Bundled and run inside Chromium by scripts.spec.ts: the script editor with its language worker.
import { generateDeclarations } from '../../../packages/behaviour/src/types-gen';
import type { ToolLibrary } from '@metakit-app/core';
import { SAMPLE, sampleTool } from '@metakit-app/core/testing';
import { createScriptEditor } from '../../../packages/ui/src/components/build/scripts/script-editor';
import {
  createLanguageClient,
  type WorkerLike,
} from '../../../packages/ui/src/components/build/scripts/script-language-client';

function tool(): ToolLibrary {
  const t = sampleTool();
  t.classes[SAMPLE.task]!.attributes.push({
    id: 'att_number',
    key: 'Number',
    type: 'integer',
  });
  return t;
}

let editor: ReturnType<typeof createScriptEditor> | null = null;
let worker: Worker | null = null;
const changes: string[] = [];

const api = {
  /** Opens the editor on `source`, with a language worker made from the bundled worker text. */
  async open(workerSource: string, source: string): Promise<void> {
    const url = URL.createObjectURL(
      new Blob([workerSource], { type: 'text/javascript' }),
    );
    worker = new Worker(url);
    const client = createLanguageClient(worker as unknown as WorkerLike);
    await client.declarations(generateDeclarations(tool()));
    const parent = document.createElement('div');
    // Fixed at the top of the window so that the mouse can be moved over any line of it.
    parent.style.cssText =
      'position:fixed;top:0;left:0;width:700px;z-index:99999;background:#fff';
    parent.dataset.testid = 'harness-editor';
    document.body.append(parent);
    editor = createScriptEditor({
      parent,
      source,
      client,
      onChange: (text) => void changes.push(text),
    });
  },
  /** Puts the cursor at the end, after typing `text` there. */
  type(text: string): void {
    const view = editor!.view;
    const end = view.state.doc.length;
    view.dispatch({
      changes: { from: end, insert: text },
      selection: { anchor: end + text.length },
    });
    view.focus();
  },
  complete(): void {
    editor!.complete();
  },
  /** Where a piece of text is on the screen, for moving the mouse over it. */
  where(text: string): { x: number; y: number } {
    const view = editor!.view;
    const at = view.state.doc.toString().lastIndexOf(text) + 2;
    const c = view.coordsAtPos(at)!;
    return { x: c.left + 2, y: (c.top + c.bottom) / 2 };
  },
  text: () => editor!.text(),
  changes: () => changes,
  close(): void {
    editor?.destroy();
    worker?.terminate();
  },
};

export type ScriptsHarness = typeof api;
(window as unknown as { __scripts: ScriptsHarness }).__scripts = api;
