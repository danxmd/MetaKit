import { expect, test } from '@playwright/test';
import { prepare } from './app';

test.describe('the assistant', () => {
  test('is off until turned on, keeps the key in this browser and shows what is sent', async ({
    page,
  }) => {
    await prepare(page, { name: 'Anna', colour: '#e8590c' });
    await page.getByTestId('open-folder').click();
    await page.getByTestId('settings-menu').locator('summary').click();
    await page.getByTestId('open-assistant').click();

    await expect(page.getByTestId('assistant-enabled')).not.toBeChecked();
    await expect(page.getByTestId('assistant-notice')).toContainText(
      'never models',
    );

    await page.getByTestId('assistant-enabled').check();
    await page.getByTestId('assistant-key').fill('sk-ant-not-a-real-key');
    await page.getByTestId('assistant-save').click();
    await expect(page.getByTestId('assistant-key-state')).toBeVisible();

    // The key is in this browser's IndexedDB only: not in page text, local storage or the workspace.
    await expect(page.locator('body')).not.toContainText('sk-ant-not-a-real');
    const leaked = await page.evaluate(async () => {
      const storage = JSON.stringify([
        ...Object.entries(localStorage),
        ...Object.entries(sessionStorage),
      ]);
      const root = await navigator.storage.getDirectory();
      const found: string[] = [];
      const walk = async (dir: FileSystemDirectoryHandle) => {
        for await (const [, handle] of (
          dir as unknown as {
            entries(): AsyncIterable<
              [string, FileSystemFileHandle | FileSystemDirectoryHandle]
            >;
          }
        ).entries()) {
          if (handle.kind === 'directory') await walk(handle);
          else if ((await (await handle.getFile()).text()).includes('sk-ant'))
            found.push(handle.name);
        }
      };
      await walk(root);
      return { inStorage: storage.includes('sk-ant'), inFiles: found };
    });
    expect(leaked.inStorage).toBe(false);
    expect(leaked.inFiles).toEqual([]);

    await page.getByTestId('assistant-remove').click();
    await expect(page.getByTestId('assistant-key')).toBeVisible();
  });
});
