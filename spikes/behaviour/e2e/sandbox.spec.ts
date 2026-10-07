import { expect, test } from '@playwright/test';

test('QuickJS and the compiler are not requested until the sandbox is asked for', async ({
  page,
}) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/');
  // The formula part works without the sandbox.
  await page.click('#evaluate');
  await expect(page.locator('#formula-out')).toHaveText('123');
  const early = urls.filter((u) => /wasm|quickjs|sucrase|sandbox/i.test(u));
  expect(early).toEqual([]);

  await page.click('#load');
  await expect(page.locator('#status')).toContainText('loaded in');
  const late = urls.filter((u) => /\.wasm/i.test(u));
  expect(late.length).toBe(1);
});

test('a before handler cancels the action in the browser', async ({ page }) => {
  await page.goto('/');
  await page.click('#load');
  await expect(page.locator('#run')).toBeEnabled();
  await page.click('#run');
  await expect(page.locator('#script-out')).toContainText(
    'Cancelled: Locked elements cannot be deleted',
  );
  expect(
    await page.evaluate(() =>
      (
        window as never as { __behaviour: { elements(): string[] } }
      ).__behaviour.elements(),
    ),
  ).toEqual(['el_1']);
});

test('a script error is reported, not thrown into the page', async ({
  page,
}) => {
  await page.goto('/');
  await page.fill('#script', 'on((');
  await page.click('#load');
  await expect(page.locator('#status')).toContainText('script error');
});

test('formula errors are shown as messages', async ({ page }) => {
  await page.goto('/');
  await page.fill('#formula', '__proto__');
  await page.click('#evaluate');
  await expect(page.locator('#formula-out')).toContainText('forbidden');
});
