import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Report } from './harness';

interface Budget {
  drag: { workP95Ms: number; slowFramesPct: number };
  panZoom: { workP95Ms: number; slowFramesPct: number };
  openMs: number;
  attributeEditMs: number;
}

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));
const budget = JSON.parse(
  readFileSync(here('./budget.json'), 'utf8'),
) as Budget;
const toolJson = readFileSync(here('../tools/bpmn-lite/tool.json'), 'utf8');
const frames = Number(process.env.BENCH_FRAMES ?? 240);

function format(report: Report): string {
  const f = (n: number) => n.toFixed(1);
  const lines = [
    `Model: ${report.elements} elements, ${report.connectors} connectors; open ${f(report.openMs)} ms; attribute edit p95 ${f(report.attributeEditMs)} ms`,
    `Viewport ${report.viewport}; ${report.userAgent}`,
    '',
    'scenario | frames | interval p50/p95/max (ms) | frames over 20 ms | work p50/p95/max (ms) | one-off (ms)',
  ];
  for (const r of report.rows) {
    const one = Object.entries(r.oneOffMs)
      .map(([k, v]) => `${k} ${f(v)}`)
      .join(', ');
    lines.push(
      `${r.scenario} | ${r.frames} | ${f(r.intervalMs.p50)}/${f(r.intervalMs.p95)}/${f(r.intervalMs.max)} | ${f(r.intervalMs.slowPct)}% | ${f(r.workMs.p50)}/${f(r.workMs.p95)}/${f(r.workMs.max)} | ${one}`,
    );
  }
  return lines.join('\n');
}

test('the canvas keeps the performance budget on 5,000 elements and 7,000 connectors', async ({
  page,
}) => {
  const bundle = await build({
    entryPoints: [here('./harness.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  const report = await page.evaluate(
    ([json, n]) =>
      (
        window as unknown as {
          __bench: { run(tool: string, frames: number): Promise<Report> };
        }
      ).__bench.run(json as string, n as number),
    [toolJson, frames] as const,
  );

  const text = format(report);
  console.log(text);
  mkdirSync(here('./results'), { recursive: true });
  writeFileSync(
    here('./results/latest.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  writeFileSync(here('./results/latest.txt'), text + '\n');

  const failures: string[] = [];
  const check = (what: string, value: number, limit: number) => {
    if (value > limit)
      failures.push(`${what}: ${value.toFixed(1)} is over the limit ${limit}`);
  };
  check('open', report.openMs, budget.openMs);
  check('attribute edit p95', report.attributeEditMs, budget.attributeEditMs);
  for (const row of report.rows) {
    const limits = row.scenario.startsWith('drag')
      ? budget.drag
      : budget.panZoom;
    check(`${row.scenario}: draw work p95`, row.workMs.p95, limits.workP95Ms);
    check(
      `${row.scenario}: frames over 20 ms (%)`,
      row.intervalMs.slowPct,
      limits.slowFramesPct,
    );
  }
  expect(failures, failures.join('\n')).toEqual([]);
  expect(report.rows).toHaveLength(10);
});
