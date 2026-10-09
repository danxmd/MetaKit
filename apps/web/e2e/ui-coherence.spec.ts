import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

/** A fresh workspace with one new tool library open in Build mode. */
async function openNewTool(page: Page) {
  await prepare(page, { seed: false });
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByTestId('mode-build').click();
  await page.getByTestId('new-tool').click();
  await page.getByTestId('new-tool-name').fill('Coherent');
  await page.getByTestId('new-tool-create').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

async function addClass(page: Page, name: string) {
  await page.getByTestId('build-new-name').fill(name);
  await page.getByTestId('build-add').click();
  await expect(page.getByTestId(`build-item-${name}`)).toBeVisible();
}

test.describe('Deleting', () => {
  test('a class goes at once and Undo brings it back', async ({ page }) => {
    await openNewTool(page);
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
    await openNewTool(page);
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
    await page.getByTestId('back-to-explorer').click();
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
