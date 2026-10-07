import { expect, test, type Page } from '@playwright/test';
import { startMockGitHub, type MockGitHub } from '../mock/github';
import { startMockGitLab, type MockGitLab } from '../mock/gitlab';

// The page runs on localhost:4177 and the mocks on other ports, so Chromium applies its real
// cross-origin rules (preflight, exposed headers) to every call.
const GH_TOKEN = 'ghp_TESTONLYnotarealtokenABCDEFGH1234567890';
const GL_TOKEN = 'glpat-TESTONLY-notarealtoken-1234';

const log = (page: Page) => page.locator('#log');

async function fill(page: Page, values: Record<string, string>) {
  for (const [id, value] of Object.entries(values))
    await page.fill(`#${id}`, value);
}

test.describe('GitHub in the browser', () => {
  let mock: MockGitHub;
  test.beforeEach(async () => {
    mock = await startMockGitHub();
  });
  test.afterEach(async () => {
    await mock.close();
  });

  test('CORS check, tree, full check, and the token never shows up', async ({
    page,
  }) => {
    await page.goto(`/?provider=github&ghBase=${encodeURIComponent(mock.url)}`);
    await fill(page, { repo: 'o/r', token: GH_TOKEN });
    await page.click('#cors');
    await expect(log(page)).toContainText('The browser could call');
    await page.click('#tree');
    await expect(log(page)).toContainText('1 files at');
    await page.click('#check');
    await expect(log(page)).toContainText('ALL STEPS PASSED', {
      timeout: 15_000,
    });
    await expect(log(page)).toContainText(
      'stale update is refused: 422: Update is not a fast forward',
    );
    await expect(log(page)).toContainText('cleaned up');
    expect(await page.evaluate(() => document.body.innerText)).not.toContain(
      GH_TOKEN,
    );
    for (const r of mock.requests) {
      expect(r.url).not.toContain(GH_TOKEN);
      expect(r.body).not.toContain(GH_TOKEN);
    }
    // Reloading forgets the token: nothing was stored.
    await page.reload();
    expect(
      await page.evaluate(() =>
        JSON.stringify([localStorage, sessionStorage, document.cookie]),
      ),
    ).not.toContain('TESTONLY');
    await expect(page.locator('#token')).toHaveValue('');
  });

  test('shows the server text when a token is rejected, without the token', async ({
    page,
  }) => {
    await page.goto(`/?provider=github&ghBase=${encodeURIComponent(mock.url)}`);
    await fill(page, { repo: 'o/r', token: 'wrong-token-value-123' });
    await page.click('#tree');
    await expect(log(page)).toContainText('Bad credentials');
    expect(await log(page).innerText()).not.toContain('wrong-token-value-123');
  });
});

test.describe('GitLab in the browser', () => {
  let mock: MockGitLab;
  test.beforeEach(async () => {
    mock = await startMockGitLab({ seedFiles: 12, pageSize: 5 });
  });
  test.afterEach(async () => {
    await mock.close();
  });

  test('CORS check (API and token endpoint), tree with pages, full check', async ({
    page,
  }) => {
    await page.goto(`/?provider=gitlab&glBase=${encodeURIComponent(mock.url)}`);
    await fill(page, { repo: 'group/project', token: GL_TOKEN });
    await page.click('#cors');
    await expect(log(page)).toContainText(
      'The browser could call the OAuth token endpoint',
    );
    await page.click('#tree');
    await expect(log(page)).toContainText('12 files on 3 page(s)');
    await page.click('#check');
    await expect(log(page)).toContainText('ALL STEPS PASSED', {
      timeout: 15_000,
    });
    await expect(log(page)).toContainText(
      'changed since you started editing it',
    );
    expect(await page.evaluate(() => document.body.innerText)).not.toContain(
      GL_TOKEN,
    );
    for (const r of mock.requests) expect(r.url).not.toContain(GL_TOKEN);
  });

  test('signs in with PKCE and then uses the token it got', async ({
    page,
  }) => {
    await page.goto(`/?provider=gitlab&glBase=${encodeURIComponent(mock.url)}`);
    await fill(page, { repo: 'group/project', client: 'app-123' });
    await page.click('#signin');
    await expect(log(page)).toContainText('Signed in.', { timeout: 10_000 });
    expect(page.url()).not.toContain('code=');
    const token = await page.inputValue('#token');
    expect(token).toMatch(/^glpat-oauth-/);
    // The token is on the page's field only; the visible log never prints it.
    expect(await log(page).innerText()).not.toContain(token);
    const exchange = mock.requests.find((r) => r.url === '/oauth/token')!;
    expect(exchange.body).toContain('code_verifier=');
    expect(exchange.body).not.toContain('client_secret');
    await page.click('#tree');
    await expect(log(page)).toContainText('12 files');
    expect(mock.requests.at(-1)!.auth).toBe(`Bearer ${token}`);
  });
});

test.describe('when the server sends no CORS headers', () => {
  test('the browser blocks the call and the page says so', async ({ page }) => {
    const mock = await startMockGitHub({ cors: false });
    try {
      await page.goto(
        `/?provider=github&ghBase=${encodeURIComponent(mock.url)}`,
      );
      await fill(page, { repo: 'o/r', token: GH_TOKEN });
      await page.click('#cors');
      await expect(log(page)).toContainText('could NOT call');
      await expect(log(page)).toContainText(
        'CORS or the address is unreachable',
      );
    } finally {
      await mock.close();
    }
  });
});
