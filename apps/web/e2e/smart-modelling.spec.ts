import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepare } from './app';
import { loadHarness } from './bundle';
import { chooseFromMenu } from './menus';

const tools = (p: string) =>
  fileURLToPath(new URL(`../../../tools/agent-pipeline/${p}`, import.meta.url));

type Hook = {
  store: {
    state: {
      elements: Record<
        string,
        {
          x: number;
          y: number;
          w: number;
          h: number;
          attrs: Record<string, unknown>;
        }
      >;
      connectors: Record<string, unknown>;
    };
    undo(): boolean;
  };
  view: {
    toScreenFromWorld(p: { x: number; y: number }): { x: number; y: number };
  };
};

async function openPipeline(page: Page) {
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
  await page
    .getByRole('tree')
    .getByRole('button', { name: 'Code review pipeline' })
    .click();
  await expect(page.getByTestId('model-view')).toBeVisible();
}

/** The page position of the middle of the concept called `name`. */
const centreOf = (page: Page, name: string) =>
  page.evaluate((n) => {
    const hook = (window as unknown as { __metakit: Hook }).__metakit;
    const el = Object.values(hook.store.state.elements).find((e) =>
      Object.values(e.attrs).includes(n),
    )!;
    const p = hook.view.toScreenFromWorld({
      x: el.x + el.w / 2,
      y: el.y + el.h / 2,
    });
    const box = document
      .querySelector('[data-testid="canvas-host"]')!
      .getBoundingClientRect();
    return { x: box.x + p.x, y: box.y + p.y };
  }, name);

const counts = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __metakit: Hook }).__metakit.store.state;
    return {
      elements: Object.keys(s.elements).length,
      connectors: Object.keys(s.connectors).length,
    };
  });

test.describe('hints and smart modelling', () => {
  test('are off until switched on in the View menu, and remembered', async ({
    page,
  }) => {
    await openPipeline(page);
    await expect(page.getByTestId('hint-line')).toHaveCount(0);
    await chooseFromMenu(page, 'View', 'assist-hints');
    await expect(page.getByTestId('hint-line')).toBeVisible();
    // The choice is kept in this browser, not in the model.
    const stored = await page.evaluate(() =>
      localStorage.getItem('metakit.assist'),
    );
    expect(JSON.parse(stored!)).toEqual({ hints: true, smart: false });
  });

  test('the hint line says what a relation connects', async ({ page }) => {
    await openPipeline(page);
    await chooseFromMenu(page, 'View', 'assist-hints');
    await page.getByTestId('palette-relation-Performs').hover();
    await expect(page.getByTestId('hint-line')).toContainText(
      'Performs connects an Actor to a Task',
    );
    await page.getByTestId('palette-relation-Performs').click();
    await expect(page.getByTestId('hint-line')).toContainText(
      'Click the concept where the Performs should start',
    );
    // A right-click leaves the mode and the hint goes back to the general one.
    const box = (await page.getByTestId('canvas-host').boundingBox())!;
    await page.mouse.click(box.x + 40, box.y + 40, { button: 'right' });
    await expect(page.getByTestId('hint-line')).not.toContainText('Performs');
  });

  test('hovering a concept lists what it can be connected to, and New adds and connects in one step', async ({
    page,
  }) => {
    await openPipeline(page);
    await chooseFromMenu(page, 'View', 'assist-smart');
    const before = await counts(page);
    const at = await centreOf(page, 'Implement');
    await page.mouse.move(at.x - 20, at.y - 10);
    await page.mouse.move(at.x, at.y);
    const card = page.getByTestId('suggestion-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Connect Implement');
    await expect(card.getByTestId('suggestion-group-Produces')).toContainText(
      'Artifact',
    );
    await expect(card.getByTestId('suggestion-group-Performs')).toContainText(
      'Agent',
    );
    await expect(card.getByTestId('suggestion-group-Performs')).toContainText(
      'Human',
    );

    await card.getByTestId('suggestion-new-Produces-out-Artifact').click();
    await expect(card).toBeHidden();
    const after = await counts(page);
    expect(after).toEqual({
      elements: before.elements + 1,
      connectors: before.connectors + 1,
    });
    // One undo removes both.
    await page.evaluate(() =>
      (window as unknown as { __metakit: Hook }).__metakit.store.undo(),
    );
    expect(await counts(page)).toEqual(before);
  });

  test('Existing starts connecting with that relation', async ({ page }) => {
    await openPipeline(page);
    await chooseFromMenu(page, 'View', 'assist-smart');
    const at = await centreOf(page, 'Merge');
    await page.mouse.move(at.x - 15, at.y - 8);
    await page.mouse.move(at.x, at.y);
    const card = page.getByTestId('suggestion-card');
    await expect(card).toBeVisible();
    await card.getByTestId('suggestion-existing-Feeds-in-Artifact').click();
    await expect(page.getByTestId('tool-select')).not.toHaveClass(/on/);
  });

  test('stays quiet when smart modelling is off', async ({ page }) => {
    await openPipeline(page);
    const at = await centreOf(page, 'Implement');
    await page.mouse.move(at.x - 20, at.y - 10);
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(700);
    await expect(page.getByTestId('suggestion-card')).toHaveCount(0);
  });
});
