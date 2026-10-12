import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

/** A fresh workspace with one new Kit open in Build mode. */
async function openNewKit(page: Page) {
  await prepare(page, { seed: false });
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByTestId('mode-build').click();
  await page.getByTestId('new-kit').click();
  await page.getByTestId('new-kit-name').fill('Coherent');
  await page.getByTestId('new-kit-create').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

async function addClass(page: Page, name: string) {
  await page.getByTestId('build-new-name').fill(name);
  await page.getByTestId('build-add').click();
  await expect(page.getByTestId(`build-item-${name}`)).toBeVisible();
}

test.describe('Deleting', () => {
  test('a class goes at once and Undo brings it back', async ({ page }) => {
    await openNewKit(page);
    await addClass(page, 'Task');
    await page.getByTestId('build-item-Task').hover();
    await page.getByTestId('build-delete-Task').click();
    await expect(page.getByTestId('build-item-Task')).toHaveCount(0);
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    await expect(page.getByTestId('message')).toContainText(
      'Deleted class Task',
    );
    await page.getByTestId('toast-undo').click();
    await expect(page.getByTestId('build-item-Task')).toBeVisible();
    await expect(page.getByTestId('message')).toHaveCount(0);
  });

  test('the Undo offer goes away once something else changes', async ({
    page,
  }) => {
    await openNewKit(page);
    await addClass(page, 'Task');
    await page.getByTestId('build-item-Task').hover();
    await page.getByTestId('build-delete-Task').click();
    await expect(page.getByTestId('toast-undo')).toBeVisible();
    // A new step would make Undo revert that step instead, so the offer is withdrawn.
    await addClass(page, 'Event');
    await expect(page.getByTestId('toast-undo')).toHaveCount(0);
  });

  test('a model goes to the trash and Undo restores it', async ({ page }) => {
    await prepare(page);
    await newModel(page, 'Gone soon');
    await page.getByTestId('crumb-area').click();
    await expect(page.getByTestId('models-page')).toBeVisible();
    await page
      .locator('[data-testid^=model-actions-]')
      .first()
      .locator('summary')
      .click();
    await page.getByRole('button', { name: 'Delete Gone soon' }).click();
    await expect(page.getByTestId('message')).toContainText(
      'Deleted model Gone soon',
    );
    await expect(page.getByText('Deleted (1')).toBeVisible();
    await page.getByTestId('toast-undo').click();
    await expect(page.getByText('Deleted (1')).toHaveCount(0);
    await expect(page.getByRole('tree')).toContainText('Gone soon');
  });
});

test.describe('Menus', () => {
  test('arrow keys move through items and Escape closes', async ({ page }) => {
    await prepare(page);
    await newModel(page);
    const header = page.getByTestId('model-header');
    const view = header.locator('details.menu', {
      has: page.locator('summary', { hasText: 'View' }),
    });
    await view.locator('summary').focus();
    await page.keyboard.press('ArrowDown');
    await expect(view).toHaveAttribute('open', '');
    await expect(
      view.getByRole('button', { name: 'Fit to window' }),
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(view.getByRole('button', { name: 'Zoom in' })).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(view).not.toHaveAttribute('open', '');
    await expect(view.locator('summary')).toBeFocused();
  });

  test('a click outside an open menu still does what it hit', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    const header = page.getByTestId('model-header');
    await header.locator('summary', { hasText: 'Arrange' }).click();
    await expect(header.locator('details.menu[open]')).toHaveCount(1);
    // One click on another menu closes the first and opens the second.
    await header.locator('summary', { hasText: 'Edit' }).click();
    await expect(header.locator('details.menu[open]')).toHaveCount(1);
    await expect(
      header.locator('details.menu[open] summary', { hasText: 'Edit' }),
    ).toBeVisible();
  });
});

test.describe('Location bar', () => {
  test('leaves the model with a menu open in one click on Models', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    const header = page.getByTestId('model-header');
    await header.locator('summary', { hasText: 'View' }).click();
    await expect(header.locator('details.menu[open]')).toHaveCount(1);
    await page.getByTestId('crumb-area').click();
    await expect(page.getByTestId('models-page')).toBeVisible();
    await expect(page.locator('details.menu[open]')).toHaveCount(0);
  });

  test('shows where you are and renames the model from the last crumb', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page, 'Order process');
    const location = page.getByRole('navigation', { name: 'Location' });
    await expect(location.getByTestId('crumb-area')).toHaveText('Models');
    await expect(page.getByTestId('model-name')).toHaveText('Order process');
    // The model view has the top bar and one toolbar above the canvas, nothing more.
    const top = (await page.getByTestId('top-bar').boundingBox())!;
    const tools = (await page.getByTestId('model-header').boundingBox())!;
    const canvas = (await page.getByTestId('canvas-host').boundingBox())!;
    expect(tools.y).toBeLessThanOrEqual(top.y + top.height + 1);
    expect(canvas.y).toBeLessThanOrEqual(tools.y + tools.height + 1);

    // Escape keeps the name; Enter renames.
    await page.getByTestId('crumb-document').click();
    await page.getByTestId('crumb-rename').fill('Something else');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('model-name')).toHaveText('Order process');
    await page.getByTestId('crumb-document').click();
    await page.getByTestId('crumb-rename').fill('Order handling');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('model-name')).toHaveText('Order handling');
    await page.getByTestId('crumb-workspace').click();
    await expect(page.getByTestId('models-page')).toBeVisible();
    await expect(page.getByRole('tree')).toContainText('Order handling');
    await expect(page.getByTestId('crumb-document')).toHaveCount(0);
  });

  test('a Kit keeps its name and version in Settings, and Kits leads back', async ({
    page,
  }) => {
    await openNewKit(page);
    await expect(page.getByTestId('crumb-area')).toHaveText('Kits');
    await expect(page.getByTestId('kit-name')).toHaveText('Coherent');
    await expect(page.getByTestId('build-name')).toHaveCount(0);
    await page.getByTestId('build-tab-settings').click();
    await page.getByTestId('build-name').fill('Coherent notation');
    await page.getByTestId('build-name').press('Tab');
    await expect(page.getByTestId('kit-name')).toHaveText('Coherent notation');
    await page.getByTestId('build-version').fill('one');
    await page.getByTestId('build-version').press('Tab');
    await expect(page.getByTestId('settings-editor')).toContainText(
      'A version looks like 1.0.0.',
    );
    await page.getByTestId('build-version').fill('1.1.0');
    await page.getByTestId('build-version').press('Tab');
    await expect(page.getByTestId('build-status')).toHaveText('Saved');
    await page.getByTestId('crumb-area').click();
    await expect(page.getByTestId('kits-page')).toContainText(
      'Coherent notation',
    );
  });
});
