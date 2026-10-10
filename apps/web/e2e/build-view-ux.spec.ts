import { expect, test, type Page } from '@playwright/test';
import { prepare } from './app';
import { loadHarness } from './bundle';

/** A fresh workspace with one new Kit open in Build mode. */
async function openNewKit(page: Page, name = 'UX Kit') {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByTestId('mode-build').click();
  await page.getByTestId('new-kit').click();
  await page.getByTestId('new-kit-name').fill(name);
  await page.getByTestId('new-kit-create').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

test.describe('Build view structure', () => {
  test('groups the sections under headings', async ({ page }) => {
    await openNewKit(page);
    const nav = page.getByRole('navigation', { name: 'Kit sections' });
    const groups: [string, string[]][] = [
      ['Metamodel', ['classes', 'relations', 'modelTypes']],
      ['Appearance', ['shapes']],
      ['Behaviour', ['rules', 'scripts']],
      ['Kit', ['settings']],
    ];
    for (const [title, tabs] of groups) {
      const group = nav.getByRole('group', { name: title });
      await expect(group).toBeVisible();
      for (const tab of tabs)
        await expect(group.getByTestId(`build-tab-${tab}`)).toBeVisible();
    }
    // The way back and the status are always in the header.
    await expect(page.getByTestId('build-back')).toBeVisible();
    await expect(page.getByTestId('build-status')).toBeVisible();
    await expect(page.getByTestId('git-menu')).toHaveCount(0);
  });

  test('adds a class from the labelled input at the top of the list', async ({
    page,
  }) => {
    await openNewKit(page);
    // An empty list teaches what a class is.
    await expect(page.getByTestId('build-list-empty')).toContainText(
      'A class describes one kind of object',
    );
    await expect(page.getByLabel('New class')).toBeVisible();
    await page.getByTestId('build-new-name').fill('Task');
    await page.getByTestId('build-add').click();
    await expect(page.getByTestId('class-editor')).toBeVisible();
    await expect(page.getByTestId('build-item-Task')).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByTestId('build-list-empty')).toHaveCount(0);
    // The input sits above the list.
    const input = await page.getByTestId('build-new-name').boundingBox();
    const item = await page.getByTestId('build-item-Task').boundingBox();
    expect(input!.y).toBeLessThan(item!.y);
  });

  test('the preview docks on the right and collapses', async ({ page }) => {
    await openNewKit(page);
    await expect(page.getByTestId('kit-preview')).toBeVisible();
    await page.getByTestId('preview-collapse').click();
    await expect(page.getByTestId('kit-preview')).toHaveCount(0);
    await page.getByTestId('build-preview-toggle').click();
    await expect(page.getByTestId('kit-preview')).toBeVisible();
  });

  test('follows the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openNewKit(page);
    const surface = () =>
      page
        .getByRole('navigation', { name: 'Kit sections' })
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    const light = await surface();
    await page.evaluate(() =>
      document.documentElement.setAttribute('data-theme', 'dark'),
    );
    await expect.poll(surface).not.toBe(light);
    // The script editor takes the dark appearance too.
    await page.getByTestId('build-tab-scripts').click();
    await page.getByTestId('script-add').click();
    const editor = page.locator('.cm-editor').first();
    await expect(editor).toBeVisible();
    const dark = await editor.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await page.evaluate(() =>
      document.documentElement.setAttribute('data-theme', 'light'),
    );
    await expect
      .poll(() => editor.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(dark);
  });
});

test.describe('Source control menu', () => {
  test('shows only for a Kit linked to Git', async ({ page }) => {
    await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
    await loadHarness(page, './git-harness.ts');
    await page.getByTestId('open-folder').click();
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await page.getByTestId('mode-build').click();
    await page.getByTestId('add-menu').locator('summary').click();
    await page.getByTestId('open-git').click();
    await page.getByTestId('git-token-label').fill('Test token');
    await page.getByTestId('git-token-value').fill('not-a-real-token');
    await page.getByTestId('git-token-add').click();
    await page.getByTestId('git-choose-repo').fill('acme/tools');
    await page.getByTestId('git-test').click();
    await expect(page.getByTestId('git-test-result')).toBeVisible();
    await page.getByTestId('git-choose').click();
    await expect(page.getByTestId('build-view')).toBeVisible();

    await expect(page.getByTestId('git-menu')).toBeVisible();
    await expect(page.getByTestId('git-commit')).toBeHidden();
    await page.getByTestId('git-menu-summary').click();
    await expect(page.getByTestId('git-repo')).toContainText('acme/tools');
    await expect(page.getByTestId('git-commit')).toBeVisible();
    await expect(page.getByTestId('git-pull')).toBeVisible();
    await expect(page.getByTestId('git-releases')).toBeVisible();
    // Choosing an entry closes the menu.
    await page.getByTestId('git-releases').click();
    await expect(page.getByTestId('git-commit')).toBeHidden();
  });
});
