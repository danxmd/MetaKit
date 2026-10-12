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
