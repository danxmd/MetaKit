import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import os from 'node:os';
import { test } from '@playwright/test';

test('measure sandbox size, load time and cost per call', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  const measurements = await page.evaluate(() =>
    (
      window as never as { __behaviour: { measure(): Promise<unknown> } }
    ).__behaviour.measure(),
  );
  const files = readdirSync('dist/assets').map((name) => {
    const data = readFileSync(`dist/assets/${name}`);
    return {
      name,
      bytes: statSync(`dist/assets/${name}`).size,
      gzip: gzipSync(data, { level: 9 }).length,
      brotli: brotliCompressSync(data).length,
    };
  });
  const machine = {
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    platform: `${os.platform()} ${os.release()}`,
    browser: browser.version(),
    headless: true,
  };
  mkdirSync('results', { recursive: true });
  writeFileSync(
    'results/latest.json',
    `${JSON.stringify({ machine, files, measurements }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ machine, files, measurements }, null, 2));
});
