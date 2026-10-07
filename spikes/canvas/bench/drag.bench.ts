import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { test } from '@playwright/test';

test('canvas benchmark on the 5,000-node model', async ({ page, browser }) => {
  await page.goto('/?bench');
  await page.waitForFunction(() => '__runBench' in window);
  const report = await page.evaluate(() =>
    (window as never as { __runBench: () => Promise<unknown> }).__runBench(),
  );
  const text = await page.locator('#output').innerText();
  const machine = {
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 2 ** 30),
    platform: `${os.platform()} ${os.release()}`,
    browser: browser.version(),
    headless: true,
  };
  mkdirSync('results', { recursive: true });
  writeFileSync(
    'results/latest.json',
    `${JSON.stringify({ machine, report }, null, 2)}\n`,
  );
  console.log(`\n${JSON.stringify(machine)}\n${text}\n`);
});
