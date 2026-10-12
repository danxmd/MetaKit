import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { newModel, prepare } from './app';
import { loadHarness } from './bundle';

/** The bpmn-lite Kit with two command rules: a toolbar button and a context menu entry. */
function commandKit(): string {
  const kit = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL('../../../kits/bpmn-lite/kit.json', import.meta.url),
      ),
      'utf8',
    ),
  ) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test-only edit of a JSON document
  kit.rules = {
    rule_hello: {
      id: 'rule_hello',
      label: 'Say hello',
      when: { event: 'command' },
      then: [{ action: 'message', kind: 'info', text: 'Hello from a rule.' }],
      command: { label: 'Say hello', place: 'toolbar' },
    },
    rule_context: {
      id: 'rule_context',
      label: 'Say hi here',
      when: { event: 'command' },
      then: [{ action: 'message', kind: 'info', text: 'Hi from the menu.' }],
      command: { label: 'Say hi here', place: 'context' },
    },
  };
  return JSON.stringify(kit);
}

test('commands from rules appear in the toolbar and the context menu', async ({
  page,
}) => {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await loadHarness(page, './seed-harness.ts');
  await page.evaluate(
    (json) =>
      (window as unknown as { __seed(t: string): Promise<void> }).__seed(json),
    commandKit(),
  );
  await page.reload();
  await newModel(page, 'Commands');

  await page.getByTestId('command-rule_hello').click();
  await expect(page.getByTestId('behaviour-message')).toContainText(
    'Hello from a rule.',
  );

  await page.getByTestId('canvas-host').click({
    button: 'right',
    position: { x: 300, y: 200 },
  });
  await page.getByTestId('command-rule_context').click();
  await expect(page.getByTestId('behaviour-message').last()).toContainText(
    'Hi from the menu.',
  );
});

test('a right drag pans without opening the context menu; a right click still opens it', async ({
  page,
}) => {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await loadHarness(page, './seed-harness.ts');
  await page.evaluate(
    (json) =>
      (window as unknown as { __seed(t: string): Promise<void> }).__seed(json),
    commandKit(),
  );
  await page.reload();
  await newModel(page, 'Commands');
  const box = (await page.getByTestId('canvas-host').boundingBox())!;
  const x = box.x + 300;
  const y = box.y + 200;
  const menu = page.getByTestId('context-menu');

  // Windows and Linux order: the browser sends the menu event after the button goes up.
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 80, y + 40, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await expect(menu).toHaveCount(0);

  await page.mouse.click(x, y, { button: 'right' });
  await expect(menu).toBeVisible();
  await page.mouse.click(box.x + 10, box.y + 10);
  await expect(menu).toHaveCount(0);

  // macOS order: the menu event comes on press, so the menu waits for the button to go up.
  const pressThenMenu = async (dx: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down({ button: 'right' });
    await page.evaluate(
      ([cx, cy]) =>
        document.elementFromPoint(cx!, cy!)!.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
            button: 2,
          }),
        ),
      [x, y],
    );
    await expect(menu).toHaveCount(0);
    if (dx !== 0) await page.mouse.move(x + dx, y, { steps: 5 });
    // Release without a second native menu event, as macOS does.
    await page.evaluate(() => {
      const swallow = (e: Event) => {
        if (!e.isTrusted) return;
        e.stopImmediatePropagation();
        window.removeEventListener('contextmenu', swallow, true);
      };
      window.addEventListener('contextmenu', swallow, true);
    });
    await page.mouse.up({ button: 'right' });
  };
  await pressThenMenu(60);
  await expect(menu).toHaveCount(0);
  await pressThenMenu(0);
  await expect(menu).toBeVisible();
});
