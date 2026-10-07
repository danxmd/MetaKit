import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The adapter contract and the folder-handle storage, run inside real Chromium against the
// File System Access API. The origin private file system is used as the folder: it has the same
// handle interface as a folder the user picks, but needs no dialog.

type Result = { name: string; ok: boolean; error?: string };
type Harness = {
  runContract(useObserver: boolean): Promise<Result[]>;
  handleStorage(): Promise<Record<string, unknown>>;
  permission(): Promise<Record<string, unknown>>;
  instance(): Promise<Record<string, unknown>>;
  workspace(): Promise<Record<string, unknown>>;
};

async function openHarness(page: Page) {
  const bundle = await build({
    entryPoints: [
      fileURLToPath(new URL('./storage-harness.ts', import.meta.url)),
    ],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  await page.goto('/MetaKit/');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
}

// One page per step, so that a browser crash in one step is named by its test.
function step(name: keyof Omit<Harness, 'runContract'>) {
  return async (page: Page) => {
    await openHarness(page);
    return page.evaluate(
      (n) =>
        (window as never as { __storage: Harness }).__storage[
          n as 'workspace'
        ](),
      name,
    );
  };
}

for (const useObserver of [true, false]) {
  test(`the local folder adapter passes the shared storage contract in Chromium (observer ${useObserver})`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openHarness(page);
    const results = await page.evaluate(
      (o) =>
        (window as never as { __storage: Harness }).__storage.runContract(o),
      useObserver,
    );
    expect(results.length).toBeGreaterThanOrEqual(13);
    const failed = results.filter((r) => !r.ok);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  });
}

test('the browser state keeps values in IndexedDB', async ({ page }) => {
  expect(await step('handleStorage')(page)).toMatchObject({
    nothingRemembered: true,
    roundTrip: { a: 1 },
  });
});

test('access to a folder can be requested', async ({ page }) => {
  expect(await step('permission')(page)).toMatchObject({
    requestAccess: true,
  });
});

test('the instance id is stable and stored', async ({ page }) => {
  expect(await step('instance')(page)).toMatchObject({
    instanceStable: true,
    stored: true,
  });
});

test('a workspace can be created and reopened on a folder', async ({
  page,
}) => {
  expect(await step('workspace')(page)).toMatchObject({
    workspaceName: 'Browser workspace',
  });
});
