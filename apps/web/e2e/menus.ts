import type { Locator, Page } from '@playwright/test';

/** The model view's toolbar menus: File, Edit, View, Arrange, Check and Commands. */
export type MenuName =
  'File' | 'Edit' | 'View' | 'Arrange' | 'Check' | 'Commands';

/** Opens a toolbar menu (if it is not open already) and returns it. */
export async function openMenu(page: Page, name: MenuName): Promise<Locator> {
  const menu = page
    .getByTestId('model-header')
    .locator('details.menu')
    .filter({ has: page.locator('summary', { hasText: name }) })
    .first();
  if (!(await menu.evaluate((d) => (d as HTMLDetailsElement).open)))
    await menu.locator('summary').click();
  return menu;
}

/** Opens a menu and clicks the item with this test id; the menu closes itself afterwards. */
export async function chooseFromMenu(
  page: Page,
  name: MenuName,
  testId: string,
): Promise<void> {
  const menu = await openMenu(page, name);
  await menu.getByTestId(testId).click();
}
