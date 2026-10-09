import { expect, test, type Page } from '@playwright/test';
import { prepare } from './app';

async function emptyWorkspace(page: Page) {
  await prepare(page, { seed: false });
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('models-page')).toBeVisible();
}

test.describe('Built-in and workspace tool libraries', () => {
  test('the page shows the two sections apart, and a built-in one can be used as it is', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await page.getByTestId('mode-build').click();
    const workspace = page.getByTestId('workspace-tools');
    const builtIn = page.getByTestId('built-in-tools');
    await expect(
      workspace.getByRole('heading', {
        name: 'In this workspace',
        exact: true,
      }),
    ).toBeVisible();
    await expect(workspace.getByTestId('no-tools')).toBeVisible();
    await expect(
      builtIn.getByRole('heading', { name: 'Built-in', exact: true }),
    ).toBeVisible();
    await expect(builtIn.locator('li.built-in')).toHaveCount(3);
    await expect(page.getByTestId('built-in-tool_erlite')).toContainText(
      'read-only',
    );

    // What is inside is read on demand.
    const card = page.getByTestId('built-in-tool_erlite');
    await card.getByText('What is inside').click();
    await expect(card).toContainText('Entity');

    await page.getByTestId('use-built-in-tool_erlite').click();
    await expect(workspace.getByTestId('no-tools')).toHaveCount(0);
    await expect(
      workspace.getByRole('heading', { name: 'ER lite' }),
    ).toBeVisible();
    await expect(page.getByTestId('built-in-added-tool_erlite')).toBeVisible();
    await expect(page.getByTestId('use-built-in-tool_erlite')).toHaveCount(0);
  });

  test('copy and extend makes a new library based on the original', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await page.getByTestId('mode-build').click();
    await page.getByTestId('copy-built-in-tool_agentpipeline').click();
    const dialog = page.getByTestId('new-tool-dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByTestId('start-built-in-tool_agentpipeline'),
    ).toBeChecked();
    await dialog.getByTestId('new-tool-name').fill('Our agents');
    await expect(dialog.getByTestId('new-tool-note')).toContainText(
      'Agent pipeline',
    );
    await dialog.getByTestId('new-tool-create').click();

    // It opens in Build with the classes of the original.
    await expect(page.getByTestId('build-view')).toBeVisible();
    await expect(page.getByTestId('build-item-Agent')).toBeVisible();
    await page.getByTestId('build-back').click();

    const ours = page.getByTestId('workspace-tools').locator('li.tool', {
      hasText: 'Our agents',
    });
    await expect(ours).toContainText('Based on Agent pipeline 1.0.0');
    await expect(ours).toContainText('Version 1.0.0');
    // The original is still offered as built-in, not added.
    await expect(
      page.getByTestId('use-built-in-tool_agentpipeline'),
    ).toBeVisible();

    // A workspace library can be copied too, from its … menu.
    await ours.locator('summary').click();
    await ours.getByText('Copy and extend…').click();
    await expect(page.getByTestId('new-tool-dialog')).toBeVisible();
    await page.getByTestId('new-tool-name').fill('Our agents, team B');
    await page.getByTestId('new-tool-create').click();
    await expect(page.getByTestId('build-view')).toBeVisible();
    await page.getByTestId('build-back').click();
    await expect(
      page
        .getByTestId('workspace-tools')
        .locator('li.tool', { hasText: 'team B' }),
    ).toContainText('Based on Our agents 1.0.0');
  });

  test('a model can be made with a built-in library, which is then added', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await expect(page.getByTestId('no-models')).toContainText(
      'pick a built-in one in New model',
    );
    await page.getByTestId('new-model-empty').click();
    await page
      .getByTestId('new-model-tool')
      .selectOption('built-in:tool_erlite');
    await expect(page.getByTestId('new-model-type')).not.toHaveValue('');
    await page.getByTestId('new-model-name').fill('Library data');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    await expect(page.getByTestId('palette-class-Entity')).toBeVisible();

    await page.getByTestId('back-to-explorer').click();
    await page.getByTestId('mode-build').click();
    await expect(page.getByTestId('built-in-added-tool_erlite')).toBeVisible();
  });
});
