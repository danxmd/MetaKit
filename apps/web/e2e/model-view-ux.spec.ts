import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canvasPoint, newModel, prepare } from './app';
import { loadHarness } from './bundle';
import { chooseFromMenu, openMenu } from './menus';

const pipeline = (path: string) =>
  fileURLToPath(
    new URL(`../../../kits/agent-pipeline/${path}`, import.meta.url),
  );

/** Opens the sample code review pipeline, which has commands, help texts and several relations. */
async function openPipeline(page: Page) {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await loadHarness(page, './seed-harness.ts');
  await page.evaluate(
    (json) =>
      (window as unknown as { __seed(t: string): Promise<void> }).__seed(json),
    readFileSync(pipeline('kit.json'), 'utf8'),
  );
  await page.reload();
  await page.getByTestId('open-folder').click();
  await page
    .locator('input[type="file"][aria-label="Files to import"]')
    .setInputFiles(pipeline('code-review.mkmodel.json'));
  await expect(page.getByTestId('import-note')).toBeVisible();
  await page
    .getByRole('tree')
    .getByRole('button', { name: 'Code review pipeline' })
    .click();
  await expect(page.getByTestId('model-view')).toBeVisible();
}

test.describe('the toolbar menus', () => {
  test('each menu opens and lists its commands', async ({ page }) => {
    await openPipeline(page);
    const header = page.getByTestId('model-header');

    let menu = await openMenu(page, 'File');
    await expect(menu.getByTestId('export-open')).toBeVisible();

    menu = await openMenu(page, 'Edit');
    // Opening another menu closes the first.
    await expect(header.locator('details.menu[open]')).toHaveCount(1);
    for (const name of ['Undo', 'Redo', 'Find', 'Select all'])
      await expect(menu.getByRole('button', { name })).toBeVisible();

    menu = await openMenu(page, 'View');
    await expect(
      menu.getByRole('button', { name: 'Fit to window' }),
    ).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(menu.getByTestId('minimap-toggle')).toBeVisible();

    menu = await openMenu(page, 'Arrange');
    await expect(
      menu.getByRole('button', { name: 'Align left' }),
    ).toBeDisabled();
    await expect(menu.getByTestId('auto-layout')).toBeEnabled();

    menu = await openMenu(page, 'Check');
    await expect(menu.getByTestId('problems-toggle')).toBeVisible();

    menu = await openMenu(page, 'Commands');
    await expect(
      menu.getByRole('button', { name: 'Check pipeline' }),
    ).toBeVisible();

    // The quick buttons stay on the bar, with names for screen readers.
    for (const name of ['Undo', 'Redo', 'Zoom in', 'Zoom out', 'Fit to window'])
      await expect(header.getByRole('button', { name })).toBeVisible();
    await expect(page.getByTestId('back-to-explorer')).toBeVisible();
    await expect(page.getByTestId('model-name')).toHaveText(
      'Code review pipeline',
    );
  });

  test('choosing an item closes the menu, and Escape closes it too', async ({
    page,
  }) => {
    await openPipeline(page);
    await chooseFromMenu(page, 'Check', 'problems-toggle');
    await expect(
      page.getByTestId('model-header').locator('details.menu[open]'),
    ).toHaveCount(0);
    // The problems list is docked below the canvas, not floating over it.
    const dock = page.getByTestId('problems-panel');
    await expect(dock).toBeVisible();
    const canvas = (await page.getByTestId('canvas-host').boundingBox())!;
    const panel = (await dock.boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);

    await openMenu(page, 'Edit');
    await page.keyboard.press('Escape');
    await expect(
      page.getByTestId('model-header').locator('details.menu[open]'),
    ).toHaveCount(0);
  });

  test('the minimap can be hidden from the View menu', async ({ page }) => {
    await openPipeline(page);
    await expect(page.getByTestId('minimap')).toBeVisible();
    await chooseFromMenu(page, 'View', 'minimap-toggle');
    await expect(page.getByTestId('minimap')).toBeHidden();
    await chooseFromMenu(page, 'View', 'minimap-toggle');
    await expect(page.getByTestId('minimap')).toBeVisible();
  });
});

test.describe('the palette preview', () => {
  test('shows a class with its help, attributes and kind, and goes away again', async ({
    page,
  }) => {
    await openPipeline(page);
    const card = page.getByTestId('palette-preview');
    await expect(card).toHaveCount(0);

    await page.getByTestId('palette-class-Agent').hover();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-kind', 'object');
    await expect(card.getByRole('heading', { name: 'Agent' })).toBeVisible();
    await expect(page.getByTestId('palette-preview-kind')).toHaveText('Object');
    await expect(page.getByTestId('palette-preview-help')).toContainText(
      'Anyone or anything that does work',
    );
    const attributes = page.getByTestId('palette-preview-attributes');
    await expect(attributes).toContainText('Name');
    await expect(attributes).toContainText('Autonomy');
    await expect(attributes.locator('.req')).toHaveCount(1);
    // The card draws the shape on a canvas.
    await expect(card.locator('canvas')).toHaveCount(1);

    await page.mouse.move(700, 500);
    await expect(card).toHaveCount(0);
  });

  test('shows a relation with the classes it joins', async ({ page }) => {
    await openPipeline(page);
    await page.getByTestId('palette-relation-Performs').hover();
    const card = page.getByTestId('palette-preview');
    await expect(card).toHaveAttribute('data-kind', 'relation');
    await expect(page.getByTestId('palette-preview-kind')).toHaveText(
      'Relation',
    );
    await expect(page.getByTestId('palette-preview-ends')).toHaveText(
      'Performs: from Actor to Task',
    );
    await page.mouse.move(700, 500);
    await expect(card).toHaveCount(0);
  });

  test('also appears on keyboard focus and never blocks a click', async ({
    page,
  }) => {
    await openPipeline(page);
    await page.getByTestId('palette-class-Task').focus();
    await expect(page.getByTestId('palette-preview')).toBeVisible();
    await page.getByTestId('palette-class-Task').blur();
    await expect(page.getByTestId('palette-preview')).toHaveCount(0);

    // Hover the entry, then click it: the card does not take the click.
    await page.getByTestId('palette-class-Gate').hover();
    await expect(page.getByTestId('palette-preview')).toBeVisible();
    await page.getByTestId('palette-class-Gate').click();
    await expect(page.getByTestId('palette-class-Gate')).toHaveClass(/\bon\b/);
  });

  test('works with the BPMN lite Kit and gives every entry a thumbnail', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    const entries = page.locator(
      '[data-testid^="palette-class-"], [data-testid^="palette-relation-"]',
    );
    expect(await entries.count()).toBeGreaterThan(2);
    for (const entry of await entries.all())
      await expect(entry.locator('canvas')).toHaveCount(1);
    await page.getByTestId('palette-class-Task').hover();
    await expect(page.getByTestId('palette-preview')).toBeVisible();
    await expect(page.getByTestId('palette-preview-attributes')).toBeVisible();
    await page.getByTestId('palette-relation-SequenceFlow').hover();
    await expect(page.getByTestId('palette-preview-ends')).toContainText(
      'from',
    );
  });
});

test.describe('the dark theme', () => {
  /** The colour behind the grid, as the browser computes it. */
  const surface = (page: Page) =>
    page
      .getByTestId('canvas-host')
      .locator('> div[style*="overflow: hidden"]')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  const brightness = (css: string) => {
    const [r, g, b] = css.match(/\d+/g)!.map(Number);
    return (r! + g! + b!) / 3;
  };

  test('the canvas background follows the theme and changes while open', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await prepare(page);
    await newModel(page);
    const light = await surface(page);
    expect(brightness(light)).toBeGreaterThan(200);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect
      .poll(async () => brightness(await surface(page)))
      .toBeLessThan(60);
    expect(await surface(page)).not.toBe(light);

    // The minimap follows too.
    const minimap = await page
      .getByTestId('minimap')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(brightness(minimap)).toBeLessThan(60);
  });
});

type Meta = {
  editor: {
    placeAt(cls: string, at: { x: number; y: number }): string | null;
    activeTool: { type: string };
  };
  view: {
    active: { hover: string | null };
    view: { s: number; ox: number; oy: number };
  };
};

const meta = <T>(page: Page, fn: (m: Meta) => T) =>
  page.evaluate(`(${fn.toString()})(window.__metakit)`) as Promise<T>;

/** A task and a lane (which no sequence flow may touch) on the canvas; returns where they are. */
async function twoKinds(page: Page) {
  await prepare(page);
  await newModel(page);
  const ids = await meta(page, (m) => ({
    task: m.editor.placeAt('cls_task', { x: 150, y: 120 }),
    other: m.editor.placeAt('cls_task', { x: 450, y: 120 }),
    lane: m.editor.placeAt('cls_lane', { x: 300, y: 330 }),
  }));
  await page.getByTestId('tool-select').click();
  const at = async (x: number, y: number) => {
    const s = await meta(page, (m) => m.view.view);
    return canvasPoint(page, x * s.s + s.ox, y * s.s + s.oy);
  };
  return { ids, at };
}

test.describe('connecting and placing', () => {
  test('the elements a relation fits are outlined under the pointer', async ({
    page,
  }) => {
    const { ids, at } = await twoKinds(page);
    await page.getByTestId('palette-relation-SequenceFlow').click();

    // Before the first click: a task can start a sequence flow, a lane cannot.
    let p = await at(150, 120);
    await page.mouse.move(p.x, p.y);
    await expect
      .poll(() => meta(page, (m) => m.view.active.hover))
      .toBe(ids.task);
    p = await at(300, 330);
    await page.mouse.move(p.x, p.y);
    await expect.poll(() => meta(page, (m) => m.view.active.hover)).toBe(null);

    // After picking the first element, only fitting ends are outlined.
    p = await at(150, 120);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    p = await at(450, 120);
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await expect
      .poll(() => meta(page, (m) => m.view.active.hover))
      .toBe(ids.other);
    p = await at(300, 330);
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await expect.poll(() => meta(page, (m) => m.view.active.hover)).toBe(null);
    await page.mouse.up();
  });

  for (const choose of [
    'palette-class-Task',
    'palette-relation-SequenceFlow',
  ]) {
    test(`a right-click leaves the mode after ${choose}`, async ({ page }) => {
      const { at } = await twoKinds(page);
      await page.getByTestId(choose).click();
      await expect(page.getByTestId(choose)).toHaveClass(/\bon\b/);
      const p = await at(300, 250);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      expect(await meta(page, (m) => m.editor.activeTool.type)).toBe('select');
      await expect(page.getByTestId(choose)).not.toHaveClass(/\bon\b/);
      await expect(page.getByTestId('tool-select')).toHaveClass(/\bon\b/);
      await expect(page.getByTestId('context-menu')).toHaveCount(0);
    });
  }

  test('Escape leaves the mode too', async ({ page }) => {
    await twoKinds(page);
    await page.getByTestId('palette-relation-SequenceFlow').click();
    await page.keyboard.press('Escape');
    expect(await meta(page, (m) => m.editor.activeTool.type)).toBe('select');
    await expect(
      page.getByTestId('palette-relation-SequenceFlow'),
    ).not.toHaveClass(/\bon\b/);
  });
});
