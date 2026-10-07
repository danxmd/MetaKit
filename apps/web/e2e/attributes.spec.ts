import { expect, test, type Page } from '@playwright/test';
import { model, newModel, prepare } from './app';

type Store = {
  execute(c: unknown): { ok: boolean; value?: unknown };
};
type Hook = {
  store: Store;
  editor: { select(e: string[], c?: string[]): void; selection: unknown };
  scene: { elements: Map<string, { label: string }> };
  view: { onFrame: ((ms: number) => void) | null };
};

/** Creates an element through the store (as a script would) and returns its id. */
async function create(
  page: Page,
  cls: string,
  attrs: Record<string, unknown> = {},
  x = 100,
  y = 100,
) {
  return page.evaluate(
    ([c, a, px, py]) => {
      const hook = (window as unknown as { __metakit: Hook }).__metakit;
      const r = hook.store.execute({
        type: 'createElement',
        class: c,
        x: px,
        y: py,
        attrs: a,
      });
      return r.value as string;
    },
    [cls, attrs, x, y] as const,
  );
}

const select = (page: Page, ...ids: string[]) =>
  page.evaluate(
    (list) =>
      (window as unknown as { __metakit: Hook }).__metakit.editor.select(list),
    ids,
  );

const attrsOf = async (page: Page, id: string) =>
  (await model(page)).elements[id]!.attrs;

test.describe('attribute panel', () => {
  test.beforeEach(async ({ page }) => {
    await prepare(page);
    await newModel(page);
  });

  test('shows the panel of a selected task with a control for every attribute', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'Review order' });
    await select(page, id);
    const panel = page.getByTestId('attribute-panel');
    for (const key of [
      'Name',
      'Description',
      'Priority',
      'Owner',
      'Effort',
      'Cost',
      'Due',
      'Duration',
      'Tags',
      'Checklist',
      'Spec',
      'OpenSpec',
    ])
      await expect(panel.getByTestId(`field-${key}`)).toBeVisible();
  });

  test('edits text and shows it in the shape within 50 ms, as one undo step', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'Old' });
    await select(page, id);
    const input = page.getByTestId('field-Name').locator('input');
    await input.fill('New label');
    // Time from committing the edit to the frame that shows it.
    const ms = await page.evaluate(
      (target) =>
        new Promise<number>((resolve) => {
          const hook = (window as unknown as { __metakit: Hook }).__metakit;
          const el = document.querySelector<HTMLInputElement>(
            '[data-testid="field-Name"] input',
          )!;
          const t0 = performance.now();
          hook.view.onFrame = () => {
            if (hook.scene.elements.get(target)!.label === 'New label') {
              hook.view.onFrame = null;
              resolve(performance.now() - t0);
            }
          };
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
          );
        }),
      id,
    );
    expect(ms).toBeLessThan(50);
    expect((await attrsOf(page, id))['att_name']).toBe('New label');
    // The field keeps Ctrl+Z for its own text; the Undo button reverses the whole edit.
    await page.getByRole('button', { name: 'Undo' }).click();
    expect((await attrsOf(page, id))['att_name']).toBe('Old');
  });

  test('edits choice, number, date, duration, multi-choice and link values', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'T' });
    await select(page, id);

    await page
      .getByTestId('field-Priority')
      .getByRole('radio', { name: 'High' })
      .click();
    expect((await attrsOf(page, id))['att_priority']).toBe('High');

    const effort = page.getByTestId('field-Effort').locator('input');
    await effort.fill('2,5');
    await effort.press('Enter');
    expect((await attrsOf(page, id))['att_effort']).toBe(2.5);
    await effort.fill('abc');
    await effort.press('Enter');
    await expect(page.getByTestId('field-Effort')).toContainText(
      'not a number',
    );
    expect((await attrsOf(page, id))['att_effort']).toBe(2.5);
    await effort.fill('-3');
    await effort.press('Enter');
    await expect(page.getByTestId('field-Effort')).toContainText('at least 0');
    await effort.fill('');
    await effort.press('Enter');
    expect((await attrsOf(page, id))['att_effort']).toBeNull();

    await page.getByTestId('field-Due').locator('input').fill('2026-11-01');
    expect((await attrsOf(page, id))['att_due']).toBe('2026-11-01');

    const duration = page.getByTestId('field-Duration');
    await duration.getByLabel('Hours').fill('2');
    await duration.getByLabel('Minutes').fill('30');
    await duration.getByLabel('Minutes').press('Enter');
    expect((await attrsOf(page, id))['att_duration']).toBe('PT2H30M');

    const tags = page.getByTestId('field-Tags');
    await tags.getByRole('button', { name: 'Legal' }).click();
    await tags.getByRole('button', { name: 'Finance' }).click();
    expect((await attrsOf(page, id))['att_tags']).toEqual(['Legal', 'Finance']);
    await tags.getByRole('button', { name: 'Legal' }).click();
    expect((await attrsOf(page, id))['att_tags']).toEqual(['Finance']);

    const link = page.getByTestId('field-Spec').locator('input');
    await link.fill('https://example.org/spec');
    await link.press('Enter');
    expect((await attrsOf(page, id))['att_spec']).toBe(
      'https://example.org/spec',
    );
    await expect(
      page.getByTestId('field-Spec').getByRole('link', { name: 'Open link' }),
    ).toBeVisible();
  });

  test('keeps what is being typed when the panel is refreshed by validation', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'T' });
    await select(page, id);
    const input = page.getByTestId('field-Name').locator('input');
    await input.fill('half typed');
    // Another change makes validation run again, which rebuilds the panel.
    await create(page, 'cls_task', { att_name: 'Other' }, 500, 300);
    await page.waitForTimeout(500);
    await expect(input).toHaveValue('half typed');
    await input.press('Enter');
    expect((await attrsOf(page, id))['att_name']).toBe('half typed');
  });

  test('shows formulas read-only and buttons ready to press', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'T' });
    await select(page, id);
    await expect(
      page.getByTestId('field-Cost').locator('output'),
    ).toBeVisible();
    await expect(
      page.getByTestId('field-OpenSpec').getByRole('button'),
    ).toBeEnabled();
  });

  test('edits a table in an inline grid and accepts rows pasted from a spreadsheet', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'T' });
    await select(page, id);
    const grid = page.getByTestId('table-Checklist');
    await grid.getByRole('button', { name: 'Add row' }).click();
    await grid.getByLabel('Item').first().fill('Call customer');
    await grid.getByLabel('Item').first().press('Tab');
    await grid.getByLabel('Done').first().check();
    expect((await attrsOf(page, id))['att_checklist']).toEqual([
      { item: 'Call customer', done: true },
    ]);

    // Two rows pasted into the first cell of the second row: tab-separated, as Excel copies them.
    await grid.getByRole('button', { name: 'Add row' }).click();
    await grid.getByLabel('Item').nth(1).focus();
    await page.evaluate(() => {
      const cell = document.querySelector<HTMLInputElement>(
        '[data-row="1"][data-col="0"] input',
      )!;
      const data = new DataTransfer();
      data.setData('text/plain', 'Send quote\tyes\nWait for answer\tno\n');
      cell.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect((await attrsOf(page, id))['att_checklist']).toEqual([
      { item: 'Call customer', done: true },
      { item: 'Send quote', done: true },
      { item: 'Wait for answer', done: false },
    ]);
  });

  test('picks a reference by searching and can open it', async ({ page }) => {
    const lane = await create(
      page,
      'cls_lane',
      { att_lanename: 'Sales' },
      0,
      300,
    );
    const task = await create(page, 'cls_task', { att_name: 'T' });
    await select(page, task);
    const owner = page.getByTestId('reference-Owner');
    await owner.getByRole('searchbox').fill('sal');
    await owner.getByRole('option', { name: /Sales/ }).click();
    expect(
      ((await attrsOf(page, task))['att_owner'] as { element: string }[])[0]!
        .element,
    ).toBe(lane);
    await expect(owner).toContainText('Sales');
    await owner.getByRole('button', { name: 'Open' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const sel = (window as unknown as { __metakit: Hook }).__metakit
            .editor.selection as {
            elements: Set<string>;
          };
          return [...sel.elements];
        }),
      )
      .toEqual([lane]);
    // The task allows one owner, so the search box is gone once one is chosen.
    await select(page, task);
    await expect(owner.getByRole('searchbox')).toHaveCount(0);
  });

  test('edits one attribute across several selected objects, with a dash for mixed values', async ({
    page,
  }) => {
    const a = await create(
      page,
      'cls_task',
      { att_name: 'A', att_priority: 'Low' },
      100,
      100,
    );
    const b = await create(
      page,
      'cls_task',
      { att_name: 'B', att_priority: 'High' },
      400,
      100,
    );
    const gate = await create(page, 'cls_gateway', { att_name: 'G' }, 700, 100);
    await select(page, a, b);
    const priority = page.getByTestId('field-Priority');
    await expect(priority).toContainText('differs');
    await expect(priority.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(
      page.getByTestId('field-Name').locator('input'),
    ).toHaveAttribute('placeholder', '—');
    await priority.getByRole('radio', { name: 'Medium' }).click();
    expect((await attrsOf(page, a))['att_priority']).toBe('Medium');
    expect((await attrsOf(page, b))['att_priority']).toBe('Medium');
    // One undo step reverses both.
    await page.keyboard.press('Control+z');
    expect((await attrsOf(page, a))['att_priority']).toBe('Low');
    expect((await attrsOf(page, b))['att_priority']).toBe('High');
    // A task and a gateway share only the attributes of their common parent.
    await select(page, a, gate);
    await expect(page.getByTestId('field-Name')).toBeVisible();
    await expect(page.getByTestId('field-Priority')).toHaveCount(0);
  });

  test('shows validation messages under the attribute they belong to', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'T' });
    await select(page, id);
    const name = page.getByTestId('field-Name').locator('input');
    await name.fill('');
    await name.press('Enter');
    await expect(page.getByTestId('field-Name')).toContainText(
      /required|empty|fill/i,
    );
    await name.fill('Back again');
    await name.press('Enter');
    await expect(page.getByTestId('field-Name').getByRole('alert')).toHaveCount(
      0,
    );
  });

  test('edits the text of an object on the canvas with a double click', async ({
    page,
  }) => {
    const id = await create(page, 'cls_task', { att_name: 'Before' }, 100, 100);
    await page.evaluate(() => {
      (
        window as unknown as { __metakit: { view: { fit(): void } } }
      ).__metakit.view.fit();
    });
    const c = await page.evaluate((target) => {
      const hook = (
        window as unknown as {
          __metakit: {
            scene: {
              elements: Map<
                string,
                { x: number; y: number; w: number; h: number }
              >;
            };
            view: {
              toScreenFromWorld(p: { x: number; y: number }): {
                x: number;
                y: number;
              };
            };
          };
        }
      ).__metakit;
      const e = hook.scene.elements.get(target)!;
      return hook.view.toScreenFromWorld({
        x: e.x + e.w / 2,
        y: e.y + e.h / 2,
      });
    }, id);
    const box = (await page.getByTestId('canvas-host').boundingBox())!;
    await page.mouse.dblclick(box.x + c.x, box.y + c.y);
    const editor = page.getByTestId('label-editor');
    await expect(editor).toBeVisible();
    await editor.fill('After');
    await page.getByTestId('model-name').click();
    await expect(editor).toHaveCount(0);
    expect((await attrsOf(page, id))['att_name']).toBe('After');
  });

  test('finds elements by name or attribute value and jumps to them', async ({
    page,
  }) => {
    const a = await create(
      page,
      'cls_task',
      { att_name: 'Check order', att_description: 'Look at the invoice' },
      100,
      100,
    );
    await create(page, 'cls_task', { att_name: 'Ship goods' }, 3000, 2000);
    await page.getByTestId('find-input').fill('invoice');
    await expect(page.getByTestId('find-results')).toContainText('Check order');
    await page.getByTestId('find-results').getByRole('button').first().click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const sel = (window as unknown as { __metakit: Hook }).__metakit
            .editor.selection as {
            elements: Set<string>;
          };
          return [...sel.elements];
        }),
      )
      .toEqual([a]);
    await page.getByTestId('find-input').fill('ship');
    await page.getByTestId('find-results').getByRole('button').first().click();
    // The view moved to the far element.
    const centred = await page.evaluate(() => {
      const h = (
        window as unknown as {
          __metakit: { view: { view: { s: number; ox: number; oy: number } } };
        }
      ).__metakit;
      return h.view.view;
    });
    expect(centred.ox).toBeLessThan(-1000);
  });
});
