import { expect, test, type Page } from '@playwright/test';
import { prepare } from './app';

/** A fresh workspace with one new tool library open in Build mode. */
async function openNewTool(page: Page, name = 'Catalog tool') {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByTestId('mode-build').click();
  await page.getByTestId('new-kit').click();
  await page.getByTestId('new-kit-name').fill(name);
  await page.getByTestId('new-kit-create').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

test.describe('Class catalog', () => {
  test('adds classes from two tabs with their relation classes, and one undo removes them', async ({
    page,
  }) => {
    await openNewTool(page);
    // Only the Classes section offers the catalog.
    await page.getByTestId('build-tab-relations').click();
    await expect(page.getByTestId('catalog-open')).toHaveCount(0);
    await page.getByTestId('build-tab-classes').click();

    await page.getByTestId('catalog-open').click();
    const dialog = page.getByTestId('catalog-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab')).toHaveCount(7);
    await expect(page.getByTestId('catalog-add')).toBeDisabled();
    await expect(page.getByTestId('catalog-relations')).toBeChecked();

    await page.getByTestId('catalog-tab-data').click();
    await expect(page.getByTestId('catalog-tab-data')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByTestId('catalog-item-Dataset').check();
    await page.getByTestId('catalog-item-DataPipeline').check();
    // The right pane shows the focused class.
    await expect(page.getByTestId('catalog-detail')).toContainText(
      'Data pipeline',
    );
    await expect(page.getByTestId('catalog-detail')).toContainText('Writes to');

    await page.getByTestId('catalog-tab-governance').click();
    await page.getByTestId('catalog-item-Risk').check();
    await expect(page.getByTestId('catalog-count')).toContainText(
      '3 classes and',
    );

    // Depends on joins any two classes, so it comes only when it is ticked.
    await expect(
      page.getByTestId('catalog-generic-DependsOn'),
    ).not.toBeChecked();
    await page.getByTestId('catalog-generic-DependsOn').check();
    await page.getByTestId('catalog-add').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('catalog-result')).toContainText(
      'Added 3 classes and',
    );
    for (const key of ['Dataset', 'DataPipeline', 'Risk'])
      await expect(page.getByTestId(`build-item-${key}`)).toBeVisible();
    // The first new class is selected.
    await expect(page.getByTestId('build-item-Dataset')).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByTestId('build-issues')).toHaveCount(0);

    await page.getByTestId('build-tab-relations').click();
    for (const key of ['FlowsTo', 'WritesTo', 'DependsOn'])
      await expect(page.getByTestId(`build-item-${key}`)).toBeVisible();

    // One undo removes the classes, their looks and the relation classes.
    await page.getByTestId('build-undo').click();
    await expect(page.getByTestId('build-list-empty')).toBeVisible();
    await expect(page.getByTestId('build-undo')).toBeDisabled();
    await page.getByTestId('build-tab-classes').click();
    await expect(page.getByTestId('build-list-empty')).toBeVisible();
    await expect(page.getByTestId('build-tab-shapes')).toContainText('0');
  });

  test('searches across topics and marks classes that are already there', async ({
    page,
  }) => {
    await openNewTool(page);
    await page.getByTestId('build-new-name').fill('Dataset');
    await page.getByTestId('build-add').click();
    await expect(page.getByTestId('build-item-Dataset')).toBeVisible();

    await page.getByTestId('catalog-open').click();
    const dialog = page.getByTestId('catalog-dialog');
    // The General tab is open; a search finds classes from other topics.
    await page.getByTestId('catalog-search').fill('model');
    await expect(page.getByTestId('catalog-item-MLModel')).toBeVisible();
    await expect(
      page.getByTestId('catalog-item-FoundationModel'),
    ).toBeVisible();
    await expect(page.getByTestId('catalog-item-Note')).toHaveCount(0);

    await page.getByTestId('catalog-search').fill('dataset');
    const taken = page.getByTestId('catalog-item-Dataset');
    await expect(taken).toBeDisabled();
    await expect(taken).toBeChecked();
    await expect(dialog.locator('label', { has: taken })).toContainText(
      'Already in this Kit',
    );

    // Escape closes the dialog without adding anything.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('build-tab-classes')).toContainText('1');
  });
});
