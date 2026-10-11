import { expect, test, type Page } from '@playwright/test';
import { newModel, prepare } from './app';

const LOOKS = ['workshop', 'drafting', 'meadow', 'classic'] as const;

/** A token of the page, resolved to the colour the browser uses (`rgb(…)`). */
const tokenColour = (page: Page, name: string) =>
  page.evaluate((token) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, name);

/** The background the model canvas paints, as `rgb(…)`. */
const canvasBackground = (page: Page) =>
  page.evaluate(() => {
    const host = document.querySelector('[data-testid="canvas-host"]');
    const painted = [host, ...(host?.querySelectorAll('*') ?? [])].find(
      (el) => el instanceof HTMLElement && el.style.background !== '',
    ) as HTMLElement | undefined;
    return painted ? getComputedStyle(painted).backgroundColor : '';
  });

const chooseLook = async (page: Page, look: string) => {
  const menu = page.getByTestId('settings-menu');
  if (!(await menu.evaluate((d) => (d as HTMLDetailsElement).open)))
    await menu.locator('summary').click();
  await page.getByTestId(`look-${look}`).click();
};

test.describe('looks', () => {
  test('each look applies at once, the canvas follows, and a reload keeps it', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await prepare(page);
    await newModel(page);
    // A browser that never chose shows Workshop.
    await expect(page.locator('html')).toHaveAttribute('data-look', 'workshop');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'model');

    const seen = new Set<string>();
    for (const look of LOOKS) {
      await chooseLook(page, look);
      await expect(page.locator('html')).toHaveAttribute('data-look', look);
      await expect(page.getByTestId(`look-${look}`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      const accent = await tokenColour(page, '--accent');
      const background = await tokenColour(page, '--canvas-bg');
      seen.add(`${accent} ${background}`);
      // The model stays open, and its canvas repaints in the look's colours.
      await expect(page.getByTestId('model-view')).toBeVisible();
      await expect.poll(() => canvasBackground(page)).toBe(background);
    }
    expect(seen.size).toBe(LOOKS.length);

    await chooseLook(page, 'meadow');
    await page.getByTestId('theme-dark').click();
    const meadowDark = await tokenColour(page, '--canvas-bg');
    await expect.poll(() => canvasBackground(page)).toBe(meadowDark);
    expect(meadowDark).toBe('rgb(21, 28, 21)');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-look', 'meadow');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await tokenColour(page, '--canvas-bg')).toBe(meadowDark);
    expect(
      await page.evaluate(() => localStorage.getItem('metakit.look')),
    ).toBe('meadow');
  });

  test('in Workshop the accent follows the mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await prepare(page);
    await page.getByTestId('open-folder').click();
    await expect(page.getByTestId('models-page')).toBeVisible();
    const modelAccent = await tokenColour(page, '--accent');
    await page.getByTestId('mode-build').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'build');
    expect(await tokenColour(page, '--accent')).not.toBe(modelAccent);
    expect(await tokenColour(page, '--accent')).toBe(
      await tokenColour(page, '--mode-build'),
    );
    // In Classic it does not.
    await chooseLook(page, 'classic');
    const classicBuild = await tokenColour(page, '--accent');
    await page.keyboard.press('Escape');
    await page.getByTestId('mode-model').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'model');
    expect(await tokenColour(page, '--accent')).toBe(classicBuild);
  });

  test('Classic downloads no font, and the other looks only their own', async ({
    page,
  }) => {
    const fonts: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('.woff2')) fonts.push(r.url().split('/').pop()!);
    });
    await page.addInitScript(() =>
      localStorage.setItem('metakit.look', 'classic'),
    );
    await prepare(page);
    await newModel(page);
    await page.evaluate(() => document.fonts.ready);
    expect(fonts).toEqual([]);

    await chooseLook(page, 'drafting');
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => fonts.length).toBeGreaterThan(0);
    expect(fonts.every((f) => f.startsWith('ibm-plex-'))).toBe(true);
  });

  for (const look of LOOKS)
    test(`the top bar stays one line at 1280 x 720 in ${look}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.addInitScript(
        (l) => localStorage.setItem('metakit.look', l),
        look,
      );
      await prepare(page);
      const check = async (where: string) => {
        await page.evaluate(() => document.fonts.ready);
        const bar = page.getByTestId('top-bar');
        const result = await bar.evaluate((el) => {
          const height = el.getBoundingClientRect().height;
          const expected = parseFloat(
            getComputedStyle(el).getPropertyValue('height'),
          );
          const box = el.getBoundingClientRect();
          // Every control on the bar sits inside it, and no text is cut off or wrapped.
          const overflowing = [
            ...el.querySelectorAll<HTMLElement>('button, summary, .brand, li'),
          ]
            // The settings menu opens below the bar; its items are not on it.
            .filter((c) => !c.closest('.menu-list') && c.checkVisibility())
            .filter((c) => {
              const r = c.getBoundingClientRect();
              return (
                r.top < box.top - 0.5 ||
                r.bottom > box.bottom + 0.5 ||
                r.right > box.right + 0.5 ||
                (getComputedStyle(c).display !== 'inline' &&
                  c.scrollWidth > c.clientWidth + 1)
              );
            })
            .map((c) => c.textContent?.trim() || c.className);
          const rem = parseFloat(
            getComputedStyle(document.documentElement).fontSize,
          );
          return { height, expected, overflowing, barHeight: 3 * rem };
        });
        expect(result.height, where).toBeCloseTo(result.barHeight, 0);
        expect(result.expected, where).toBeCloseTo(result.barHeight, 0);
        expect(result.overflowing, where).toEqual([]);
      };
      await newModel(page, 'Customer onboarding and account opening');
      await check('model view');
      await page.getByTestId('crumb-area').click();
      await expect(page.getByTestId('models-page')).toBeVisible();
      await check('models page');
      await page.getByTestId('mode-build').click();
      await page.getByRole('button', { name: /^Edit / }).click();
      await expect(page.getByTestId('build-view')).toBeVisible();
      await check('build view');
    });
});
