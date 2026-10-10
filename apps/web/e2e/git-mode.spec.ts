import { expect, test, type Page } from '@playwright/test';
import { prepare } from './app';
import { loadHarness } from './bundle';

type GitHarness = {
  paths(): Promise<string[]>;
  file(path: string): Promise<string | undefined>;
  otherWriterEdits(
    path: string,
    change: (json: Record<string, unknown>) => void,
    message: string,
  ): Promise<void>;
  commits(): number;
};
declare global {
  interface Window {
    __git: GitHarness;
  }
}

/** The repository holds the bpmn-lite Kit; this opens it from "Git" into a fresh workspace. */
async function openFromRepository(page: Page) {
  await prepare(page, { name: 'Anna', colour: '#e8590c', seed: false });
  await loadHarness(page, './git-harness.ts');
  await page.getByTestId('open-folder').click();
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.getByTestId('mode-build').click();
  await page.getByTestId('add-menu').locator('summary').click();
  await page.getByTestId('open-git').click();

  await page.getByTestId('git-token-label').fill('Test token');
  await page.getByTestId('git-token-value').fill('not-a-real-token');
  await page.getByTestId('git-token-add').click();
  await page.getByTestId('git-choose-repo').fill('acme/tools');
  await page.getByTestId('git-test').click();
  await expect(page.getByTestId('git-test-result')).toBeVisible();
  await page.getByTestId('git-choose').click();
  await expect(page.getByTestId('build-view')).toBeVisible();
  await expect(page.getByTestId('git-repo')).toContainText('acme/tools');
}

/** Commit, Pull and Releases live in the Source control menu. */
const sourceControl = async (
  page: Page,
  action: 'commit' | 'pull' | 'releases',
) => {
  await page.getByTestId('git-menu-summary').click();
  await page.getByTestId(`git-${action}`).click();
};

const setTaskLabel = async (page: Page, text: string) => {
  await page.getByTestId('build-item-Task').click();
  const label = page.getByTestId('class-label-en');
  await label.fill(text);
  await label.press('Enter');
};

test.describe('Git mode', () => {
  test('commits, pulls a change from the other side and resolves a clash', async ({
    page,
  }) => {
    await openFromRepository(page);

    // A change here is a pending change; the commit sends it as one commit.
    await setTaskLabel(page, 'Job');
    await sourceControl(page, 'commit');
    await expect(page.getByTestId('commit-change')).toHaveCount(1);
    await expect(page.getByTestId('commit-change')).toContainText('Task');
    await page.getByTestId('commit-message').fill('Call tasks jobs');
    await page.getByTestId('commit-confirm').click();
    await expect(page.getByTestId('git-note')).toContainText('Committed');
    expect(await page.evaluate(() => window.__git.commits())).toBe(2);
    expect(
      await page.evaluate(() => window.__git.file('classes/task.json')),
    ).toContain('"Job"');

    // The other person changes a different class; the pull keeps both changes without a question.
    await page.evaluate(() =>
      window.__git.otherWriterEdits(
        'classes/gateway.json',
        (json) => {
          (json['labels'] as Record<string, string>)['en'] = 'Decision';
        },
        'Rename gateway',
      ),
    );
    await sourceControl(page, 'pull');
    await expect(page.getByTestId('git-note')).toContainText('Pulled');
    await page.getByTestId('build-item-Gateway').click();
    await expect(page.getByTestId('class-label-en')).toHaveValue('Decision');

    // Both sides change the same label differently: the pull asks, side by side.
    await setTaskLabel(page, 'Work item');
    await page.evaluate(() =>
      window.__git.otherWriterEdits(
        'classes/task.json',
        (json) => {
          (json['labels'] as Record<string, string>)['en'] = 'Step';
        },
        'Rename task again',
      ),
    );
    await sourceControl(page, 'pull');
    await expect(page.getByTestId('conflict-dialog')).toBeVisible();
    await expect(page.getByTestId('conflict-item')).toHaveCount(1);
    await expect(page.getByTestId('conflict-ours-value')).toContainText(
      'Work item',
    );
    await expect(page.getByTestId('conflict-theirs-value')).toContainText(
      'Step',
    );
    await page.getByTestId('conflict-theirs').click();
    await page.getByTestId('conflict-apply').click();
    await expect(page.getByTestId('conflict-dialog')).toBeHidden();
    await page.getByTestId('build-item-Task').click();
    await expect(page.getByTestId('class-label-en')).toHaveValue('Step');

    // A pull is one undo step.
    await page.getByTestId('build-undo').click();
    await page.getByTestId('build-item-Task').click();
    await expect(page.getByTestId('class-label-en')).toHaveValue('Work item');
  });
});
