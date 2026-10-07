import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// What this shows, from a real browser against the real gitlab.com and no token:
// - the browser may call the API with an Authorization header (CORS preflight passes);
// - an error response is readable by the page (so a bad token gives a clear message);
// - the pagination headers are exposed, so reading a tree across pages works;
// - the OAuth token endpoint can be called from a page.
test('gitlab.com from a real browser, read-only and without a token', async ({
  page,
}) => {
  await page.goto('/?provider=gitlab');
  await page.fill('#repo', 'gitlab-org/gitlab-foss');
  await page.fill('#branch', 'master');

  await page.fill('#token', 'glpat-not-a-real-token-for-cors-check');
  await page.click('#cors');
  await expect(page.locator('#log')).toContainText('OAuth token endpoint', {
    timeout: 30_000,
  });
  const cors = await page.locator('#log').innerText();

  await page.fill('#token', '');
  await page.click('#tree');
  await expect(page.locator('#log')).toContainText('files on', {
    timeout: 60_000,
  });
  const all = await page.locator('#log').innerText();
  mkdirSync('results', { recursive: true });
  writeFileSync('results/live-gitlab.txt', `${all}\n`);
  console.log(`\n${all}\n`);
  expect(cors).toContain('The browser could call');
  // A recursive listing starts with directories, so the first 500 entries contain no files.
  expect(all).toMatch(/files on 5 page\(s\) \(500 entries read\)/);
});
