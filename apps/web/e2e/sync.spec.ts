import { expect, test, type Page } from '@playwright/test';
import { model, newModel, prepare } from './app';

type Hook = {
  store: { execute(c: unknown): { value?: unknown } };
  editor: { select(e: string[], c?: string[]): void };
  scene: { elements: Map<string, { x: number; y: number; label: string }> };
};

/** Opens the same workspace in a second window of the same browser, and the same model. */
async function secondWindow(page: Page, folder: string, name = 'Ben') {
  const other = await page.context().newPage();
  await prepare(other, { folder, seed: false, name, colour: '#9c36b5' });
  await other.getByTestId('open-folder').click();
  await other
    .getByRole('button', { name: 'Shared model', exact: true })
    .click();
  await expect(other.getByTestId('model-view')).toBeVisible();
  return other;
}

const create = (page: Page, attrs: Record<string, unknown>, x = 100) =>
  page.evaluate(
    ([a, px]) =>
      (window as unknown as { __metakit: Hook }).__metakit.store.execute({
        type: 'createElement',
        class: 'cls_task',
        x: px,
        y: 100,
        attrs: a,
      }).value as string,
    [attrs, x] as const,
  );

const elements = (page: Page) =>
  page.evaluate(() =>
    [
      ...(
        window as unknown as { __metakit: Hook }
      ).__metakit.scene.elements.values(),
    ].map((e) => ({ x: e.x, y: e.y, label: e.label })),
  );

test.describe('two windows on one folder', () => {
  test("show each other's edits, selections and presence, and each keeps its own undo", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const folder = await prepare(first, { name: 'Anna', colour: '#e8590c' });
    await newModel(first, 'Shared model');
    const second = await secondWindow(first, folder);

    // An edit in one window arrives in the other without a reload.
    const id = await create(first, { att_name: 'Written by Anna' });
    await expect
      .poll(() => elements(second), { timeout: 15_000 })
      .toEqual([expect.objectContaining({ label: 'Written by Anna' })]);

    // Edits to different things in both windows both survive.
    const other = await create(second, { att_name: 'Written by Ben' }, 400);
    await expect
      .poll(async () => (await elements(first)).length, { timeout: 15_000 })
      .toBe(2);
    await first.evaluate(
      ([target]) =>
        (window as unknown as { __metakit: Hook }).__metakit.store.execute({
          type: 'move',
          id: target,
          x: 600,
          y: 300,
        }),
      [id],
    );
    await expect
      .poll(
        async () =>
          (await elements(second)).find((e) => e.label === 'Written by Anna')
            ?.x,
        { timeout: 15_000 },
      )
      .toBe(600);

    // Presence: each shows the other as an avatar with the other's initials.
    await expect(first.getByTestId('people').getByTitle('Ben')).toBeVisible({
      timeout: 20_000,
    });
    await expect(second.getByTestId('people').getByTitle('Anna')).toBeVisible({
      timeout: 20_000,
    });

    // A selection in one window is outlined in the other (it is drawn on the canvas, so the
    // test reads what the canvas was told to draw).
    await first.evaluate(
      ([target]) =>
        (window as unknown as { __metakit: Hook }).__metakit.editor.select([
          target,
        ]),
      [id] as const,
    );
    await expect
      .poll(
        () =>
          second.evaluate(() => {
            const hook = (
              window as unknown as {
                __metakit: {
                  view: {
                    active: { remote: { label: string; elements: string[] }[] };
                  };
                };
              }
            ).__metakit;
            return hook.view.active.remote.map((r) => r.label);
          }),
        { timeout: 20_000 },
      )
      .toEqual(['A']);

    // The window that did not make the last edit has its own undo history, untouched.
    expect(other).toMatch(/^el_/);
    await second.getByRole('button', { name: 'Undo' }).click();
    await expect
      .poll(async () => (await elements(second)).map((e) => e.label), {
        timeout: 5000,
      })
      .toEqual(['Written by Anna']);
    await expect
      .poll(async () => (await elements(first)).map((e) => e.label), {
        timeout: 15_000,
      })
      .toEqual(['Written by Anna']);

    // The status line names who changed the model last.
    await expect(second.getByTestId('sync-status')).toContainText(
      'Last change from',
      { timeout: 15_000 },
    );

    await context.close();
  });

  test('a clash is reported to the person whose value lost, in plain words', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const folder = await prepare(first, { name: 'Anna', colour: '#e8590c' });
    await newModel(first, 'Shared model');
    const second = await secondWindow(first, folder);
    const id = await create(first, { att_name: 'T' });
    await expect
      .poll(async () => (await elements(second)).length, { timeout: 15_000 })
      .toBe(1);
    // Let both windows learn each other's names.
    await expect(first.getByTestId('people').getByTitle('Ben')).toBeVisible({
      timeout: 20_000,
    });

    const edit = (page: Page, value: string) =>
      page.evaluate(
        ([target, v]) =>
          (window as unknown as { __metakit: Hook }).__metakit.store.execute({
            type: 'setAttribute',
            target,
            attr: 'att_priority',
            value: v,
          }),
        [id, value] as const,
      );
    // Anna's edit first, Ben's later, and neither has read the other's before editing: stop the
    // reading by editing in the same moment.
    await Promise.all([
      edit(first, 'Low'),
      (async () => {
        await second.waitForTimeout(30);
        await edit(second, 'High');
      })(),
    ]);
    await expect(first.getByTestId('notices')).toContainText(
      'Ben changed Priority',
      { timeout: 20_000 },
    );
    await expect(first.getByTestId('notices')).toContainText(
      "Ben's value was kept",
    );
    await first
      .getByTestId('notices')
      .getByRole('button', { name: 'Dismiss' })
      .click();
    await expect(first.getByTestId('notices')).toHaveCount(0);
    await expect(second.getByTestId('notices')).toHaveCount(0);
    await context.close();
  });

  test('warns softly when someone else is editing the same text', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const folder = await prepare(first, { name: 'Anna', colour: '#e8590c' });
    await newModel(first, 'Shared model');
    const second = await secondWindow(first, folder);
    await create(first, { att_name: 'Both edit me' });
    await expect
      .poll(async () => (await elements(second)).length, { timeout: 15_000 })
      .toBe(1);

    const doubleClick = async (page: Page) => {
      const c = await page.evaluate(() => {
        const hook = (
          window as unknown as {
            __metakit: {
              scene: {
                elements: Map<
                  string,
                  { x: number; y: number; w: number; h: number }
                >;
              };
              view: {
                fit(): void;
                toScreenFromWorld(p: { x: number; y: number }): {
                  x: number;
                  y: number;
                };
              };
            };
          }
        ).__metakit;
        hook.view.fit();
        const e = [...hook.scene.elements.values()][0]!;
        return hook.view.toScreenFromWorld({
          x: e.x + e.w / 2,
          y: e.y + e.h / 2,
        });
      });
      const box = (await page.getByTestId('canvas-host').boundingBox())!;
      await page.mouse.dblclick(box.x + c.x, box.y + c.y);
    };
    await doubleClick(first);
    await expect(first.getByTestId('label-editor')).toBeVisible();
    await expect(second.getByTestId('people').getByTitle('Anna')).toBeVisible({
      timeout: 20_000,
    });
    // Give Anna's "editing" notice time to reach Ben.
    await second.waitForTimeout(2500);
    await doubleClick(second);
    await expect(second.getByTestId('message')).toContainText(
      'Anna is editing this text too',
    );
    // Soft: Ben can edit anyway.
    await expect(second.getByTestId('label-editor')).toBeVisible();
    await context.close();
  });
});

test('asks for a name and a colour on the first visit, and not again', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
      remember: false,
    };
  });
  await page.goto('/MetaKit/');
  await expect(page.getByTestId('profile-dialog')).toBeVisible();
  await expect(page.getByTestId('profile-save')).toBeDisabled();
  await page.getByTestId('profile-name').fill('Cleo');
  await page.getByRole('radio', { name: '#2f9e44' }).check({ force: true });
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('profile-dialog')).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('open-folder')).toBeVisible();
  await expect(page.getByTestId('profile-dialog')).toHaveCount(0);
});

test('model first-visit helper still reaches an empty model', async ({
  page,
}) => {
  await prepare(page);
  await newModel(page);
  expect(Object.keys((await model(page)).elements)).toEqual([]);
});
