import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

type Hook = {
  store: { execute(c: unknown): { value?: unknown } };
  editor: { select(e: string[], c?: string[]): void };
};

const createTask = (page: Page, name: string) =>
  page.evaluate(
    (n) =>
      (window as unknown as { __metakit: Hook }).__metakit.store.execute({
        type: 'createElement',
        class: 'cls_task',
        x: 100,
        y: 100,
        attrs: { att_name: n },
      }).value as string,
    name,
  );

const select = (page: Page, id: string) =>
  page.evaluate(
    (i) =>
      (window as unknown as { __metakit: Hook }).__metakit.editor.select([i]),
    id,
  );

async function openBuild(page: Page) {
  await page.getByTestId('open-folder').click();
  await page.getByTestId('mode-build').click();
  await page.getByRole('button', { name: /^Edit / }).click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

test.describe('panel layouts and unknown attributes', () => {
  test('a panel layout set up in Build mode shapes the panel of the open model', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const modeller = await context.newPage();
    const folder = await prepare(modeller, { name: 'Anna', colour: '#e8590c' });
    await newModel(modeller, 'Layouts');
    const id = await createTask(modeller, 'Check order');
    await select(modeller, id);
    // Without a layout the generated panel is shown.
    await expect(modeller.getByTestId('attribute-panel')).toBeVisible();
    await expect(modeller.getByTestId('panel-tab-General')).toHaveCount(0);

    const builder = await context.newPage();
    await prepare(builder, {
      folder,
      seed: false,
      name: 'Ben',
      colour: '#9c36b5',
    });
    await openBuild(builder);
    await builder.getByTestId('build-item-Task').click();
    await builder.getByTestId('class-edit-panel').click();
    await expect(builder.getByTestId('panel-layout-editor')).toBeVisible();
    await builder.getByTestId('panel-add-tab').click();
    await builder.getByTestId('panel-close').click();

    await expect(modeller.getByTestId('panel-tab-General')).toBeVisible({
      timeout: 15_000,
    });
    await expect(modeller.getByRole('tablist')).toBeVisible();
  });

  test('a value of an attribute that was removed stays visible and can be removed', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const modeller = await context.newPage();
    const folder = await prepare(modeller, { name: 'Anna', colour: '#e8590c' });
    await newModel(modeller, 'Unknown');
    const id = await createTask(modeller, 'Keeps its value');
    await select(modeller, id);
    await expect(modeller.getByTestId('unknown-attributes')).toHaveCount(0);

    const builder = await context.newPage();
    await prepare(builder, {
      folder,
      seed: false,
      name: 'Ben',
      colour: '#9c36b5',
    });
    await openBuild(builder);
    // Name is an attribute of the class that Task extends.
    await builder.getByTestId('build-item-FlowNode').click();
    await builder.getByTestId('attr-Name').click();
    await builder.getByRole('button', { name: 'Delete Name' }).click();
    await builder.getByTestId('attr-confirm-delete').click();

    const group = modeller.getByTestId('unknown-attributes');
    await expect(group).toBeVisible({ timeout: 15_000 });
    await group.locator('summary').click();
    await expect(group).toContainText('Keeps its value');
    await modeller.getByTestId('unknown-att_name').getByRole('button').click();
    await expect(group).toHaveCount(0);
  });
});
