import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { loadHarness } from './bundle';

export const kitJson = readFileSync(
  fileURLToPath(new URL('../../../kits/bpmn-lite/kit.json', import.meta.url)),
  'utf8',
);

/** The state of the open model, read from the page. */
export type Model = {
  manifest: { name: string; folder?: string };
  elements: Record<
    string,
    { x: number; y: number; class: string; attrs: Record<string, unknown> }
  >;
  connectors: Record<
    string,
    { from: string; to: string; relation: string; bends: unknown[] }
  >;
};

export interface PrepareOptions {
  /** The folder of the browser's private file system to use; a second window passes the first one's. */
  folder?: string;
  /** Make the workspace and its Kit (the first window does; a second one joins). */
  seed?: boolean;
  name?: string;
  colour?: string;
}

export async function prepare(page: Page, options: PrepareOptions = {}) {
  // The folder dialog cannot be driven, so the app picks a folder of the browser's private file
  // system. It is not remembered: the headless browser used in CI crashes when it is stored.
  const folder = options.folder ?? `ws-${Math.random().toString(36).slice(2)}`;
  await page.addInitScript(
    ([name, colour, wanted]) => {
      if (!sessionStorage.getItem('e2e-folder'))
        sessionStorage.setItem('e2e-folder', wanted!);
      (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
        remember: false,
        profile: { name, colour },
        pickFolder: async () => {
          const root = await navigator.storage.getDirectory();
          return root.getDirectoryHandle(
            sessionStorage.getItem('e2e-folder')!,
            { create: true },
          );
        },
      };
    },
    [options.name ?? 'Tester', options.colour ?? '#1971c2', folder],
  );
  if (options.seed === false) {
    await page.goto('/MetaKit/');
    return folder;
  }
  await loadHarness(page, './seed-harness.ts');
  await page.evaluate(
    (json) =>
      (window as unknown as { __seed(t: string): Promise<void> }).__seed(json),
    kitJson,
  );
  await page.reload();
  return folder;
}

export const model = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(
        JSON.stringify(
          (window as unknown as { __metakit: { store: { state: unknown } } })
            .__metakit.store.state,
        ),
      ) as Model,
  );

/** Opens the workspace and creates a model; returns how many clicks it took. */
export async function newModel(
  page: Page,
  name = 'Order process',
  folder = '',
) {
  let clicks = 0;
  const click = async (locator: ReturnType<Page['getByTestId']>) => {
    clicks += 1;
    await locator.click();
  };
  await click(page.getByTestId('open-folder'));
  await expect(page.getByTestId('new-model')).toBeVisible();
  await click(page.getByTestId('new-model'));
  await page.getByTestId('new-model-name').fill(name);
  if (folder)
    await page.getByPlaceholder('for example Sales/2026').fill(folder);
  await click(page.getByTestId('new-model-create'));
  await expect(page.getByTestId('model-view')).toBeVisible();
  return clicks;
}

export const canvasPoint = async (page: Page, x: number, y: number) => {
  const box = (await page.getByTestId('canvas-host').boundingBox())!;
  return { x: box.x + x, y: box.y + y };
};
