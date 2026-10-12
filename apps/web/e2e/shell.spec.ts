import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

/** A workspace with no Kit, made through the start page. */
async function emptyWorkspace(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
      remember: false,
      profile: { name: 'Tester', colour: '#1971c2' },
      pickFolder: async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle(
          `shell-${Math.random().toString(36).slice(2)}`,
          { create: true },
        ),
    };
  });
  await page.goto('/MetaKit/');
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
}

test.describe('the app shell', () => {
  test('the start page explains MetaKit, the three steps and the workspace folder', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await expect(page.getByTestId('start-page')).toContainText(
      'Build modelling languages',
    );
    for (const step of [
      'Open or create a workspace folder',
      'Add a Kit, or build one',
      'Model',
    ])
      await expect(
        page.getByRole('heading', { name: step, exact: true }),
      ).toBeVisible();
    await expect(page.getByTestId('workspace-explainer')).toContainText(
      'uploads nothing',
    );
    await expect(page.getByTestId('open-folder')).toBeVisible();
    // No workspace yet, so no bar with the mode switch.
    await expect(page.getByTestId('top-bar')).toHaveCount(0);
  });

  test('the mode switch moves between the models page and the Kits page', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page, 'Order process');

    // Switching to Build closes the model and shows the Kits.
    await page.getByTestId('mode-build').click();
    await expect(page.getByTestId('kits-page')).toBeVisible();
    await expect(page.getByTestId('model-view')).toHaveCount(0);
    await expect(page.getByTestId('mode-build')).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Opening a Kit for editing, then switching to Model closes it.
    await page.getByRole('button', { name: /^Edit / }).click();
    await expect(page.getByTestId('build-view')).toBeVisible();
    await page.getByTestId('mode-model').click();
    await expect(page.getByTestId('models-page')).toBeVisible();
    await expect(page.getByTestId('build-view')).toHaveCount(0);
    await expect(page.getByTestId('mode-model')).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The model made before is listed, and opens again.
    await page
      .getByRole('tree')
      .getByRole('button', { name: 'Order process' })
      .click();
    await expect(page.getByTestId('model-view')).toBeVisible();
  });

  test('the appearance choice is remembered across a reload', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    const surface = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--surface')
          .trim(),
      );
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await surface();

    await page.getByTestId('settings-menu').locator('summary').click();
    await page.getByTestId('theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await surface()).not.toBe(light);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await surface()).not.toBe(light);

    // "System" goes back to following the browser.
    await page.getByTestId('open-folder').click();
    await page.getByTestId('settings-menu').locator('summary').click();
    await page.getByTestId('theme-system').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    expect(await surface()).toBe(light);
  });

  test('the start page links to the source and to Buy me a coffee', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await expect(page.getByTestId('start-page')).toBeVisible();
    const coffee = page.getByTestId('buy-me-a-coffee');
    await expect(coffee).toBeVisible();
    await expect(coffee).toHaveAttribute(
      'href',
      'https://buymeacoffee.com/danial.amlashi',
    );
    await expect(coffee).toHaveAttribute('target', '_blank');
    await expect(page.getByTestId('support-footer')).toContainText(
      'Source on GitHub',
    );
  });

  test('the models and Kits pages show the same footer', async ({ page }) => {
    await emptyWorkspace(page);
    await expect(
      page.getByTestId('models-page').getByTestId('buy-me-a-coffee'),
    ).toBeVisible();
    await page.getByTestId('mode-build').click();
    await expect(
      page.getByTestId('kits-page').getByTestId('buy-me-a-coffee'),
    ).toBeVisible();
  });

  test('empty states say what to do next', async ({ page }) => {
    await emptyWorkspace(page);
    await expect(page.getByTestId('models-page')).toBeVisible();
    await expect(page.getByTestId('no-models')).toContainText(
      'pick a built-in one in New model',
    );
    await page.getByTestId('go-build').click();
    await expect(page.getByTestId('kits-page')).toBeVisible();
    await expect(page.getByTestId('no-kits')).toContainText(
      'Use a built-in one',
    );

    // With a Kit the models page offers to make the first model.
    await page.getByTestId('new-kit').click();
    await page.getByTestId('new-kit-name').fill('Mini');
    await page.getByTestId('new-kit-create').click();
    await expect(page.getByTestId('build-view')).toBeVisible();
    await page.getByTestId('mode-model').click();
    await expect(page.getByTestId('no-models')).toContainText('No models yet');
    await expect(page.getByTestId('new-model-empty')).toBeVisible();
  });
});
