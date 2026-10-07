import { expect, test, type Page } from '@playwright/test';

// Two pages of one browser context share the origin private file system, which has the same
// API as a picked folder, so they stand in for two windows on one local folder.
const open = async (page: Page, folder: string, id: string, name: string) => {
  await page.goto(`/?opfs=${folder}&instance=${id}&name=${name}`);
  await expect(page.locator('#app')).toBeVisible();
};

type Hooks = {
  __sync: {
    edit(el: string, f: string, v: unknown): void;
    flush(): Promise<void>;
    snapshot(): Promise<void>;
  };
};

const edit = (page: Page, el: string, f: string, v: unknown) =>
  page.evaluate(
    ([e, fl, val]) =>
      (window as never as Hooks).__sync.edit(e as string, fl as string, val),
    [el, f, v],
  );

const rowIds = (page: Page) =>
  page
    .locator('#boxes tr')
    .evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.el!));

const field = (page: Page, el: string, f: string) =>
  page.locator(`[data-el="${el}"] input[data-f="${f}"]`);

test.describe('two windows, one folder', () => {
  test('edits flow both ways and presence is shown', async ({ context }) => {
    const folder = `t${Date.now()}a`;
    const anna = await context.newPage();
    const ben = await context.newPage();
    await open(anna, folder, 'aaaa0001', 'Anna');
    await open(ben, folder, 'bbbb0002', 'Ben');

    await anna.click('#add');
    const el = await anna.locator('#boxes tr').first().getAttribute('data-el');
    await expect(ben.locator(`[data-el="${el}"]`)).toBeVisible({
      timeout: 10_000,
    });
    await expect(ben.locator('#status')).toContainText('Last change from Anna');

    await ben.locator(`[data-el="${el}"] input[data-f="x"]`).fill('300');
    await ben.locator(`[data-el="${el}"] input[data-f="x"]`).blur();
    await expect(field(anna, el!, 'x')).toHaveValue('300', { timeout: 10_000 });

    await expect(anna.locator('#present')).toContainText('Ben', {
      timeout: 10_000,
    });
  });

  test('different fields both survive; the later edit to one field wins', async ({
    context,
  }) => {
    const folder = `t${Date.now()}b`;
    const anna = await context.newPage();
    const ben = await context.newPage();
    await open(anna, folder, 'aaaa0001', 'Anna');
    await open(ben, folder, 'bbbb0002', 'Ben');
    await anna.click('#add');
    const el = (await anna
      .locator('#boxes tr')
      .first()
      .getAttribute('data-el'))!;
    await expect(ben.locator(`[data-el="${el}"]`)).toBeVisible({
      timeout: 10_000,
    });

    await edit(anna, el, 'x', 111);
    await edit(ben, el, 'y', 222);
    await ben.waitForTimeout(50);
    await edit(anna, el, 'name', 'first');
    await ben.waitForTimeout(50);
    await edit(ben, el, 'name', 'second');

    for (const page of [anna, ben]) {
      await expect(field(page, el, 'x')).toHaveValue('111', {
        timeout: 10_000,
      });
      await expect(field(page, el, 'y')).toHaveValue('222', {
        timeout: 10_000,
      });
      await expect(field(page, el, 'name')).toHaveValue('second', {
        timeout: 10_000,
      });
    }
  });

  test('deletes sync, change files are never rewritten, snapshots remove folded files', async ({
    context,
  }) => {
    const folder = `t${Date.now()}c`;
    const anna = await context.newPage();
    const ben = await context.newPage();
    await open(anna, folder, 'aaaa0001', 'Anna');
    await open(ben, folder, 'bbbb0002', 'Ben');
    await anna.click('#add');
    const el = (await rowIds(anna))[0]!;
    await anna.click('#add');
    const keep = (await rowIds(anna)).find((id) => id !== el)!;
    await expect(ben.locator(`[data-el="${keep}"]`)).toBeVisible({
      timeout: 10_000,
    });
    await expect(ben.locator(`[data-el="${el}"]`)).toBeVisible({
      timeout: 10_000,
    });

    const listOwn = (page: Page) =>
      page.evaluate(async (name) => {
        const root = await (
          await navigator.storage.getDirectory()
        ).getDirectoryHandle(name);
        const own = await (
          await root.getDirectoryHandle('_state')
        ).getDirectoryHandle('aaaa0001');
        const files: Record<string, number> = {};
        for await (const [n, h] of own.entries()) {
          files[n] = (await (h as FileSystemFileHandle).getFile()).lastModified;
        }
        return files;
      }, folder);

    await anna.evaluate(() => (window as never as Hooks).__sync.flush());
    const before = await listOwn(anna);
    expect(Object.keys(before).some((n) => n.endsWith('.jsonl'))).toBe(true);

    await anna.locator(`[data-el="${el}"] [data-del]`).click();
    await anna.evaluate(() => (window as never as Hooks).__sync.flush());
    const afterDelete = await listOwn(anna);
    for (const [name, modified] of Object.entries(before)) {
      if (name.endsWith('.jsonl')) expect(afterDelete[name]).toBe(modified);
    }
    expect(Object.keys(afterDelete).length).toBeGreaterThan(
      Object.keys(before).length,
    );
    await expect(ben.locator(`[data-el="${el}"]`)).toHaveCount(0, {
      timeout: 10_000,
    });

    await anna.evaluate(() => (window as never as Hooks).__sync.snapshot());
    const afterSnapshot = await listOwn(anna);
    expect(Object.keys(afterSnapshot)).toEqual(['snapshot.json']);

    // A third instance that only has the snapshot reaches the same state.
    const cara = await context.newPage();
    await open(cara, folder, 'cccc0003', 'Cara');
    await expect(cara.locator(`[data-el="${keep}"]`)).toBeVisible({
      timeout: 10_000,
    });
    await expect(cara.locator(`[data-el="${el}"]`)).toHaveCount(0);
  });
});
