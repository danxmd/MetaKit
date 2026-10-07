import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { newModel, prepare } from './app';
import { bundleWorker, loadHarness } from './bundle';
import { chooseFromMenu } from './menus';
import type { ScriptsHarness } from './scripts-harness';

declare global {
  interface Window {
    __scripts: ScriptsHarness;
  }
}

/** The plan's script, word for word. */
const RENUMBER = `import { on, model, ui, commands } from "metakit";

function renumberTasks(): void {
  const tasks = model.objects("Task").sort((a, b) => a.y - b.y || a.x - b.x);
  tasks.forEach((task, index) => {
    task.attrs.Number = index + 1;
  });
}

on("object.created", { class: "Task" }, () => renumberTasks());
on("object.moved", { class: "Task" }, () => renumberTasks());

commands.register({
  id: "renumber-tasks",
  label: "Renumber tasks",
  menu: "Model",
  run: () => {
    renumberTasks();
    ui.message(\`Renumbered \${model.objects("Task").length} tasks.\`);
  },
});
`;

// The editor core (CodeMirror and the TypeScript language service in a Web Worker) runs in a real
// browser here, without the Svelte wrapper.
test.describe('the script editor', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await loadHarness(page, './scripts-harness.ts');
    const worker = await bundleWorker(
      '../../../packages/ui/src/components/build/scripts/script-language-worker.ts',
    );
    await page.evaluate(
      ([w, source]) => window.__scripts.open(w!, source!),
      [worker, RENUMBER],
    );
  });

  test('shows the script with line numbers and no problems for the plan script', async ({
    page,
  }) => {
    await expect(page.locator('.cm-lineNumbers')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('renumberTasks');
    // Give the language service time to look; a correct script gets no error marks.
    await page.waitForTimeout(1500);
    await expect(page.locator('.cm-lint-marker-error')).toHaveCount(0);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
  });

  test('marks a wrong value for a choice attribute and says why', async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.__scripts.type(
        '\nmodel.objects("Task")[0]!.attrs.Priority = "Urgent";\n',
      ),
    );
    await expect(page.locator('.cm-lintRange-error').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.cm-lint-marker-error').first()).toBeVisible();
  });

  test('completes the attributes of a task and the values of a choice', async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.__scripts.type('\nconst t = model.objects("Task")[0]!;\nt.attrs.'),
    );
    await page.evaluate(() => window.__scripts.complete());
    const list = page.locator('.cm-tooltip-autocomplete');
    await expect(list).toContainText('Priority', { timeout: 15_000 });
    await expect(list).toContainText('Effort');
    await expect(list).not.toContainText('GatewayKind');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__scripts.type('Priority = "'));
    await page.evaluate(() => window.__scripts.complete());
    await expect(page.locator('.cm-tooltip-autocomplete')).toContainText(
      'Medium',
      { timeout: 15_000 },
    );
  });

  test('shows the type of an attribute when the mouse rests on it', async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.__scripts.type(
        '\nconst t = model.objects("Task")[0]!;\nt.attrs.Priority;\n',
      ),
    );
    await page.waitForTimeout(500);
    const at = await page.evaluate(() => window.__scripts.where('Priority'));
    await page.mouse.move(at.x - 20, at.y);
    await page.mouse.move(at.x, at.y, { steps: 4 });
    await expect(page.locator('.cm-tooltip-hover')).toContainText('"Low"', {
      timeout: 15_000,
    });
  });

  test('reports edits to its owner', async ({ page }) => {
    await page.evaluate(() => window.__scripts.type('// hello\n'));
    const changes = await page.evaluate(() => window.__scripts.changes());
    expect(changes.at(-1)).toContain('// hello');
  });
});

/** The bpmn-lite tool with one script that adds a command, and a request to use the network. */
function scriptedTool(): string {
  const tool = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL('../../../tools/bpmn-lite/tool.json', import.meta.url),
      ),
      'utf8',
    ),
  ) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test-only edit of a JSON document
  tool.manifest.permissions = { network: true };
  tool.scripts = {
    scr_hello: {
      id: 'scr_hello',
      name: 'Hello',
      source: `import { ui, model, commands } from "metakit";
console.log("scripts loaded");
commands.register({
  id: "hello",
  label: "Say hello from a script",
  menu: "Model",
  run: () => ui.message(\`There are \${model.objects().length} objects.\`),
});
`,
    },
  };
  return JSON.stringify(tool);
}

test.describe('scripts in the app', () => {
  test('ask for permission once, then add a command that runs in the sandbox', async ({
    page,
  }) => {
    await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
    await loadHarness(page, './seed-harness.ts');
    await page.evaluate(
      (json) =>
        (window as unknown as { __seed(t: string): Promise<void> }).__seed(
          json,
        ),
      scriptedTool(),
    );
    await page.reload();
    await newModel(page, 'Scripted');

    await expect(page.getByTestId('permission-dialog')).toBeVisible();
    await page.getByTestId('permission-allow').click();
    await expect(page.getByTestId('permission-dialog')).toBeHidden();

    await page.getByTestId('commands-menu').locator('summary').click();
    await page
      .getByRole('button', { name: 'Say hello from a script' })
      .click({ timeout: 30_000 });
    await expect(page.getByTestId('behaviour-message')).toContainText(
      'There are 0 objects.',
    );

    await chooseFromMenu(page, 'Check', 'console-toggle');
    await expect(page.getByTestId('console-lines')).toContainText(
      'scripts loaded',
    );
  });
});
