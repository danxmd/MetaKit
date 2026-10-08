import { expect, test } from '@playwright/test';

const appUrl = '/MetaKit/';

test('shows the start page without a browser warning in Chromium', async ({
  page,
}) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(appUrl);
  await expect(page.getByTestId('start-page')).toBeVisible();
  await expect(page.getByTestId('open-folder')).toBeVisible();
  await expect(page.getByTestId('unsupported-browser')).toHaveCount(0);
  expect(failed).toEqual([]);
});

// Stands in for Firefox and Safari, which CI does not run.
test('explains that local folders need Chrome or Edge when the API is missing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  });
  await page.goto(appUrl);
  await expect(page.getByTestId('start-page')).toBeVisible();
  await expect(page.getByTestId('unsupported-browser')).toContainText(
    'Chrome or Edge',
  );
});
