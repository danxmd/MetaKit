import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

const panel = (page: Page) => page.getByTestId('docs-panel');
const context = (page: Page) => expect(panel(page));

/** A fresh workspace with one new tool library open in Build mode. */
async function openNewTool(page: Page, name = 'Docs tool') {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByTestId('mode-build').click();
  await page.getByTestId('new-kit').click();
  await page.getByTestId('new-kit-name').fill(name);
  await page.getByTestId('new-kit-create').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
}

test.describe('Help side bar', () => {
  test('opens on the start page at the topic for it, and closes again', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await expect(panel(page)).toHaveCount(0);
    await page.getByTestId('toggle-help').click();
    await context(page).toHaveAttribute('data-context', 'start');
    await expect(page.getByTestId('docs-title')).toBeVisible();
    await expect(page.getByTestId('toggle-help')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByTestId('docs-close').click();
    await expect(panel(page)).toHaveCount(0);
  });

  test('follows a link and Back returns to the topic before it', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await page.getByTestId('toggle-help').click();
    const reader = page.getByTestId('docs-reader');
    await expect(reader).toBeVisible();
    const first = await reader.getAttribute('data-topic');
    await expect(page.getByTestId('docs-back')).toBeDisabled();
    await reader.locator('a.topic-link').first().click();
    await expect(reader).not.toHaveAttribute('data-topic', first!);
    await expect(page.getByTestId('docs-back')).toBeEnabled();
    await page.getByTestId('docs-back').click();
    await expect(reader).toHaveAttribute('data-topic', first!);
    await expect(page.getByTestId('docs-forward')).toBeEnabled();
    await page.getByTestId('docs-forward').click();
    await expect(reader).not.toHaveAttribute('data-topic', first!);
    // "This page" jumps back to the topic of the page the person is on.
    await page.getByTestId('docs-this-page').click();
    await expect(reader).toHaveAttribute('data-topic', first!);
  });

  test('searches by title, keyword and text, best match first', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await page.getByTestId('toggle-help').click();
    await page.getByTestId('docs-search-input').fill('tutorials');
    const hits = page.getByTestId('docs-search-hit');
    await expect(hits.first()).toHaveAttribute('data-topic', 'tutorials-index');
    await hits.first().click();
    await expect(page.getByTestId('docs-title')).toHaveText('Tutorials');
    // The results go away once a topic is chosen.
    await expect(page.getByTestId('docs-search-results')).toHaveCount(0);
    await page.getByTestId('docs-search-input').fill('zzzzqqq');
    await expect(page.getByTestId('docs-search-empty')).toBeVisible();
    await page.getByTestId('docs-search-input').press('Escape');
    await expect(page.getByTestId('docs-search-results')).toHaveCount(0);
    await expect(panel(page)).toBeVisible();
  });

  test('F1 and ? toggle it, but ? does not while typing', async ({ page }) => {
    await prepare(page);
    await newModel(page);
    await page.keyboard.press('F1');
    await expect(panel(page)).toBeVisible();
    await context(page).toHaveAttribute('data-context', 'model');
    await page.keyboard.press('F1');
    await expect(panel(page)).toHaveCount(0);
    await page.getByTestId('canvas-host').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('?');
    await expect(panel(page)).toBeVisible();
    await page.getByTestId('docs-search-input').focus();
    await page.keyboard.type('what?');
    await expect(panel(page)).toBeVisible();
    await expect(page.getByTestId('docs-search-input')).toHaveValue('what?');
    await page.getByTestId('docs-search-input').press('Escape');
    await page.getByTestId('docs-search-input').press('Escape');
    await expect(panel(page)).toHaveCount(0);
  });

  test('shrinks the page beside it, remembers its width, and covers a narrow window', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    const before = (await page.getByTestId('model-view').boundingBox())!.width;
    await page.getByTestId('toggle-help').click();
    const after = (await page.getByTestId('model-view').boundingBox())!.width;
    const bar = (await panel(page).boundingBox())!;
    expect(bar.width).toBeGreaterThanOrEqual(375);
    expect(Math.round(before - after)).toBeGreaterThanOrEqual(
      Math.round(bar.width) - 2,
    );

    // Dragging the edge makes it wider, never wider than 60% of the window.
    const handle = (await page.getByTestId('docs-resize').boundingBox())!;
    await page.mouse.move(handle.x + 3, handle.y + 200);
    await page.mouse.down();
    await page.mouse.move(handle.x - 150, handle.y + 200, { steps: 5 });
    await page.mouse.up();
    const wider = (await panel(page).boundingBox())!.width;
    expect(wider).toBeGreaterThan(bar.width + 100);
    await page.reload();
    await page.getByTestId('open-folder').click();
    await expect(page.getByTestId('top-bar')).toBeVisible();
    await expect(page.getByTestId('docs-panel')).toBeVisible();
    expect(
      Math.abs((await panel(page).boundingBox())!.width - wider),
    ).toBeLessThan(3);

    await page.setViewportSize({ width: 600, height: 700 });
    await expect(panel(page)).toHaveCSS('position', 'absolute');
    const narrow = (await panel(page).boundingBox())!;
    expect(narrow.x + narrow.width).toBeLessThanOrEqual(600);
  });

  test('follows the page: Build sections, editors and dialogs report their own context', async ({
    page,
  }) => {
    await openNewTool(page);
    await page.keyboard.press('F1');
    await context(page).toHaveAttribute('data-context', 'build.classes');
    for (const [tab, ctx] of [
      ['relations', 'build.relations'],
      ['modelTypes', 'build.modelTypes'],
      ['shapes', 'build.shapes'],
      ['rules', 'build.rules'],
      ['scripts', 'build.scripts'],
      ['settings', 'build.settings'],
      ['classes', 'build.classes'],
    ] as const) {
      await page.getByTestId(`build-tab-${tab}`).click();
      await context(page).toHaveAttribute('data-context', ctx);
    }
    // The "?" next to the section opens the topic of the section.
    await page.getByTestId('build-help').click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveAttribute('data-context', 'build.classes');
  });

  test('a dialog reports its context and gives it back when it closes', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await expect(page.getByTestId('new-model')).toBeVisible();
    await page.keyboard.press('F1');
    await context(page).toHaveAttribute('data-context', 'models');
    await page.getByTestId('new-model').click();
    await context(page).toHaveAttribute('data-context', 'dialog.new-model');
    await page.keyboard.press('Escape');
    await context(page).toHaveAttribute('data-context', 'models');
    await page.getByTestId('mode-build').click();
    await context(page).toHaveAttribute('data-context', 'kits');
  });
});

test.describe('Documentation area', () => {
  test('opens from the top bar and brings back the open model unchanged', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page, 'Kept model');
    // The editor object survives only if the model view is never rebuilt.
    await page.evaluate(() => {
      const w = window as unknown as {
        __metakit: { store: unknown };
        __kept: unknown;
      };
      w.__kept = w.__metakit.store;
    });
    await page.getByTestId('open-docs').click();
    await expect(page.getByTestId('docs-page')).toBeVisible();
    await expect(page.getByTestId('model-view')).toBeHidden();
    await expect(page.getByTestId('open-docs')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByTestId('mode-model')).not.toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.keyboard.press('F1');
    await context(page).toHaveAttribute('data-context', 'docs');

    // Browse: open a group, pick a topic.
    await page.getByTestId('docs-tree-topic').first().click();
    // The side bar is open too (F1), and shows its own reader.
    await expect(
      page.getByTestId('docs-page').getByTestId('docs-reader'),
    ).toBeVisible();

    await page.getByTestId('mode-model').click();
    await expect(page.getByTestId('docs-page')).toBeHidden();
    await expect(page.getByTestId('model-view')).toBeVisible();
    expect(
      await page.evaluate(() => {
        const w = window as unknown as {
          __metakit: { store: unknown };
          __kept: unknown;
        };
        return w.__metakit.store === w.__kept;
      }),
    ).toBe(true);
  });

  test('"Open in Documentation" moves the topic from the side bar to the area', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await page.getByTestId('toggle-help').click();
    await page.getByTestId('docs-search-input').fill('tutorials');
    await page.getByTestId('docs-search-hit').first().click();
    await page.getByTestId('docs-open-area').click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByTestId('docs-page')).toBeVisible();
    await expect(
      page.getByTestId('docs-page').getByTestId('docs-title'),
    ).toHaveText('Tutorials');
  });

  test('lists categories with counts, searches, and lists the written tutorials', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await page.getByTestId('open-docs').click();
    await expect(page.getByTestId('docs-group-start')).toContainText(
      'Getting started',
    );
    // The tutorials of the built-in data and AI tools are written, so the placeholder card is gone.
    await expect(page.getByTestId('docs-group-tutorials')).toContainText('4');
    await expect(page.getByTestId('docs-tutorials-empty')).toHaveCount(0);
    await expect(
      page
        .getByTestId('docs-tree-topic')
        .filter({ hasText: 'Map a data and AI platform' }),
    ).toBeVisible();
    await page.getByTestId('docs-group-start').click();
    await expect(
      page.getByTestId('docs-tree-topic').filter({ hasText: 'Welcome' }),
    ).toHaveCount(0);
    await page.getByTestId('docs-group-start').click();
    await page.getByTestId('docs-page-search-input').fill('welcome');
    await page.getByTestId('docs-page-search-hit').first().click();
    await expect(
      page.getByTestId('docs-page').getByTestId('docs-title'),
    ).toBeVisible();
  });
});

test.describe('Help in the dark theme', () => {
  test('is readable: screenshots', async ({ page }, testInfo) => {
    const dir = process.env.DOCS_SCREENSHOT_DIR ?? testInfo.outputDir;
    mkdirSync(dir, { recursive: true });
    await prepare(page);
    await newModel(page, 'Looks');
    await page.getByTestId('settings-menu').locator('summary').click();
    await page.getByTestId('theme-dark').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('F1');
    await page.getByTestId('docs-search-input').fill('welcome');
    await page.getByTestId('docs-search-hit').first().click();
    await expect(page.getByTestId('docs-reader')).toBeVisible();
    await page.screenshot({ path: `${dir}/docs-panel-dark.png` });
    await page.getByTestId('docs-open-area').click();
    await expect(page.getByTestId('docs-page')).toBeVisible();
    await page.screenshot({ path: `${dir}/docs-area-dark.png` });
    await page.getByTestId('settings-menu').locator('summary').click();
    await page.getByTestId('theme-light').click();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${dir}/docs-area-light.png` });
    await page.getByTestId('mode-model').click();
    await page.keyboard.press('F1');
    await expect(panel(page)).toBeVisible();
    await page.screenshot({ path: `${dir}/docs-panel-light.png` });
  });
});
