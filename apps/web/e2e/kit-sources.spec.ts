import { expect, test, type Page } from '@playwright/test';
import { prepare } from './app';

async function emptyWorkspace(page: Page) {
  await prepare(page, { seed: false });
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('models-page')).toBeVisible();
}

/** Opens the built-in Kit catalogue from the Kits page, at a domain or at All Kits. */
async function openCatalogue(page: Page, domain?: string) {
  await page
    .getByTestId(domain ? `built-in-domain-${domain}` : 'browse-built-ins')
    .click();
  const catalogue = page.getByTestId('kit-catalog');
  await expect(catalogue).toBeVisible();
  return catalogue;
}

test.describe('Built-in and workspace Kits', () => {
  test('the page shows the two sections apart, and a built-in one can be used as it is', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await page.getByTestId('mode-build').click();
    const workspace = page.getByTestId('workspace-kits');
    const builtIn = page.getByTestId('built-in-kits');
    await expect(
      workspace.getByRole('heading', {
        name: 'In this workspace',
        exact: true,
      }),
    ).toBeVisible();
    await expect(workspace.getByTestId('no-kits')).toBeVisible();
    await expect(
      builtIn.getByRole('heading', { name: 'Built-in Kits', exact: true }),
    ).toBeVisible();
    // The page shows the domains; the Kits themselves are in the catalogue.
    await expect(builtIn.getByTestId('built-in-domain-data-ai')).toContainText(
      'Data and AI',
    );
    await expect(builtIn.getByTestId('built-in-tool_erlite')).toHaveCount(0);
    const catalogue = await openCatalogue(page, 'architecture');
    await catalogue.getByTestId('built-in-tool_erlite').click();
    const preview = catalogue.getByTestId('catalog-preview');
    // What is inside is read when the Kit is chosen, with a picture of its sample model.
    await expect(preview).toContainText('Entity');
    await expect(preview.getByTestId('catalog-picture')).toBeVisible();

    await catalogue.getByTestId('use-built-in-tool_erlite').click();
    await expect(
      catalogue.getByTestId('built-in-added-tool_erlite'),
    ).toBeVisible();
    await expect(catalogue.getByTestId('use-built-in-tool_erlite')).toHaveCount(
      0,
    );
    await page.keyboard.press('Escape');
    await expect(catalogue).toHaveCount(0);
    await expect(workspace.getByTestId('no-kits')).toHaveCount(0);
    await expect(
      workspace.getByRole('heading', { name: 'ER lite' }),
    ).toBeVisible();
  });

  test('copy and extend makes a new library based on the original', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await page.getByTestId('mode-build').click();
    const catalogue = await openCatalogue(page);
    await catalogue.getByTestId('built-in-tool_agentpipeline').click();
    await catalogue.getByTestId('copy-built-in-tool_agentpipeline').click();
    await expect(catalogue).toHaveCount(0);
    const dialog = page.getByTestId('new-kit-dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByTestId('start-built-in-tool_agentpipeline'),
    ).toBeChecked();
    await dialog.getByTestId('new-kit-name').fill('Our agents');
    await expect(dialog.getByTestId('new-kit-note')).toContainText(
      'Agent pipeline',
    );
    await dialog.getByTestId('new-kit-create').click();

    // It opens in Build with the classes of the original.
    await expect(page.getByTestId('build-view')).toBeVisible();
    await expect(page.getByTestId('build-item-Agent')).toBeVisible();
    await page.getByTestId('crumb-area').click();

    const ours = page.getByTestId('workspace-kits').locator('li.kit', {
      hasText: 'Our agents',
    });
    await expect(ours).toContainText('Based on Agent pipeline 1.0.0');
    await expect(ours).toContainText('Version 1.0.0');
    // The original is still offered as built-in, not added.
    const again = await openCatalogue(page);
    await again.getByTestId('built-in-tool_agentpipeline').click();
    await expect(
      again.getByTestId('use-built-in-tool_agentpipeline'),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // A workspace library can be copied too, from its … menu.
    await ours.locator('summary').click();
    await ours.getByText('Copy and extend…').click();
    await expect(page.getByTestId('new-kit-dialog')).toBeVisible();
    await page.getByTestId('new-kit-name').fill('Our agents, team B');
    await page.getByTestId('new-kit-create').click();
    await expect(page.getByTestId('build-view')).toBeVisible();
    await page.getByTestId('crumb-area').click();
    await expect(
      page
        .getByTestId('workspace-kits')
        .locator('li.kit', { hasText: 'team B' }),
    ).toContainText('Based on Our agents 1.0.0');
  });

  test('a model can be made with a built-in library, which is then added', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await expect(page.getByTestId('no-models')).toContainText(
      'pick a built-in one in New model',
    );
    await page.getByTestId('new-model-empty').click();
    await page
      .getByTestId('new-model-kit')
      .selectOption('built-in:tool_erlite');
    await expect(page.getByTestId('new-model-type')).not.toHaveValue('');
    await page.getByTestId('new-model-name').fill('Library data');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    await expect(page.getByTestId('palette-class-Entity')).toBeVisible();

    await page.getByTestId('crumb-area').click();
    await page.getByTestId('mode-build').click();
    const catalogue = await openCatalogue(page);
    await expect(
      catalogue.getByTestId('built-in-added-tool_erlite'),
    ).toBeVisible();
  });
  test('the catalogue groups the built-in Kits by domain, searches across them and keeps their order in the dialogs', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await page.getByTestId('mode-build').click();
    const catalogue = await openCatalogue(page, 'delivery');
    const domain = (id: string) =>
      catalogue.getByTestId(`catalog-domain-${id}`);
    await expect(domain('delivery')).toHaveAttribute('aria-selected', 'true');
    await expect(
      catalogue.getByTestId('built-in-kit_projectraid'),
    ).toBeVisible();
    await expect(catalogue.getByTestId('built-in-tool_erlite')).toHaveCount(0);
    await domain('architecture').click();
    await expect(catalogue.getByTestId('built-in-tool_erlite')).toBeVisible();
    await domain('business').click();
    await expect(catalogue.getByTestId('built-in-tool_bpmnlite')).toBeVisible();
    await domain('general').click();
    await expect(catalogue.getByTestId('built-in-kit_orgchart')).toBeVisible();
    await domain('data-ai').click();
    await expect(catalogue.getByTestId('built-in-kit_kpitree')).toBeVisible();

    // The search looks across every domain and names the domain of each match.
    const search = catalogue.getByTestId('built-in-search');
    await search.fill('lineage');
    await expect(
      catalogue.getByTestId('built-in-tool_dataaiarch'),
    ).toContainText('Data and AI ·');
    await expect(catalogue.getByTestId('built-in-tool_erlite')).toHaveCount(0);
    await expect(catalogue.getByTestId('built-in-kit_kpitree')).toHaveCount(0);
    await search.fill('MATURITY gap');
    await expect(catalogue.getByRole('option')).toHaveCount(1);
    await expect(
      catalogue.getByTestId('built-in-kit_dataaimaturity'),
    ).toBeVisible();
    await search.fill('nothing like this');
    await expect(catalogue.getByTestId('built-in-none')).toHaveText(
      'No built-in Kit matches.',
    );
    await search.fill('');
    await domain('all').click();
    const cards = await catalogue
      .getByRole('option')
      .evaluateAll((els) =>
        els.map((e) =>
          e.getAttribute('data-testid')!.slice('built-in-'.length),
        ),
      );
    expect(cards).toHaveLength(34);
    await page.keyboard.press('Escape');
    await expect(catalogue).toHaveCount(0);

    // Start from in New Kit lists them in the order of the catalogue.
    await page.getByTestId('new-kit').click();
    const dialog = page.getByTestId('new-kit-dialog');
    const starts = await dialog
      .locator('[data-testid^="start-built-in-"]')
      .evaluateAll((els) =>
        els.map((e) =>
          e.getAttribute('data-testid')!.slice('start-built-in-'.length),
        ),
      );
    expect(starts).toEqual(cards);
    await page.keyboard.press('Escape');

    // So does the built-in group of New model, and a new Kit works there.
    await page.getByTestId('mode-model').click();
    await page.getByTestId('new-model-empty').click();
    const options = await page
      .getByTestId('new-model-kit')
      .locator('optgroup option')
      .evaluateAll((els) =>
        els.map((e) =>
          (e as HTMLOptionElement).value.slice('built-in:'.length),
        ),
      );
    expect(options).toEqual(cards);
    await page
      .getByTestId('new-model-kit')
      .selectOption('built-in:kit_kpitree');
    await expect(page.getByTestId('new-model-type')).not.toHaveValue('');
    await page.getByTestId('new-model-name').fill('Sales metrics');
    await page.getByTestId('new-model-create').click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    await expect(page.getByTestId('palette-class-OutcomeKPI')).toBeVisible();
    await expect(page.getByTestId('palette-class-KPI')).toHaveCount(0);
  });
});

test.describe('The Kit catalogue', () => {
  test('shows one tab per sample model, and moves through the Kits with the keyboard', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await page.getByTestId('mode-build').click();
    const catalogue = await openCatalogue(page);
    await catalogue.getByRole('option', { name: /^Data modelling/ }).click();
    const preview = catalogue.getByTestId('catalog-preview');
    await expect(preview.getByRole('tab')).toHaveCount(3);
    await expect(preview.getByTestId('catalog-picture')).toBeVisible();
    const first = await preview
      .getByTestId('catalog-picture')
      .getAttribute('src');
    await preview.getByTestId('catalog-sample-2').click();
    await expect(preview.getByTestId('catalog-sample-2')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      await preview.getByTestId('catalog-picture').getAttribute('src'),
    ).not.toBe(first);
    await preview.getByTestId('catalog-full-size').click();
    await expect(preview.getByTestId('catalog-full-size')).toHaveText(
      'Fit to the box',
    );

    // Down twice from the first Kit chooses the third one, and Enter reaches its actions.
    const options = catalogue.getByRole('option');
    await options.first().click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(2)).toBeFocused();
    const third = (await options.nth(2).getAttribute('data-testid'))!.slice(
      'built-in-'.length,
    );
    await page.keyboard.press('Enter');
    await expect(catalogue.getByTestId(`use-built-in-${third}`)).toBeFocused();
  });

  test('Escape closes it and gives focus back to the control that opened it', async ({
    page,
  }) => {
    await emptyWorkspace(page);
    await page.getByTestId('mode-build').click();
    const catalogue = await openCatalogue(page, 'general');
    await expect(
      catalogue.getByTestId('catalog-domain-general'),
    ).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(catalogue).toHaveCount(0);
    await expect(page.getByTestId('built-in-domain-general')).toBeFocused();
  });
});
