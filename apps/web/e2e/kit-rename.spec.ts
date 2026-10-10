import { expect, test, type Page } from '@playwright/test';
import { canvasPoint, model, prepare, workspaceBeforeKitRename } from './app';
import { loadHarness } from './bundle';

// Workspaces and repositories written before the Kit rename (ADR 0011) keep working: the Kit stays
// in tools/ with its tool.json, and new Kits go to kits/.

/** Every file of the workspace folder (in the browser's private file system) with its text. */
const folderFiles = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const top = await root.getDirectoryHandle(
      sessionStorage.getItem('e2e-folder')!,
    );
    const out: Record<string, string> = {};
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const [name, handle] of (
        dir as unknown as {
          entries(): AsyncIterable<[string, FileSystemHandle]>;
        }
      ).entries()) {
        const path = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === 'directory')
          await walk(handle as FileSystemDirectoryHandle, path);
        else
          try {
            out[path] = await (
              await (handle as FileSystemFileHandle).getFile()
            ).text();
          } catch {
            // The app folded its own change file into a snapshot while this was reading.
          }
      }
    };
    await walk(top, '');
    return out;
  });

const files = async (page: Page) => Object.keys(await folderFiles(page)).sort();

test.describe('data from before the Kit rename', () => {
  test('opens an older workspace, edits its model, and makes a new Kit in kits/', async ({
    page,
  }) => {
    const seeded = workspaceBeforeKitRename();
    await prepare(page, { layout: 'before-kit-rename' });
    expect(await files(page)).toEqual(Object.keys(seeded).sort());

    await page.getByTestId('open-folder').click();
    await page
      .getByRole('button', { name: 'Order process', exact: true })
      .click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    const before = await model(page);
    const count = Object.keys(before.elements).length;
    expect(count).toBeGreaterThan(0);

    await page.getByTestId('palette-class-Task').click();
    const p = await canvasPoint(page, 640, 420);
    await page.mouse.click(p.x, p.y);
    await expect
      .poll(async () => Object.keys((await model(page)).elements).length)
      .toBe(count + 1);
    await expect(page.getByTestId('save-status')).toHaveText('Saved');

    // The change is in this instance's own files next to the old ones, which are untouched.
    const contents = await folderFiles(page);
    for (const [path, text] of Object.entries(seeded))
      expect(contents[path]).toBe(text);
    const after = Object.keys(contents);
    expect(
      after.some((p) => p.startsWith('models/order-process-old1/_state/')),
    ).toBe(true);
    expect(after.some((p) => p.startsWith('kits/'))).toBe(false);

    // A reload reads it back.
    await page.reload();
    await page.getByTestId('open-folder').click();
    await page
      .getByRole('button', { name: 'Order process', exact: true })
      .click();
    await expect(page.getByTestId('model-view')).toBeVisible();
    expect(Object.keys((await model(page)).elements)).toHaveLength(count + 1);

    // Build mode lists the older Kit, and a new Kit goes to kits/.
    await page.getByTestId('back-to-explorer').click();
    await page.getByTestId('mode-build').click();
    await expect(page.getByTestId('kits-page')).toContainText('BPMN lite');
    await page.getByTestId('new-kit').click();
    await page.getByTestId('new-kit-name').fill('Fresh notation');
    await page.getByTestId('new-kit-create').click();
    await expect(page.getByTestId('build-view')).toBeVisible();
    const made = await files(page);
    expect(made).toContain('kits/fresh-notation/kit.json');
    expect(made.filter((p) => p.startsWith('tools/bpmn-lite/'))).toEqual(
      expect.arrayContaining(
        Object.keys(seeded).filter((p) => p.startsWith('tools/')),
      ),
    );
    const identity = JSON.parse(
      (await folderFiles(page))['kits/fresh-notation/kit.json']!,
    ) as { formatVersion: number; kind: string; id: string };
    expect(identity).toMatchObject({ formatVersion: 2, kind: 'kit' });
    expect(identity.id).toMatch(/^kit_/);
  });

  test('pulls from a repository with tool.json and commits it as kit.json', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      sessionStorage.setItem('e2e-git-layout', 'before-kit-rename'),
    );
    await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
    await loadHarness(page, './git-harness.ts');
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { __git: { paths(): Promise<string[]> } }
        ).__git.paths(),
      ),
    ).toContain('tool.json');
    await page.getByTestId('open-folder').click();
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await page.getByTestId('mode-build').click();
    await page.getByTestId('add-menu').locator('summary').click();
    await page.getByTestId('open-git').click();
    await page.getByTestId('git-token-label').fill('Test token');
    await page.getByTestId('git-token-value').fill('not-a-real-token');
    await page.getByTestId('git-token-add').click();
    await page.getByTestId('git-choose-repo').fill('acme/kits');
    await page.getByTestId('git-test').click();
    await expect(page.getByTestId('git-test-result')).toBeVisible();
    await page.getByTestId('git-choose').click();
    await expect(page.getByTestId('build-view')).toBeVisible();

    // Someone on an older release changes the settings in tool.json; the pull takes it in.
    await page.evaluate(() =>
      (
        window as unknown as {
          __git: {
            otherWriterEdits(
              path: string,
              change: (json: Record<string, unknown>) => void,
              message: string,
            ): Promise<void>;
          };
        }
      ).__git.otherWriterEdits(
        'tool.json',
        (json) => {
          (json['manifest'] as Record<string, unknown>)['version'] = '1.1.0';
        },
        'Older release',
      ),
    );
    await page.getByTestId('git-menu-summary').click();
    await page.getByTestId('git-pull').click();
    await expect(page.getByTestId('git-note')).toContainText('Pulled');

    // The commit renames tool.json to kit.json.
    await page.getByTestId('git-menu-summary').click();
    await page.getByTestId('git-commit').click();
    await expect(page.getByTestId('commit-change')).toContainText(
      'renamed from tool.json',
    );
    await page.getByTestId('commit-message').fill('Use kit.json');
    await page.getByTestId('commit-confirm').click();
    await expect(page.getByTestId('git-note')).toContainText('Committed');
    const paths = await page.evaluate(() =>
      (
        window as unknown as { __git: { paths(): Promise<string[]> } }
      ).__git.paths(),
    );
    expect(paths).toContain('kit.json');
    expect(paths).not.toContain('tool.json');
    const head = await page.evaluate(() =>
      (
        window as unknown as {
          __git: { file(path: string): Promise<string | undefined> };
        }
      ).__git.file('kit.json'),
    );
    expect(head).toContain('"version": "1.1.0"');
  });
});
