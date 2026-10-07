import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { expect, test, type Page } from '@playwright/test';
import { loadHarness } from './bundle';
import type { CanvasHarness } from './canvas-harness';

const toolJson = readFileSync(
  fileURLToPath(new URL('../../../tools/bpmn-lite/tool.json', import.meta.url)),
  'utf8',
);

type Api = CanvasHarness;
type Args<K extends keyof Api> = Api[K] extends (...a: infer A) => unknown
  ? A
  : never;
type Ret<K extends keyof Api> = Api[K] extends (...a: never[]) => infer R
  ? R
  : never;

function call<K extends keyof Api>(
  page: Page,
  name: K,
  ...args: Args<K>
): Promise<Awaited<Ret<K>>> {
  return page.evaluate(
    ([n, a]) =>
      (
        window as unknown as {
          __canvas: Record<string, (...x: unknown[]) => unknown>;
        }
      ).__canvas[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<Awaited<Ret<K>>>;
}

async function workerSource(): Promise<string> {
  const out = await build({
    entryPoints: [
      fileURLToPath(
        new URL(
          '../../../packages/canvas/src/layout/elk-worker.ts',
          import.meta.url,
        ),
      ),
    ],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  return out.outputFiles[0]!.text;
}

async function setup(page: Page) {
  await loadHarness(page, './canvas-harness.ts');
  const source = await workerSource();
  await page.evaluate(
    ([json, src]) => {
      (
        window as unknown as {
          __canvas: { mount(t: unknown, w: string): void };
        }
      ).__canvas.mount(JSON.parse(json as string), src as string);
    },
    [toolJson, source] as const,
  );
}

test.describe('auto-layout', () => {
  test('arranges a small flow as one undo step', async ({ page }) => {
    await setup(page);
    await call(page, 'seedGraph', 6, 5, 'cls_task', 'rel_flow');
    const steps = await call(page, 'historyLength');
    expect(await call(page, 'autoLayout')).toBe(true);
    expect(await call(page, 'historyLength')).toBe(steps + 1);
    const m = await call(page, 'model');
    const xs = new Set(Object.values(m.elements).map((e) => e.x));
    expect(xs.size).toBeGreaterThan(1);
    await call(page, 'undo');
    expect(await call(page, 'historyLength')).toBe(steps);
  });

  test('lays out 500 objects and 700 connectors in under 2 s without freezing the page', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await setup(page);
    await call(page, 'seedGraph', 500, 700, 'cls_task', 'rel_flow');
    const model = await call(page, 'model');
    const connectors = Object.keys(model.connectors).length;
    expect(Object.keys(model.elements)).toHaveLength(500);
    expect(connectors).toBeGreaterThan(600);

    // The first run also starts the worker; the second is the steady state.
    await call(page, 'timedLayout');
    await call(page, 'undo');
    const run = await call(page, 'timedLayout');
    console.log(
      `layout of 500 objects and ${connectors} connectors: ${Math.round(run.ms)} ms, ` +
        `longest frame gap ${Math.round(run.maxFrameGap)} ms, ` +
        `longest timer gap ${Math.round(run.maxTickGap)} ms`,
    );
    expect(run.messages).toEqual([]);
    expect(run.changed).toBe(true);
    expect(run.ms).toBeLessThan(2000);
    expect(run.maxFrameGap).toBeLessThan(200);
    expect(run.maxTickGap).toBeLessThan(200);
  });
});
