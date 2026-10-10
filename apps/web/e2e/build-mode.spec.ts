import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

/** A workspace folder with nothing in it but the workspace file; the app is left on the explorer. */
async function bareWorkspace(page: Page) {
  const folder = `bare-${Math.random().toString(36).slice(2)}`;
  await page.addInitScript(
    ([wanted]) => {
      if (!sessionStorage.getItem('e2e-folder'))
        sessionStorage.setItem('e2e-folder', wanted!);
      (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
        remember: false,
        profile: { name: 'Tester', colour: '#1971c2' },
        pickFolder: async () =>
          (await navigator.storage.getDirectory()).getDirectoryHandle(
            sessionStorage.getItem('e2e-folder')!,
            { create: true },
          ),
      };
    },
    [folder],
  );
  await page.goto('/MetaKit/');
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  return folder;
}

async function addItem(page: Page, tab: string, name: string) {
  await page.getByTestId(`build-tab-${tab}`).click();
  await page.getByTestId('build-new-name').fill(name);
  await page.getByTestId('build-add').click();
}

test.describe('Build mode', () => {
  test('builds a small ER tool without writing JSON, then models with it', async ({
    page,
  }) => {
    await bareWorkspace(page);
    await page.getByTestId('mode-build').click();
    await page.getByTestId('new-kit').click();
    await page.getByTestId('new-kit-name').fill('Mini ER');
    await page.getByTestId('new-kit-create').click();
    await expect(page.getByTestId('build-view')).toBeVisible();

    // A class with two attributes.
    await addItem(page, 'classes', 'Entity');
    await expect(page.getByTestId('class-editor')).toBeVisible();
    // A new attribute opens its form at once.
    await page.getByTestId('attr-add').click();
    const key = page.getByTestId('attr-key');
    await key.fill('EntityName');
    await key.press('Enter');
    await expect(page.getByTestId('attr-EntityName')).toBeVisible();
    await page.getByTestId('attr-new-type').selectOption('choice');
    await page.getByTestId('attr-add').click();
    await expect(page.getByTestId('attr-Attribute')).toBeVisible();

    // A relation class between entities.
    await addItem(page, 'relations', 'Relationship');
    await page.getByTestId('relation-from-Entity').check();
    await page.getByTestId('relation-to-Entity').check();

    // A model type that allows both.
    await addItem(page, 'modelTypes', 'ER diagram');
    await page.getByTestId('mt-class-Entity').check();
    await page.getByTestId('mt-relation-Relationship').check();
    await expect(page.getByTestId('build-issues')).toHaveCount(0);

    // The preview shows the tool at once.
    await expect(page.getByTestId('preview-place-Entity')).toBeVisible();

    // Back to the explorer, then a model made with the new tool.
    await page.getByTestId('build-back').click();
    await page.getByTestId('mode-model').click();
    await page.getByTestId('new-model').click();
    await page
      .getByTestId('new-model-kit')
      .selectOption({ label: 'Mini ER (0.1.0)' });
    await page.getByTestId('new-model-name').fill('Customers');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    await expect(page.getByTestId('palette-class-Entity')).toBeVisible();
    await expect(
      page.getByTestId('palette-relation-Relationship'),
    ).toBeVisible();
  });

  test('refuses a key that is taken and says why', async ({ page }) => {
    await bareWorkspace(page);
    await page.getByTestId('mode-build').click();
    await page.getByTestId('new-kit').click();
    await page.getByTestId('new-kit-name').fill('Keys');
    await page.getByTestId('new-kit-create').click();
    await addItem(page, 'classes', 'Alpha');
    await addItem(page, 'classes', 'Beta');
    const key = page.getByTestId('class-key');
    await key.fill('Alpha');
    await key.press('Enter');
    await expect(page.getByTestId('class-key-problem')).toContainText(
      'already used',
    );
    await expect(key).toHaveValue('Beta');
  });

  test('shows a change made in Build mode in an open model of another window', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const modeller = await context.newPage();
    const folder = await prepare(modeller, { name: 'Anna', colour: '#e8590c' });
    await newModel(modeller, 'Shared model');
    await expect(modeller.getByTestId('palette-class-Task')).toContainText(
      'Task',
    );

    const builder = await context.newPage();
    await prepare(builder, {
      folder,
      seed: false,
      name: 'Ben',
      colour: '#9c36b5',
    });
    await builder.getByTestId('open-folder').click();
    await builder.getByTestId('mode-build').click();
    await builder.getByRole('button', { name: /^Edit / }).click();
    await builder.getByTestId('build-item-Task').click();
    const label = builder.getByTestId('class-label-en');
    await label.fill('Job');
    await label.press('Tab');

    await expect(modeller.getByTestId('palette-class-Task')).toContainText(
      'Job',
      {
        timeout: 15_000,
      },
    );
  });
});
