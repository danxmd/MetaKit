import { expect, test, type Page } from '@playwright/test';
import { canvasPoint, kitJson, model, newModel, prepare } from './app';

/** Issue #48: the step-by-step wizard for a new class or relation class. */

const bpmnClasses = new Set(Object.keys(JSON.parse(kitJson).classes as object));

async function openWizard(page: Page) {
  await page.getByTestId('palette-new-concept').click();
  await expect(page.getByTestId('concept-wizard')).toBeVisible();
}

const next = (page: Page) => page.getByTestId('concept-wizard-next').click();

async function addRiskClass(page: Page) {
  await openWizard(page);
  await page.getByTestId('concept-wizard-name').fill('Risk owner');
  await expect(page.getByTestId('concept-wizard-key')).toHaveValue('RiskOwner');
  await page.getByTestId('concept-wizard-help').fill('Who answers for a risk.');
  await next(page);
  await expect(page.getByTestId('concept-wizard-step-look')).toBeVisible();
  await page.getByTestId('concept-wizard-base').selectOption('hexagon');
  await next(page);
  await expect(
    page.getByTestId('concept-wizard-step-attributes'),
  ).toBeVisible();
  // A new class starts with a required Name.
  await expect(page.getByTestId('concept-wizard-attribute-name-0')).toHaveValue(
    'Name',
  );
  await page.getByTestId('concept-wizard-add-attribute').click();
  await page.getByTestId('concept-wizard-attribute-name-1').fill('Level');
  await page
    .getByTestId('concept-wizard-attribute-type-1')
    .selectOption('choice');
  await page
    .getByTestId('concept-wizard-attribute-options-1')
    .fill('Low\nHigh');
  await next(page);
  await expect(page.getByTestId('concept-wizard-summary')).toContainText(
    'A class "Risk owner" (key RiskOwner)',
  );
  await expect(page.getByTestId('concept-wizard-summary')).toContainText(
    'Model types that allow it: Process.',
  );
  await next(page);
  await expect(page.getByTestId('concept-wizard')).toHaveCount(0);
}

test.describe('the class and relation wizard', () => {
  test('adds a class from the model view, picked and ready to place', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    await addRiskClass(page);
    await expect(page.getByTestId('message')).toContainText(
      'Added the class "Risk owner" to the Kit',
    );
    await expect(page.getByTestId('palette-class-RiskOwner')).toBeVisible();
    // The new class is the active tool: one click places it.
    const p = await canvasPoint(page, 300, 200);
    await page.mouse.click(p.x, p.y);
    const m = await model(page);
    const placed = Object.values(m.elements);
    expect(placed).toHaveLength(1);
    expect(bpmnClasses.has(placed[0]!.class)).toBe(false);
  });

  test('Undo in the toast removes the class again', async ({ page }) => {
    await prepare(page);
    await newModel(page);
    await addRiskClass(page);
    await expect(page.getByTestId('palette-class-RiskOwner')).toBeVisible();
    await page.getByTestId('toast-undo').click();
    await expect(page.getByTestId('palette-class-RiskOwner')).toHaveCount(0);
  });

  test('adds a relation class between two classes', async ({ page }) => {
    await prepare(page);
    await newModel(page);
    await openWizard(page);
    await page.getByTestId('concept-wizard-kind-relation').check();
    await page.getByTestId('concept-wizard-name').fill('Reviews');
    await next(page);
    // Neither end is ticked yet, so the step stays and says why.
    await next(page);
    await expect(page.getByTestId('concept-wizard-problems')).toContainText(
      'Tick at least one class where a connection may end.',
    );
    await expect(
      page.getByTestId('concept-wizard-step-connects'),
    ).toBeVisible();
    await page.getByTestId('concept-wizard-from-Task').check();
    await page.getByTestId('concept-wizard-to-Task').check();
    await next(page);
    await next(page);
    await expect(page.getByTestId('concept-wizard-summary')).toContainText(
      'It connects Task to Task.',
    );
    await next(page);
    await expect(page.getByTestId('palette-relation-Reviews')).toBeVisible();

    // Two tasks, then a drag with the picked relation connects them.
    await page.getByTestId('palette-class-Task').click();
    let p = await canvasPoint(page, 200, 200);
    await page.mouse.click(p.x, p.y);
    await page.getByTestId('palette-class-Task').click();
    p = await canvasPoint(page, 450, 200);
    await page.mouse.click(p.x, p.y);
    await page.getByTestId('palette-relation-Reviews').click();
    const from = await canvasPoint(page, 200, 200);
    const to = await canvasPoint(page, 450, 200);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    const m = await model(page);
    expect(Object.values(m.connectors)).toHaveLength(1);
  });

  test('a step that is not complete stays, and Back keeps the answers', async ({
    page,
  }) => {
    await prepare(page);
    await newModel(page);
    await openWizard(page);
    await next(page);
    await expect(page.getByTestId('concept-wizard-problems')).toContainText(
      'Give the class a name.',
    );
    await page.getByTestId('concept-wizard-name').fill('Task');
    // "Task" is taken, so the key moves on.
    await expect(page.getByTestId('concept-wizard-key')).toHaveValue('Task2');
    await next(page);
    await page.getByTestId('concept-wizard-back').click();
    await expect(page.getByTestId('concept-wizard-name')).toHaveValue('Task');
  });

  test('opens from Build mode with Step by step…', async ({ page }) => {
    await prepare(page);
    await newModel(page);
    await page.getByTestId('mode-build').click();
    await page.getByTestId('new-kit').click();
    await page.getByTestId('new-kit-name').fill('Mini');
    await page.getByTestId('new-kit-create').click();
    await expect(page.getByTestId('build-view')).toBeVisible();
    await page.getByTestId('build-tab-classes').click();
    await page.getByTestId('build-wizard-open').click();
    await expect(page.getByTestId('concept-wizard')).toBeVisible();
    await page.getByTestId('concept-wizard-name').fill('Entity');
    await next(page);
    await next(page);
    await next(page);
    await next(page);
    await expect(page.getByTestId('concept-wizard')).toHaveCount(0);
    await expect(page.getByTestId('class-editor')).toBeVisible();
    await expect(page.getByTestId('build-issues')).toHaveCount(0);
  });
});
