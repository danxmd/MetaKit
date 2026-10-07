import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// The adapter contract and the folder-handle storage, run inside real Chromium against the
// File System Access API. The origin private file system is used as the folder: it has the same
// handle interface as a folder the user picks, but needs no dialog.
test('the local folder adapter passes the shared storage contract in Chromium', async ({
  page,
}) => {
  test.setTimeout(90_000);
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

  type Result = { name: string; ok: boolean; error?: string };
  const run = (observer: boolean) =>
    page.evaluate(
      (useObserver) =>
        (
          window as never as {
            __storage: { runContract(o: boolean): Promise<Result[]> };
          }
        ).__storage.runContract(useObserver),
      observer,
    );

  for (const useObserver of [true, false]) {
    const results = await run(useObserver);
    expect(results.length).toBeGreaterThanOrEqual(13);
    const failed = results.filter((r) => !r.ok);
    expect(
      failed,
      `observer ${useObserver}: ${JSON.stringify(failed, null, 2)}`,
    ).toEqual([]);
  }

  const extras = await page.evaluate(() =>
    (
      window as never as {
        __storage: { runExtras(): Promise<Record<string, unknown>> };
      }
    ).__storage.runExtras(),
  );
  expect(extras).toMatchObject({
    recalled: true,
    granted: true,
    requestAccess: true,
    instanceStable: true,
    stored: true,
    workspaceName: 'Browser workspace',
  });
});
