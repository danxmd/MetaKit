import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';
import { loadHarness } from './bundle';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Hook = {
  store: { execute(c: unknown): { value?: unknown }; state: unknown };
  editor: { select(e: string[], c?: string[]): void };
  scene: {
    elements: Map<
      string,
      {
        compiled: {
          compiled: { ops: { op: string; lines?: { text: string }[] }[] };
        };
      }
    >;
  };
};

/** The bpmn-lite tool with a Created default, an Effort constraint and a shape that prints Cost. */
function formulaTool(): string {
  const tool = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL('../../../tools/bpmn-lite/tool.json', import.meta.url),
      ),
      'utf8',
    ),
  ) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test-only edit of a JSON document
  const task = tool.classes['cls_task'];
  task.attributes.push({
    id: 'att_created',
    key: 'Created',
    type: 'text',
    defaultFormula: '= today()',
  });
  task.constraints = [
    {
      id: 'k_effort',
      formula: 'Effort > 0',
      message: 'Effort must be above zero',
    },
  ];
  task.shape = 'shp_cost';
  tool.shapes['shp_cost'] = {
    id: 'shp_cost',
    kind: 'node',
    size: { width: 140, height: 70 },
    outline: 'rect',
    parts: [
      { type: 'rect', width: '100%', height: '100%', fill: '= $fill' },
      {
        type: 'text',
        width: '100%',
        height: '100%',
        text: "= 'Cost ' + Cost",
      },
    ],
  };
  return JSON.stringify(tool);
}

const execute = (page: Page, command: unknown) =>
  page.evaluate(
    (c) =>
      (window as unknown as { __metakit: Hook }).__metakit.store.execute(c)
        .value as string,
    command,
  );

const shapeText = (page: Page, id: string) =>
  page.evaluate(
    (i) =>
      (window as unknown as { __metakit: Hook }).__metakit.scene.elements
        .get(i)!
        .compiled.compiled.ops.flatMap((o) => o.lines?.map((l) => l.text) ?? [])
        .join(' '),
    id,
  );

// enabled by the lead after wiring: needs the ModelCalculator in ModelView (panel, validation, scene).
test.describe.skip('formula uses', () => {
  test('editing Effort updates the panel, the validation message and the shape', async ({
    page,
  }) => {
    // Seed the workspace ourselves: `prepare` would seed the plain bpmn-lite tool.
    await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
    await loadHarness(page, './seed-harness.ts');
    await page.evaluate(
      (json) =>
        (window as unknown as { __seed(t: string): Promise<void> }).__seed(
          json,
        ),
      formulaTool(),
    );
    await page.reload();
    await newModel(page, 'Formulas');

    const id = await execute(page, {
      type: 'createElement',
      class: 'cls_task',
      x: 100,
      y: 100,
      attrs: { att_name: 'Check order', att_effort: 0 },
    });
    await page.evaluate(
      (i) =>
        (window as unknown as { __metakit: Hook }).__metakit.editor.select([i]),
      id,
    );

    // The default formula filled Created when the task was made.
    const today = new Date().toISOString().slice(0, 10);
    await expect(page.locator('#f-att_created')).toHaveValue(today);

    // Effort 0: the constraint message shows under Effort.
    await expect(page.getByTestId('attribute-panel')).toContainText(
      'Effort must be above zero',
      { timeout: 15_000 },
    );
    await expect(page.locator('#f-att_cost')).toHaveText('0');

    const effort = page.locator('#f-att_effort');
    await effort.fill('3');
    await effort.press('Enter');

    await expect(page.locator('#f-att_cost')).toHaveText('255');
    await expect(page.getByTestId('attribute-panel')).not.toContainText(
      'Effort must be above zero',
      { timeout: 15_000 },
    );
    await expect.poll(() => shapeText(page, id)).toContain('Cost 255');
  });
});
