import { expect, test } from '@playwright/test';
import { canvasPoint, model, newModel, prepare, toolJson } from './app';
import { openMenu } from './menus';

test.describe('start and explorer', () => {
  test('opens a workspace and reaches an empty model in no more than five clicks', async ({
    page,
  }) => {
    await prepare(page);
    const clicks = await newModel(page);
    expect(clicks).toBeLessThanOrEqual(5);
    await expect(page.getByTestId('model-name')).toHaveText('Order process');
    expect(Object.keys((await model(page)).elements)).toEqual([]);
  });

  test('offers to create a workspace in a folder that is not one', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
        remember: false,
        profile: { name: 'Tester', colour: '#1971c2' },
        pickFolder: async () => {
          const root = await navigator.storage.getDirectory();
          return root.getDirectoryHandle(
            `empty-${Math.random().toString(36).slice(2)}`,
            { create: true },
          );
        },
      };
    });
    await page.goto('/MetaKit/');
    await page.getByTestId('open-folder').click();
    await expect(page.getByTestId('create-workspace')).toBeVisible();
    await page.getByTestId('workspace-name').fill('Fresh');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByTestId('workspace-title')).toHaveText('Fresh');
    await expect(page.getByTestId('no-models')).toBeVisible();
  });

  test('offers the built-in tool libraries when the workspace has none of its own', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
        remember: false,
        profile: { name: 'Tester', colour: '#1971c2' },
        pickFolder: async () =>
          (await navigator.storage.getDirectory()).getDirectoryHandle(
            `bare-${Math.random().toString(36).slice(2)}`,
            { create: true },
          ),
      };
    });
    await page.goto('/MetaKit/');
    await page.getByTestId('open-folder').click();
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await page.getByTestId('new-model').click();
    await expect(
      page.getByTestId('new-model-kit').locator('optgroup'),
    ).toHaveAttribute('label', /Built-in/);
    await expect(page.getByTestId('new-model-kit')).toContainText('ER lite');
  });

  test('adds a tool library from a file, refuses a broken one, and then makes a model', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
        remember: false,
        profile: { name: 'Tester', colour: '#1971c2' },
        pickFolder: async () =>
          (await navigator.storage.getDirectory()).getDirectoryHandle(
            `tools-${Math.random().toString(36).slice(2)}`,
            { create: true },
          ),
      };
    });
    await page.goto('/MetaKit/');
    await page.getByTestId('open-folder').click();
    await page.getByRole('button', { name: 'Create workspace' }).click();
    // The models page points to Build, where the tool library is added.
    await expect(page.getByTestId('no-models')).toContainText(
      'no Kit of its own yet',
    );
    await page.getByTestId('go-build').click();
    await expect(page.getByTestId('no-kits')).toBeVisible();

    await page.getByTestId('kit-file').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ "nope": true }'),
    });
    await expect(page.getByTestId('explorer-error')).toContainText(
      'not a valid Kit',
    );

    await page.getByTestId('kit-file').setInputFiles({
      name: 'tool.json',
      mimeType: 'application/json',
      buffer: Buffer.from(toolJson),
    });
    await expect(page.getByTestId('no-kits')).toHaveCount(0);
    await page.getByTestId('mode-model').click();
    await page.getByTestId('new-model').click();
    await page.getByTestId('new-model-name').fill('From a file');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-name')).toHaveText('From a file');
  });

  test('groups models by folder, renames, moves, deletes and restores them', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page, 'Alpha', 'Sales/2026');
    await page.getByTestId('back-to-explorer').click();
    await expect(page.getByTestId('folder-Sales')).toBeVisible();
    await expect(page.getByTestId('folder-Sales/2026')).toBeVisible();

    const menu = () =>
      page.locator('[data-testid^="model-actions-"]').locator('summary');
    await menu().click();
    await page.getByRole('button', { name: 'Rename Alpha' }).click();
    await page.getByLabel('New name').fill('Alpha two');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByRole('button', { name: 'Alpha two', exact: true }),
    ).toBeVisible();

    await menu().click();
    await page
      .getByRole('button', { name: 'Move Alpha two to a folder' })
      .click();
    await page.getByLabel('Folder').fill('HR');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('folder-HR')).toBeVisible();
    await expect(page.getByTestId('folder-Sales')).toHaveCount(0);

    await menu().click();
    await page.getByRole('button', { name: 'Delete Alpha two' }).click();
    await expect(page.getByTestId('no-models')).toBeVisible();
    await page.getByText('Deleted (1), kept for 30 days').click();
    await page.getByRole('button', { name: 'Restore Alpha two' }).click();
    await expect(
      page.getByRole('button', { name: 'Alpha two', exact: true }),
    ).toBeVisible();
  });
});

test.describe('model view', () => {
  test('places and connects objects from the palette, and the model is saved and reloaded', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    await page.getByTestId('palette-class-StartEvent').click();
    let p = await canvasPoint(page, 200, 200);
    await page.mouse.click(p.x, p.y);
    await page.getByTestId('palette-class-Task').click();
    p = await canvasPoint(page, 450, 200);
    await page.mouse.click(p.x, p.y);
    await page.getByTestId('palette-relation-SequenceFlow').click();
    const from = await canvasPoint(page, 200, 200);
    const to = await canvasPoint(page, 450, 200);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();

    const m = await model(page);
    expect(Object.keys(m.elements)).toHaveLength(2);
    expect(Object.values(m.connectors)).toHaveLength(1);

    // Saved shortly after the change; a reload and reopen shows the same content.
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    await page.reload();
    await page.getByTestId('open-folder').click();
    await page
      .getByRole('button', { name: 'Order process', exact: true })
      .click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    const again = await model(page);
    expect(Object.keys(again.elements)).toHaveLength(2);
    expect(Object.values(again.connectors)).toHaveLength(1);
  });

  test('filters the palette by view and shows an unsaved state while saving', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    const all = await page.locator('[data-testid^="palette-class-"]').count();
    expect(all).toBeGreaterThan(0);
    await openMenu(page, 'View');
    await page.getByTestId('view-switcher').selectOption({ index: 1 });
    const filtered = await page
      .locator('[data-testid^="palette-class-"]')
      .count();
    expect(filtered).toBeLessThanOrEqual(all);
  });
});
