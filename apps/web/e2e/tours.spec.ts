import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

/** A Kit with simple looks, rules and a script. */
const portfolioKit = readFileSync(
  fileURLToPath(
    new URL('../../../kits/ai-use-case-portfolio/kit.json', import.meta.url),
  ),
  'utf8',
);

/**
 * Walks the running tour to its end. Every step must find its control (the layer says so on
 * `data-tour-missing`), and a pop-up beside a small control must not cover it. Only the steps
 * named in `skipped` may be passed over, because their control is not on this page.
 */
async function walkTour(page: Page, id: string, skipped: string[] = []) {
  const layer = page.getByTestId('tour-layer');
  await expect(layer).toHaveAttribute('data-tour-id', id);
  const count = page.getByTestId('tour-count');
  await expect(count).toHaveText(/^\d+ of \d+$/);
  const total = Number((await count.textContent())!.split(' of ')[1]);
  const viewport = page.viewportSize()!;
  const visited: string[] = [];
  let previous = 0;
  for (;;) {
    // The next step that found its control, or the end of the tour.
    await expect(async () => {
      if ((await layer.count()) === 0) return;
      const at = Number((await count.textContent())!.split(' of ')[0]);
      expect(at, `"${id}" moved on from step ${previous}`).toBeGreaterThan(
        previous,
      );
      const anchor = await layer.getAttribute('data-tour-anchor');
      expect(
        await layer.getAttribute('data-tour-missing'),
        `step ${at} of "${id}" finds [data-tour="${anchor}"]`,
      ).toBe('false');
    }).toPass({ timeout: 6000 });
    if ((await layer.count()) === 0) break;
    const at = Number((await count.textContent())!.split(' of ')[0]);
    const anchor = (await layer.getAttribute('data-tour-anchor'))!;
    expect(
      skipped,
      `step ${at} of "${id}" was expected to be skipped`,
    ).not.toContain(anchor);
    visited.push(anchor);
    previous = at;
    const located = page
      .locator(`[data-tour="${anchor}"]`)
      .filter({ visible: true })
      .first();
    // Painted, not only laid out: Chrome lays out the inside of a closed menu.
    expect(
      await located.evaluate((el) => el.checkVisibility()),
      `[data-tour="${anchor}"] is visible`,
    ).toBe(true);
    const control = (await located.boundingBox())!;
    const popup = (await page.getByTestId('tour-popup').boundingBox())!;
    const small =
      control.width * control.height < (viewport.width * viewport.height) / 5;
    if (small) {
      const overlap =
        popup.x < control.x + control.width &&
        control.x < popup.x + popup.width &&
        popup.y < control.y + control.height &&
        control.y < popup.y + popup.height;
      expect(overlap, `the pop-up of step ${at} covers ${anchor}`).toBe(false);
    }
    await expect(page.getByTestId('tour-next')).toHaveText(
      at === total ? 'Finish' : 'Next',
    );
    await page.getByTestId('tour-next').click();
  }
  expect(visited.length + skipped.length, `the steps of "${id}"`).toBe(total);
}

/** Opens the Tutorials page and starts a tour from its card. */
async function startTour(page: Page, id: string) {
  await page.getByTestId('open-tutorials').click();
  await expect(page.getByTestId('tutorials-page')).toBeVisible();
  await page.getByTestId(`tour-start-${id}`).click();
  await expect(page.getByTestId('tutorials-page')).toHaveCount(0);
  await expect(page.getByTestId('tour-layer')).toBeVisible();
}

async function openWorkspace(page: Page) {
  await prepare(page);
  await page.getByTestId('open-folder').click();
  await expect(page.getByTestId('models-page')).toBeVisible();
}

test.describe('Guided tours', () => {
  test('the first-steps tour walks the start page and is then done', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await page.getByTestId('open-tutorials').click();
    await expect(page.getByTestId('tour-status-first-steps')).toHaveText(
      'Not started',
    );
    // The written tutorials come from the docs.
    await expect(
      page.locator(
        '[data-testid="written-tutorial"][data-topic="data-governance"]',
      ),
    ).toBeVisible();
    await page.getByTestId('tour-start-first-steps').click();
    await expect(page.getByTestId('start-page')).toBeVisible();
    await walkTour(page, 'first-steps');

    await page.getByTestId('open-tutorials').click();
    await expect(page.getByTestId('tour-status-first-steps')).toHaveText(
      'Done',
    );
    await expect(page.getByTestId('tour-start-first-steps')).toHaveText(
      'Start again',
    );
    await page.getByTestId('tutorials-back').click();
    await expect(page.getByTestId('start-page')).toBeVisible();
  });

  test('keys move between steps, Escape ends, and Start again begins at step 1', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await startTour(page, 'first-steps');
    const count = page.getByTestId('tour-count');
    await expect(count).toHaveText('1 of 5');
    // The pop-up has the focus, so the arrow keys and Enter belong to the tour.
    await expect(page.getByTestId('tour-popup')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText('2 of 5');
    await page.keyboard.press('Enter');
    await expect(count).toHaveText('3 of 5');
    await page.keyboard.press('ArrowLeft');
    await expect(count).toHaveText('2 of 5');
    await page.getByTestId('tour-back').click();
    await expect(page.getByTestId('tour-back')).toBeDisabled();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('tour-layer')).toHaveCount(0);

    // Ended early: not done.
    await page.getByTestId('open-tutorials').click();
    await expect(page.getByTestId('tour-status-first-steps')).toHaveText(
      'Not started',
    );
    await page.getByTestId('tour-start-first-steps').click();
    await expect(count).toHaveText('1 of 5');
    await page.getByTestId('tour-end').click();
    await expect(page.getByTestId('tour-layer')).toHaveCount(0);
  });

  test('a step whose control is not shown says so and offers Next', async ({
    page,
  }) => {
    await prepare(page, { seed: false });
    await startTour(page, 'first-steps');
    await page.evaluate(() =>
      document
        .querySelector('[data-tour="start-workspace"]')!
        .removeAttribute('data-tour'),
    );
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-count')).toHaveText('2 of 5');
    await expect(page.getByTestId('tour-layer')).toHaveAttribute(
      'data-tour-missing',
      'true',
    );
    await expect(page.getByTestId('tour-missing')).toHaveText(
      'This part of the page is not shown right now.',
    );
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute(
      'data-tour-missing',
      'false',
    );
  });

  test('the Tutorials page covers the workspace like the Documentation does', async ({
    page,
  }) => {
    await openWorkspace(page);
    await page.getByTestId('open-tutorials').click();
    await expect(page.getByTestId('tutorials-page')).toBeVisible();
    await expect(page.getByTestId('open-tutorials')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByTestId('mode-model')).not.toHaveAttribute(
      'aria-current',
      'page',
    );
    // The start-page tour needs the start page; it offers to close the workspace.
    await expect(page.getByTestId('tour-needs-first-steps')).toContainText(
      'start page',
    );
    // Help opens at the topic of the Tutorials page.
    await page.keyboard.press('F1');
    await expect(page.getByTestId('docs-panel')).toContainText(
      'Tutorials page and guided tours',
    );
    await page.keyboard.press('F1');
    // A written tutorial opens in the Documentation area.
    await page
      .locator('[data-testid="written-tutorial"][data-topic="data-governance"]')
      .click();
    await expect(page.getByTestId('docs-page')).toBeVisible();
    await expect(page.getByTestId('tutorials-page')).toHaveCount(0);
    await page.getByTestId('open-tutorials').click();
    await page.getByTestId('mode-model').click();
    await expect(page.getByTestId('models-page')).toBeVisible();
    await expect(page.getByTestId('tutorials-page')).toHaveCount(0);

    // Close workspace and start: the tour runs on the start page.
    await page.getByTestId('open-tutorials').click();
    await page.getByTestId('tour-goto-first-steps').click();
    await expect(page.getByTestId('start-page')).toBeVisible();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute(
      'data-tour-id',
      'first-steps',
    );
    await walkTour(page, 'first-steps');
  });
});

test.describe('Page tours', () => {
  test('Models page: started from the Kits page, it opens the Models page and walks it', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page, 'Order process', 'Sales');
    await page.getByTestId('back-to-explorer').click();
    await page.getByTestId('new-model').click();
    await page.getByTestId('new-model-name').fill('Old draft');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    await page.getByTestId('back-to-explorer').click();
    await page.getByLabel('Actions for Old draft').click();
    await page.getByRole('button', { name: 'Delete Old draft' }).click();
    await expect(page.getByTestId('trash')).toBeVisible();

    await page.getByTestId('mode-build').click();
    await expect(page.getByTestId('kits-page')).toBeVisible();
    await startTour(page, 'models-page');
    await expect(page.getByTestId('models-page')).toBeVisible();
    await walkTour(page, 'models-page');
  });

  test('Modelling a model: needs an open model, then walks the model view', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await page.getByTestId('open-tutorials').click();
    await expect(page.getByTestId('tour-needs-modelling')).toHaveText(
      'Open a model first.',
    );
    await expect(page.getByTestId('tour-start-modelling')).toHaveCount(0);
    await page.getByTestId('tour-goto-modelling').click();
    await expect(page.getByTestId('models-page')).toBeVisible();

    await page.getByTestId('new-model').click();
    await page.getByTestId('new-model-name').fill('Order process');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    await startTour(page, 'modelling');
    await expect(page.getByTestId('model-view')).toBeVisible();
    await walkTour(page, 'modelling');
  });

  test('Kits page: started from the Models page, it opens the Kits page and walks it', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await expect(page.getByTestId('models-page')).toBeVisible();
    await startTour(page, 'kits-page');
    await expect(page.getByTestId('kits-page')).toBeVisible();
    // Step 3 is New Kit, beside it and not over it.
    await page.getByTestId('tour-next').click();
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-layer')).toHaveAttribute(
      'data-tour-anchor',
      'kits-new',
    );
    await page.getByTestId('tour-end').click();
    await startTour(page, 'kits-page');
    await walkTour(page, 'kits-page');
  });

  test('Help and settings: opens the Settings menu for its items, and F1 still works', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await startTour(page, 'help-settings');
    await page.keyboard.press('F1');
    await expect(page.getByTestId('docs-panel')).toBeVisible();
    await expect(page.getByTestId('tour-layer')).toBeVisible();
    await page.keyboard.press('F1');
    await expect(page.getByTestId('docs-panel')).toHaveCount(0);
    await walkTour(page, 'help-settings');
    // The menu the tour opened is closed again.
    await expect(page.getByTestId('settings-menu')).not.toHaveAttribute(
      'open',
      '',
    );
  });
});

test.describe('Build tours', () => {
  /** Opens the workspace's only Kit in Build. */
  async function openKit(page: Page, kit?: string) {
    await prepare(page, { kit });
    await page.getByTestId('open-folder').click();
    await page.getByTestId('mode-build').click();
    await page.locator('[data-testid^="edit-kit-"]').first().click();
    await expect(page.getByTestId('build-view')).toBeVisible();
  }

  test('Building a Kit: needs an open Kit, then walks the Build view from any section', async ({
    page,
  }) => {
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await page.getByTestId('open-tutorials').click();
    await expect(page.getByTestId('tour-needs-building-kit')).toHaveText(
      'Open a Kit in Build first.',
    );
    await page.getByTestId('tour-goto-building-kit').click();
    await expect(page.getByTestId('kits-page')).toBeVisible();
    await page.locator('[data-testid^="edit-kit-"]').first().click();
    await expect(page.getByTestId('build-view')).toBeVisible();

    // Started from another section, Next on the Classes tab opens the classes.
    await page.getByTestId('build-tab-shapes').click();
    await startTour(page, 'building-kit');
    // Only a Kit linked to Git has Source control.
    await walkTour(page, 'building-kit', ['build-git']);
    await expect(page.getByTestId('class-editor')).toBeVisible();
  });

  test('Appearance: opens the appearance editor of a class and closes it again', async ({
    page,
  }) => {
    await openKit(page, portfolioKit);
    await startTour(page, 'appearance');
    await walkTour(page, 'appearance');
    await expect(page.getByTestId('appearance-overlay')).toHaveCount(0);
    await expect(page.getByTestId('class-editor')).toBeVisible();
  });

  test('Rules and scripts: walks a rule and the scripts of a Kit', async ({
    page,
  }) => {
    await openKit(page, portfolioKit);
    // An editor left open would cover the sections; starting a Build tour closes it.
    await page.getByTestId('build-item-AITechnique').click();
    await page.getByTestId('class-edit-appearance').click();
    await expect(page.getByTestId('appearance-overlay')).toBeVisible();
    await startTour(page, 'rules-scripts');
    await expect(page.getByTestId('appearance-overlay')).toHaveCount(0);
    await walkTour(page, 'rules-scripts');
    await expect(page.getByTestId('scripts-section')).toBeVisible();
  });
});

test.describe('First visit', () => {
  async function firstVisit(page: Page) {
    await page.addInitScript(() => {
      (window as unknown as { __METAKIT_TEST__: unknown }).__METAKIT_TEST__ = {
        remember: false,
      };
    });
    await page.goto('/MetaKit/');
    await expect(page.getByTestId('tour-offer')).toHaveCount(0);
    await page.getByTestId('profile-name').fill('Lena');
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('tour-offer')).toBeVisible();
  }

  test('"Not now" does not offer the tour again, and it stays on the Tutorials page', async ({
    page,
  }) => {
    await firstVisit(page);
    await page.getByTestId('tour-offer-dismiss').click();
    await expect(page.getByTestId('tour-offer')).toHaveCount(0);
    await expect(page.getByTestId('tour-layer')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('open-folder')).toBeVisible();
    await expect(page.getByTestId('tour-offer')).toHaveCount(0);
    await page.getByTestId('open-tutorials').click();
    await expect(page.getByTestId('tour-start-first-steps')).toBeVisible();
  });

  test('the offer starts the first-steps tour', async ({ page }) => {
    await firstVisit(page);
    await page.getByTestId('tour-offer-start').click();
    await expect(page.getByTestId('tour-offer')).toHaveCount(0);
    await walkTour(page, 'first-steps');
  });
});
