import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepare } from './app';
import { loadHarness } from './bundle';

const tools = (path: string) =>
  fileURLToPath(
    new URL(`../../../tools/agent-pipeline/${path}`, import.meta.url),
  );

test('the agent pipeline tool opens, draws the sample pipeline and checks it', async ({
  page,
}) => {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await loadHarness(page, './seed-harness.ts');
  await page.evaluate(
    (json) =>
      (window as unknown as { __seed(t: string): Promise<void> }).__seed(json),
    readFileSync(tools('tool.json'), 'utf8'),
  );
  await page.reload();
  await page.getByTestId('open-folder').click();
  await page
    .locator('input[type="file"][aria-label="Files to import"]')
    .setInputFiles(tools('code-review.mkmodel.json'));
  await expect(page.getByTestId('import-note')).toBeVisible();
  await page
    .getByRole('tree')
    .getByRole('button', { name: 'Code review pipeline' })
    .click();
  await expect(page.getByTestId('model-view')).toBeVisible();

  // Actors, tasks, artifacts and gates all come from the tool's palette.
  for (const name of ['Agent', 'Human', 'Task', 'Artifact', 'Gate', 'Stage'])
    await expect(page.getByTestId(`palette-class-${name}`)).toBeVisible();

  // The check finds the sample sound.
  await page.getByTestId('commands-menu').locator('summary').click();
  await page
    .getByRole('button', { name: 'Check pipeline' })
    .click({ timeout: 30_000 });
  await expect(page.getByTestId('behaviour-message')).toContainText(
    'The pipeline looks sound.',
  );

  // No formula, constraint or container problems in the sample.
  await expect(page.getByTestId('problems-toggle')).toHaveText('Problems');
  await page.screenshot({ path: 'test-results/agent-pipeline.png' });
});
