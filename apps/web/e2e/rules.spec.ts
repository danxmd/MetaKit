import { expect, test, type Page } from '@playwright/test';
import { canvasPoint } from './app';

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
}

async function addItem(page: Page, tab: string, name: string) {
  await page.getByTestId(`build-tab-${tab}`).click();
  await page.getByTestId('build-new-name').fill(name);
  await page.getByTestId('build-add').click();
}

/** Adds an attribute to the class that is open and renames it. */
async function addAttribute(page: Page, type: string, key: string) {
  await page.getByTestId('attr-new-type').selectOption(type);
  await page.getByTestId('attr-add').click();
  const field = page.getByTestId('attr-key');
  await field.fill(key);
  await field.press('Enter');
  await expect(page.getByTestId(`attr-${key}`)).toBeVisible();
}

test.describe('Rules', () => {
  test('"High-priority tasks need an owner" built in Build mode works in a model', async ({
    page,
  }) => {
    await bareWorkspace(page);
    await page.getByTestId('mode-build').click();
    await page.getByTestId('new-kit').click();
    await page.getByTestId('new-kit-name').fill('Task tracker');
    await page.getByTestId('new-kit-create').click();
    await expect(page.getByTestId('build-view')).toBeVisible();

    // The class and its attributes.
    await addItem(page, 'classes', 'Task');
    await addAttribute(page, 'text', 'Name');
    await addAttribute(page, 'choice', 'Priority');
    await page.getByTestId('attr-options').fill('Low\nMedium\nHigh');
    await page.getByTestId('attr-options').blur();
    await addAttribute(page, 'text', 'Owner');
    await addAttribute(page, 'text', 'Status');
    await addItem(page, 'modelTypes', 'Tasks');
    await page.getByTestId('mt-class-Task').check();

    // The rule, through the form only.
    await page.getByTestId('build-tab-rules').click();
    await page.getByTestId('rule-add').click();
    await page
      .getByTestId('rule-label')
      .fill('High-priority tasks need an owner');
    await page.getByTestId('rule-label').blur();
    await page.getByTestId('rule-event').selectOption('attribute.changed');
    await page.getByTestId('rule-class').selectOption({ label: 'Task' });
    await page.getByTestId('rule-attribute').selectOption('Priority');
    await page
      .getByTestId('rule-if')
      .fill("= Priority == 'High' && Owner == null");
    await page.getByTestId('rule-if').blur();

    await page.getByTestId('rule-add-action').selectOption('setAttribute');
    await page.getByTestId('action-0-attribute').selectOption('Status');
    await page.getByTestId('action-0-value').fill('Needs owner');
    await page.getByTestId('action-0-value').blur();

    await page.getByTestId('rule-add-action').selectOption('message');
    await page.getByTestId('action-1-kind').selectOption('warning');
    await page
      .getByTestId('action-1-text')
      .fill(`= 'Task "' + Name + '" is high priority but has no owner.'`);
    await page.getByTestId('action-1-text').blur();
    await expect(page.getByTestId('rule-saved')).toBeVisible();
    await expect(page.getByTestId('rule-error')).toHaveCount(0);

    // A model with the tool.
    await page.getByTestId('build-back').click();
    await page.getByTestId('mode-model').click();
    await page.getByTestId('new-model').click();
    await page
      .getByTestId('new-model-kit')
      .selectOption({ label: 'Task tracker (0.1.0)' });
    await page.getByTestId('new-model-name').fill('Plan');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-view')).toBeVisible();

    await page.getByTestId('palette-class-Task').click();
    const at = await canvasPoint(page, 200, 200);
    await page.mouse.click(at.x, at.y);
    await page.mouse.click(at.x, at.y);
    const panel = page.getByTestId('attribute-panel');
    const name = panel.getByTestId('field-Name').locator('input');
    await name.fill('Pack the goods');
    await name.press('Enter');

    // Priority High with no owner: the rule sets the status and warns.
    await panel
      .getByTestId('field-Priority')
      .getByRole('radio', { name: 'High' })
      .click();
    await expect(
      panel.getByTestId('field-Status').locator('input'),
    ).toHaveValue('Needs owner');
    await expect(page.getByTestId('behaviour-message')).toContainText(
      'Task "Pack the goods" is high priority but has no owner.',
    );
  });
});
