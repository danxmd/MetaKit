import { expect, test, type Locator, type Page } from '@playwright/test';

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
  await page.getByTestId('new-tool').click();
  await page.getByTestId('new-tool-name').fill(name);
  await page.getByTestId('new-tool-create').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

async function addClass(page: Page, name: string) {
  await page.getByTestId('build-tab-classes').click();
  await page.getByTestId('build-new-name').fill(name);
  await page.getByTestId('build-add').click();
  await expect(page.getByTestId('class-editor')).toBeVisible();
}

async function addAttribute(page: Page, type: string, key: string) {
  await page.getByTestId('attr-new-type').selectOption(type);
  await page.getByTestId('attr-add').click();
  const field = page.getByTestId('attr-key');
  await field.fill(key);
  await field.press('Enter');
  await expect(page.getByTestId(`attr-${key}`)).toBeVisible();
}

/** The colour of one pixel of a canvas, as `#rrggbbaa`. */
const pixel = (canvas: Locator, x: number, y: number) =>
  canvas.evaluate(
    (el, [px, py]) => {
      const d = (el as HTMLCanvasElement)
        .getContext('2d')!
        .getImageData(px!, py!, 1, 1).data;
      return `#${[...d].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    },
    [x, y] as const,
  );

test('the task shape of the plan can be built with editor actions only', async ({
  page,
}) => {
  await newTool(page, 'Shapes');
  await addClass(page, 'Task');
  await addAttribute(page, 'text', 'Name');
  await addAttribute(page, 'choice', 'Priority');
  await page.getByTestId('attr-options').fill('High\nMedium\nLow');
  await page.getByTestId('attr-options').press('Tab');
  await addAttribute(page, 'number', 'Effort');

  // A new shape starts as a copy of a starter and opens in the editor.
  await page.getByTestId('class-new-shape').click();
  await expect(page.getByTestId('shape-editor')).toBeVisible();

  // The starter has a box and a label: make the box white with a 2 px border.
  await page.getByTestId('shape-layer-0').click();
  const box = page.getByTestId('shape-properties');
  // The starter fills with the class colour, a formula: switch it to a fixed colour.
  await box.getByTestId('shape-fx-fill').click();
  await box.getByTestId('shape-prop-fill').fill('#ffffff');
  await box.getByTestId('shape-prop-fill').press('Tab');
  await box.getByTestId('shape-prop-strokeWidth').fill('2');
  await box.getByTestId('shape-prop-strokeWidth').press('Tab');
  await box.getByTestId('shape-prop-radius').fill('10');
  await box.getByTestId('shape-prop-radius').press('Tab');

  // Colour the border by Priority without typing a formula.
  await page.getByTestId('shape-colour-open-stroke').click();
  await page.getByTestId('shape-colour-attribute').selectOption('Priority');
  await page.getByTestId('shape-colour-value-High').fill('#D93025');
  await page.getByTestId('shape-colour-value-Medium').fill('#F29900');
  await page.getByTestId('shape-colour-value-Low').fill('#5F6368');
  await page.getByTestId('shape-colour-fallback').fill('#5F6368');
  await page.getByTestId('shape-colour-apply').click();

  // An accent bar at the left edge in the same colours.
  await page.getByTestId('shape-add-rect').click();
  const bar = page.getByTestId('shape-properties');
  await bar.getByTestId('shape-prop-x').fill('0');
  await bar.getByTestId('shape-prop-y').fill('0');
  await bar.getByTestId('shape-prop-width').fill('6');
  await bar.getByTestId('shape-prop-width').press('Tab');
  await bar.getByTestId('shape-prop-height').fill('70');
  await bar.getByTestId('shape-prop-height').press('Tab');
  await page.getByTestId('shape-colour-open-fill').click();
  await page.getByTestId('shape-colour-attribute').selectOption('Priority');
  await page.getByTestId('shape-colour-value-High').fill('#D93025');
  await page.getByTestId('shape-colour-value-Medium').fill('#F29900');
  await page.getByTestId('shape-colour-value-Low').fill('#5F6368');
  await page.getByTestId('shape-colour-fallback').fill('#5F6368');
  await page.getByTestId('shape-colour-apply').click();

  // The preview shows Priority High (the first option) at three sizes.
  const preview = page.getByTestId('shape-preview-1');
  await expect(preview).toBeVisible();
  expect(await pixel(preview, 3, 35)).toBe('#d93025ff'); // accent bar
  expect(await pixel(preview, 70, 0)).toBe('#d93025ff'); // top border
  expect(await pixel(preview, 130, 35)).toBe('#ffffffff'); // inside the box
  await expect(page.getByTestId('shape-preview-0.5')).toBeVisible();
  await expect(page.getByTestId('shape-preview-2')).toBeVisible();

  // Another priority changes both at once.
  await page.getByTestId('shape-sample-Priority').selectOption('Low');
  expect(await pixel(preview, 3, 35)).toBe('#5f6368ff');
  expect(await pixel(preview, 70, 0)).toBe('#5f6368ff');

  await page.getByTestId('shape-close').click();
  await expect(page.getByTestId('class-shape')).not.toHaveValue('');
});
