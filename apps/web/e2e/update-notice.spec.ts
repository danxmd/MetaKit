import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { prepare } from './app';

// The version the app was built with (vite.config.ts reads the same file).
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const release = (v: string) => ({
  version: v,
  url: `https://github.com/danxmd/MetaKit/releases/tag/v${v}`,
});

test.describe('update notice', () => {
  test('the footer shows the version', async ({ page }) => {
    await prepare(page, { seed: false });
    await expect(page.getByTestId('app-version')).toHaveText(version);
  });

  test('a newer release shows the notice with a link to it', async ({
    page,
  }) => {
    await prepare(page, { seed: false, latestRelease: release('999.0.0') });
    const notice = page.getByTestId('start-page').getByTestId('update-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('update-notice-text')).toHaveText(
      `MetaKit 999.0.0 is available (you have ${version}).`,
    );
    const link = page.getByTestId('update-notice-link');
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/danxmd/MetaKit/releases/tag/v999.0.0',
    );
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('the notice stays above an opened workspace', async ({ page }) => {
    await prepare(page, { latestRelease: release('999.0.0') });
    await page.getByTestId('open-folder').click();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(
      page.getByTestId('app-shell').getByTestId('update-notice'),
    ).toBeVisible();
  });

  test('Dismiss hides it, also after a reload', async ({ page }) => {
    await prepare(page, { seed: false, latestRelease: release('999.0.0') });
    await page.getByTestId('update-notice-dismiss').click();
    await expect(page.getByTestId('update-notice')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('start-page')).toBeVisible();
    // Nothing marks the end of the check, which here reads only storage: give it a moment.
    await page.waitForTimeout(500);
    await expect(page.getByTestId('update-notice')).toHaveCount(0);
  });

  for (const [what, v] of [
    ['the same', version],
    ['an older', '0.0.1'],
  ] as const)
    test(`${what} version shows nothing`, async ({ page }) => {
      await prepare(page, { seed: false, latestRelease: release(v) });
      await expect(page.getByTestId('start-page')).toBeVisible();
      // The check is asynchronous: give it time to answer before looking.
      await page.waitForFunction(
        () => localStorage.getItem('metakit.updateCheck') !== null,
      );
      await expect(page.getByTestId('update-notice')).toHaveCount(0);
    });
});
