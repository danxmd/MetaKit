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
    for (const kind of ['model-file', 'bundle', 'csv'])
      await expect(menu.getByTestId(`file-export-${kind}`)).toBeVisible();

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
    // So is Export, a menu of its own.
    menu = await openMenu(page, 'Export');
    for (const kind of ['image', 'model-file', 'bundle', 'csv'])
      await expect(menu.getByTestId(`model-export-${kind}`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('crumb-area')).toBeVisible();
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

  test('the palette and the attribute panel hide separately from the View menu', async ({
    page,
  }) => {
    await openPipeline(page);
    const canvasWidth = async () =>
      (await page.getByTestId('canvas-host').boundingBox())!.width;
    const full = await canvasWidth();

    await chooseFromMenu(page, 'View', 'palette-toggle');
    await expect(page.getByTestId('palette')).toHaveCount(0);
    await expect(page.getByTestId('attribute-panel')).toBeVisible();
    await expect(page.getByTestId('show-palette')).toBeVisible();
    // The canvas follows the freed space.
    await expect.poll(canvasWidth).toBeGreaterThan(full + 150);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { view } = (
            window as unknown as { __metakit: { view: { width: number } } }
          ).__metakit;
          return view.width;
        }),
      )
      .toBeGreaterThan(full + 150);
    let menu = await openMenu(page, 'View');
    await expect(menu.getByTestId('palette-toggle')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(menu.getByTestId('attributes-toggle')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('Escape');

    await chooseFromMenu(page, 'View', 'attributes-toggle');
    await expect(page.getByTestId('attribute-panel')).toHaveCount(0);
    await expect(page.getByTestId('show-attributes')).toBeVisible();
    const both = await canvasWidth();
    expect(both).toBeGreaterThan(full + 400);

    await chooseFromMenu(page, 'View', 'palette-toggle');
    await expect(page.getByTestId('palette')).toBeVisible();
    await expect(page.getByTestId('attribute-panel')).toHaveCount(0);
    menu = await openMenu(page, 'View');
    await expect(menu.getByTestId('palette-toggle')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await menu.getByTestId('attributes-toggle').click();
    await expect(page.getByTestId('attribute-panel')).toBeVisible();
  });

  test('the side bars close with × and come back from their edge, and stay as left after a reload', async ({
    page,
  }) => {
    await openPipeline(page);
    await page.getByRole('button', { name: 'Hide palette' }).click();
    await page.getByRole('button', { name: 'Hide attribute panel' }).click();
    await expect(page.getByTestId('palette')).toHaveCount(0);
    await expect(page.getByTestId('attribute-panel')).toHaveCount(0);

    // Selecting an object does not bring the panel back.
    await page.evaluate(() => {
      const { editor, store } = (
        window as unknown as {
          __metakit: {
            editor: { select(ids: string[]): void };
            store: { state: { elements: Record<string, unknown> } };
          };
        }
      ).__metakit;
      editor.select([Object.keys(store.state.elements)[0]!]);
    });
    await expect(page.getByTestId('attribute-panel')).toHaveCount(0);

    await page.reload();
    await page.getByTestId('open-folder').click();
    await page
      .getByRole('tree')
      .getByRole('button', { name: 'Code review pipeline' })
      .click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    await expect(page.getByTestId('palette')).toHaveCount(0);
    await expect(page.getByTestId('attribute-panel')).toHaveCount(0);

    await page.getByRole('button', { name: 'Show palette' }).click();
    await expect(page.getByTestId('palette')).toBeVisible();
    await page.getByRole('button', { name: 'Show attribute panel' }).click();
    await expect(page.getByTestId('attribute-panel')).toBeVisible();
    await expect(page.getByTestId('show-palette')).toHaveCount(0);
  });

  test('Fit to window right after opening shows the whole model, left side included', async ({
    page,
  }) => {
    // This sample model has objects at a negative x.
    const portfolio = (path: string) =>
      fileURLToPath(
        new URL(`../../../kits/ai-use-case-portfolio/${path}`, import.meta.url),
      );
    await prepare(page, {
      seed: true,
      kit: readFileSync(portfolio('kit.json'), 'utf8'),
    });
    await page.getByTestId('open-folder').click();
    await page
      .locator('input[type="file"][aria-label="Files to import"]')
      .setInputFiles(portfolio('customer-operations.mkmodel.json'));
    await expect(page.getByTestId('import-note')).toBeVisible();
    await page
      .getByRole('tree')
      .getByRole('button', { name: 'Customer operations AI portfolio' })
      .click();
    // No waiting for the canvas: the button is pressed as soon as it can be.
    await page
      .getByTestId('model-header')
      .getByRole('button', { name: 'Fit to window' })
      .click();
    const placed = await page.evaluate(() => {
      const { view, scene } = (
        window as unknown as {
          __metakit: {
            view: {
              view: { s: number; ox: number; oy: number };
              width: number;
            };
            scene: { bounds(): { minX: number; maxX: number } };
          };
        }
      ).__metakit;
      const b = scene.bounds();
      const { s, ox } = view.view;
      return {
        left: b.minX * s + ox,
        right: b.maxX * s + ox,
        width: view.width,
      };
    });
    const host = (await page.getByTestId('canvas-host').boundingBox())!;
    expect(placed.width).toBeCloseTo(host.width, 0);
    expect(placed.left).toBeGreaterThanOrEqual(0);
    expect(placed.right).toBeLessThanOrEqual(host.width);
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
    // The Kit allows the abstract Actor; the card names the classes that can be placed.
    await expect(page.getByTestId('palette-preview-ends')).toHaveText(
      'Connects an Agent or a Human to a Task.',
    );
    await expect(page.getByTestId('palette-preview-from')).toHaveCount(0);
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
    await expect(page.getByTestId('palette-preview-ends')).toHaveText(
      'Connects an End event, a Gateway, a Start event or a Task to an End event, a Gateway, a Start event or a Task.',
    );
    // A long sentence also comes as two lists.
    await expect(page.getByTestId('palette-preview-from')).toHaveText(
      'End event, Gateway, Start event, Task',
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

    test(`a right drag pans and keeps the mode after ${choose}`, async ({
      page,
    }) => {
      const { at } = await twoKinds(page);
      await page.getByTestId(choose).click();
      const p = await at(300, 250);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(p.x + 70, p.y + 30, { steps: 5 });
      await page.mouse.up({ button: 'right' });
      expect(await meta(page, (m) => m.editor.activeTool.type)).not.toBe(
        'select',
      );
      await expect(page.getByTestId(choose)).toHaveClass(/\bon\b/);
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

test.describe('exporting from the model view', () => {
  /** Renames the task "Implement" through a command, as the panel would, and returns at once. */
  async function editRightBeforeExport(page: Page) {
    await page.evaluate(() => {
      const { store } = (
        window as unknown as {
          __metakit: {
            store: {
              state: {
                elements: Record<string, { attrs: Record<string, unknown> }>;
              };
              execute(command: unknown): void;
            };
          };
        }
      ).__metakit;
      for (const [id, element] of Object.entries(store.state.elements))
        for (const [attr, value] of Object.entries(element.attrs))
          if (value === 'Implement') {
            store.execute({
              type: 'setAttribute',
              target: id,
              attr,
              value: 'Implement the change',
            });
            return;
          }
      throw new Error('No task called Implement');
    });
  }

  async function download(page: Page, menu: 'Export' | 'File', id: string) {
    const opened = await openMenu(page, menu);
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      opened.getByTestId(id).click(),
    ]);
    return {
      name: file.suggestedFilename(),
      bytes: readFileSync((await file.path())!),
    };
  }

  test('the Export button opens the image dialog', async ({ page }) => {
    await openPipeline(page);
    await chooseFromMenu(page, 'Export', 'model-export-image');
    await expect(page.getByTestId('export-dialog')).toBeVisible();
  });

  test('the model file has an edit made just before exporting', async ({
    page,
  }) => {
    await openPipeline(page);
    await editRightBeforeExport(page);
    const file = await download(page, 'Export', 'model-export-model-file');
    expect(file.name).toBe('code-review-pipeline.mkmodel.json');
    expect(file.bytes.toString('utf8')).toContain('Implement the change');
    await expect(page.getByTestId('message')).toContainText(
      'Exported the model file.',
    );
  });

  test('the bundle and the CSV files download, also from the File menu', async ({
    page,
  }) => {
    await openPipeline(page);
    await editRightBeforeExport(page);
    const bundle = await download(page, 'Export', 'model-export-bundle');
    expect(bundle.name).toBe('code-review-pipeline.mkbundle');
    // A zip file.
    expect(bundle.bytes.subarray(0, 2).toString('latin1')).toBe('PK');
    await expect(page.getByTestId('message')).toContainText(
      'Exported the bundle',
    );

    const csv = await download(page, 'Export', 'model-export-csv');
    expect(csv.name).toMatch(/^code-review-pipeline.*\.csv\.zip$/);
    expect(csv.bytes.subarray(0, 2).toString('latin1')).toBe('PK');

    const again = await download(page, 'File', 'file-export-model-file');
    expect(again.name).toBe('code-review-pipeline.mkmodel.json');
    expect(again.bytes.toString('utf8')).toContain('Implement the change');
  });
});
