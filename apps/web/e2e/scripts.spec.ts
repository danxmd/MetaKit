import { expect, test } from '@playwright/test';
import { bundleWorker, loadHarness } from './bundle';
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

// The section in the app (list, editor, console, permissions) needs the wiring of the lead.
// enabled by the lead after wiring
test.describe.skip('the scripts section in Build mode', () => {
  test('adds a script, edits it, runs its command and shows the console', async ({
    page,
  }) => {
    await page.goto('/MetaKit/');
    await page.getByTestId('script-add').click();
    await expect(page.getByTestId('script-editor')).toBeVisible();
    await expect(page.getByTestId('script-run')).toBeVisible();
    await page.getByTestId('script-run').click();
    await expect(page.getByTestId('console-lines')).toContainText('objects');
  });

  test('asks for permission once per tool', async ({ page }) => {
    await page.goto('/MetaKit/');
    await expect(page.getByTestId('permission-dialog')).toBeVisible();
    await page.getByTestId('permission-allow').click();
    await expect(page.getByTestId('permission-dialog')).toBeHidden();
  });
});
