import { expect, test, type Page } from '@playwright/test';
import { canvasPoint } from './app';

/** A bare workspace and a new tool library in Build mode. */
async function newTool(page: Page, name: string) {
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
  await page.getByTestId('mode-build').click();
  await page.getByTestId('new-tool').click();
  await page.getByTestId('new-tool-name').fill(name);
  await page.getByTestId('new-tool-create').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

async function addItem(page: Page, tab: string, name: string) {
  await page.getByTestId(`build-tab-${tab}`).click();
  await page.getByTestId('build-new-name').fill(name);
  await page.getByTestId('build-add').click();
}

async function addChoice(page: Page, key: string, options: string[]) {
  await page.getByTestId('attr-new-type').selectOption('choice');
  await page.getByTestId('attr-add').click();
  const field = page.getByTestId('attr-key');
  await field.fill(key);
  await field.press('Enter');
  await expect(page.getByTestId(`attr-${key}`)).toBeVisible();
  await page.getByTestId('attr-options').fill(options.join('\n'));
  await page.getByTestId('attr-options').press('Tab');
}

/** Opens the "More ways to set the look" list if it is closed. */
async function openMore(page: Page) {
  const more = page.getByTestId('appearance-more');
  if (!(await more.evaluate((el) => (el as HTMLDetailsElement).open)))
    await more.locator('summary').click();
}

/** Sets a colour control by typing its hex code. */
async function setColour(page: Page, testid: string, hex: string) {
  const input = page.getByTestId(testid);
  await input.fill(hex);
  await input.press('Tab');
}

/** How many pixels of exactly this colour the model canvas shows. */
const countColour = (page: Page, hex: string) =>
  page.getByTestId('canvas-host').evaluate((host, wanted) => {
    const [r, g, b] = [1, 3, 5].map((i) =>
      parseInt(wanted.slice(i, i + 2), 16),
    );
    let n = 0;
    for (const canvas of host.querySelectorAll('canvas')) {
      const ctx = canvas.getContext('2d');
      if (!ctx || canvas.width === 0 || canvas.height === 0) continue;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] === r && d[i + 1] === g && d[i + 2] === b && d[i + 3] === 255)
          n++;
    }
    return n;
  }, hex);

test('a first-time builder makes the Task look without a formula or a layer', async ({
  page,
}, info) => {
  await newTool(page, 'Pipeline');
  await addItem(page, 'classes', 'Task');
  await addChoice(page, 'Status', ['Planned', 'Done', 'Failed']);
  await addChoice(page, 'Priority', ['Low', 'High']);

  // A new class already has a good look.
  await expect(page.getByTestId('appearance-card')).toBeVisible();
  await expect(page.getByTestId('appearance-kind')).toHaveText('Rounded box');
  await page.getByTestId('class-edit-appearance').click();
  await expect(page.getByTestId('appearance-editor')).toBeVisible();

  // The form gallery: every item is a button that says whether it is chosen.
  const rounded = page.getByTestId('base-rounded');
  await expect(rounded).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('base-circle')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.locator('[data-testid^="base-"]')).toHaveCount(11);
  await page.getByTestId('base-circle').click();
  await expect(page.getByTestId('base-circle')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await rounded.click();
  await expect(rounded).toHaveAttribute('aria-pressed', 'true');

  // The fill follows Status: Done green, Failed red.
  await page.getByTestId('rule-fill-attr').selectOption('Status');
  await setColour(page, 'rule-fill-value-Done', '#2f9e44');
  await setColour(page, 'rule-fill-value-Failed', '#e03131');

  // Title is the name of the object, the subtitle shows Status.
  await expect(page.getByTestId('look-title')).toHaveValue('__label');
  await page.getByTestId('look-subtitle').selectOption('Status');

  // A mark when Priority is High, in purple so that it cannot be mistaken for the red fill.
  await page.getByTestId('badge-on').check();
  await page.getByTestId('badge-attr').selectOption('Priority');
  await page.getByTestId('badge-value').selectOption('High');
  await setColour(page, 'badge-colour', '#9c36b5');

  // The preview shows every state: three for Status, two for Priority.
  await expect(page.getByTestId('appearance-tile')).toHaveCount(5);
  await expect(page.getByTestId('appearance-tiles')).toContainText('Planned');
  await expect(page.getByTestId('appearance-tiles')).toContainText('Failed');
  await expect(page.getByTestId('appearance-messages')).toHaveCount(0);

  await info.attach('editor-light.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.screenshot({ path: info.outputPath('editor-light.png') });

  await page.emulateMedia({ colorScheme: 'dark' });
  const bg = await page
    .getByTestId('appearance-editor')
    .evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor);
  expect(bg).not.toBe('rgb(244, 245, 248)');
  await page.screenshot({ path: info.outputPath('editor-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });

  await page.getByTestId('appearance-done').click();
  await expect(page.getByTestId('appearance-editor')).toHaveCount(0);

  // The card shows the look; it was a simple look, never hand drawn.
  await expect(page.getByTestId('appearance-drawn')).toHaveCount(0);

  // A model of this tool: a Task with Status Done draws green, and the mark follows Priority.
  await addItem(page, 'modelTypes', 'Pipeline map');
  await page.getByTestId('mt-class-Task').check();
  await page.getByTestId('build-back').click();
  await page.getByTestId('mode-model').click();
  await page.getByTestId('new-model').click();
  await page
    .getByTestId('new-model-tool')
    .selectOption({ label: 'Pipeline (0.1.0)' });
  await page.getByTestId('new-model-name').fill('Run 1');
  await page.getByTestId('new-model-create').click();
  await expect(page.getByTestId('model-view')).toBeVisible();

  await page.getByTestId('palette-class-Task').click();
  const p = await canvasPoint(page, 300, 200);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('field-Status')).toBeVisible();

  await page
    .getByTestId('field-Status')
    .getByRole('radio', { name: 'Done' })
    .click();
  await page
    .getByTestId('field-Priority')
    .getByRole('radio', { name: 'Low' })
    .click();
  await expect.poll(() => countColour(page, '#2f9e44')).toBeGreaterThan(2000);
  expect(await countColour(page, '#9c36b5')).toBe(0);

  await page
    .getByTestId('field-Priority')
    .getByRole('radio', { name: 'High' })
    .click();
  await expect.poll(() => countColour(page, '#9c36b5')).toBeGreaterThan(100);

  await page
    .getByTestId('field-Status')
    .getByRole('radio', { name: 'Failed' })
    .click();
  await expect.poll(() => countColour(page, '#e03131')).toBeGreaterThan(2000);
  await expect.poll(() => countColour(page, '#2f9e44')).toBe(0);
  await page.screenshot({ path: info.outputPath('model.png') });
});

test('a relation gets a dashed line with a triangle end, and it can be undone', async ({
  page,
}, info) => {
  await newTool(page, 'Relations');
  await addItem(page, 'classes', 'Task');
  await addItem(page, 'relations', 'Performs');
  await page.getByTestId('relation-from-Task').check();
  await page.getByTestId('relation-to-Task').check();

  await expect(page.getByTestId('appearance-card')).toBeVisible();
  await page.getByTestId('relation-edit-appearance').click();
  await expect(page.getByTestId('relation-appearance-editor')).toBeVisible();

  await page.getByTestId('line-style-dashed').click();
  await expect(page.getByTestId('line-style-dashed')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByTestId('line-end-triangle').click();
  await page.getByTestId('line-route-straight').click();
  await setColour(page, 'line-colour', '#1c7ed6');
  await page.screenshot({ path: info.outputPath('line-light.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: info.outputPath('line-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByTestId('appearance-done').click();

  // The card shows a simple look, and the editor opens again with the same choices.
  await expect(page.getByTestId('appearance-drawn')).toHaveCount(0);
  await page.getByTestId('relation-edit-appearance').click();
  await expect(page.getByTestId('line-style-dashed')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('line-end-triangle')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('line-route-straight')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('line-colour')).toHaveValue('#1c7ed6');
  await page.getByTestId('appearance-done').click();

  // The Shapes list says which shapes are simple looks.
  await page.getByTestId('build-tab-shapes').click();
  await expect(page.locator('[data-testid^="shape-kind-"]')).toHaveText([
    'Simple look',
    'Simple look',
  ]);

  // The Build undo covers the editor: undo the colour, then reopen to see the earlier look.
  await page.getByTestId('build-undo').click();
  await page.getByTestId('build-tab-relations').click();
  await page.getByTestId('build-item-Performs').click();
  await page.getByTestId('relation-edit-appearance').click();
  await expect(page.getByTestId('line-colour')).not.toHaveValue('#1c7ed6');
  await expect(page.getByTestId('line-end-triangle')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a hand-drawn look can be replaced, and a simple look asks before it is edited as a drawing', async ({
  page,
}) => {
  await newTool(page, 'Drawn');
  await addItem(page, 'classes', 'Task');
  // "New drawn shape" is an advanced choice under "More ways to set the look".
  await openMore(page);
  await page.getByTestId('class-new-shape').click();
  await expect(page.getByTestId('shape-editor')).toBeVisible();
  await expect(page.getByTestId('shape-editor-title')).toHaveText(
    'Advanced drawing editor',
  );
  await page.getByTestId('shape-close').click();

  await expect(page.getByTestId('appearance-drawn')).toHaveText(
    'This look was drawn by hand.',
  );
  await expect(page.getByTestId('class-edit-appearance')).toHaveCount(0);

  // Replace with a simple look: it happens at once, with Undo in the toast, and the simple
  // editor opens.
  await page.getByTestId('class-replace-look').click();
  await expect(page.getByTestId('message')).toContainText(
    'Replaced the drawing',
  );
  await expect(page.getByTestId('toast-undo')).toBeVisible();
  await expect(page.getByTestId('appearance-editor')).toBeVisible();
  await page.getByTestId('appearance-done').click();
  await expect(page.getByTestId('appearance-drawn')).toHaveCount(0);
  await expect(page.getByTestId('appearance-kind')).toHaveText('Rounded box');

  // Editing as a drawing asks first; Cancel keeps the look.
  await openMore(page);
  await page.getByTestId('class-edit-shape').click();
  await expect(page.getByTestId('confirm-dialog')).toContainText(
    'turns the look into a hand-drawn one',
  );
  await page.getByTestId('confirm-cancel').click();
  await expect(page.getByTestId('shape-editor')).toHaveCount(0);
  await expect(page.getByTestId('appearance-kind')).toHaveText('Rounded box');

  // Going ahead opens the advanced editor and the look becomes hand drawn.
  await page.getByTestId('class-edit-shape').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('shape-editor')).toBeVisible();
  await page.getByTestId('shape-add-rect').click();
  await page.getByTestId('shape-close').click();
  await expect(page.getByTestId('appearance-drawn')).toBeVisible();

  // The undo of Build mode brings the simple look back, one step at a time.
  for (let i = 0; i < 4; i++) {
    if ((await page.getByTestId('appearance-drawn').count()) === 0) break;
    await page.getByTestId('build-undo').click();
  }
  await expect(page.getByTestId('appearance-drawn')).toHaveCount(0);
  await expect(page.getByTestId('appearance-kind')).toHaveText('Rounded box');
});

test('renaming an attribute keeps the look working', async ({ page }) => {
  await newTool(page, 'Rename');
  await addItem(page, 'classes', 'Task');
  await addChoice(page, 'Status', ['Planned', 'Done']);
  await page.getByTestId('class-edit-appearance').click();
  await page.getByTestId('rule-fill-attr').selectOption('Status');
  await page.getByTestId('look-subtitle').selectOption('Status');
  await page.getByTestId('appearance-done').click();

  const row = page.getByTestId('attr-Status');
  if ((await row.getAttribute('aria-expanded')) !== 'true') await row.click();
  const key = page.getByTestId('attr-key');
  await key.fill('State');
  await key.press('Enter');
  await expect(page.getByTestId('attr-State')).toBeVisible();

  await page.getByTestId('class-edit-appearance').click();
  await expect(page.getByTestId('rule-fill-attr')).toHaveValue('State');
  await expect(page.getByTestId('look-subtitle')).toHaveValue('State');
  await expect(page.getByTestId('appearance-messages')).toHaveCount(0);
});

test('the editor can be used with the keyboard', async ({ page }) => {
  await newTool(page, 'Keys');
  await addItem(page, 'classes', 'Task');
  await page.getByTestId('class-edit-appearance').click();
  await expect(page.getByTestId('appearance-editor')).toBeVisible();

  // The gallery is reached before the controls, and a gallery item is a toggle button.
  await page.getByTestId('base-rounded').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('base-box')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('base-box')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('base-rounded')).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // The colour palette opens from the swatch and closes with Escape; Escape again leaves.
  await page.getByTestId('look-fill-swatch').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('look-fill-pal-Green')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('look-fill-pal-Green')).toHaveCount(0);
  await expect(page.getByTestId('appearance-editor')).toBeVisible();
  await page.getByTestId('look-fill-swatch').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('look-fill-pal-Green').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('look-fill')).toHaveValue('#b2f2bb');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('appearance-editor')).toHaveCount(0);
});
