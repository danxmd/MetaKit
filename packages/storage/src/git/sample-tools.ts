import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Rule, Script, ToolLibrary } from '@metakit-app/core';

/** Test helper: the sample tool libraries of tools/. */
const read = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../../../tools/${path}`, import.meta.url)),
    'utf8',
  );

export function sampleTool(name: 'bpmn-lite' | 'er-lite'): ToolLibrary {
  return JSON.parse(read(`${name}/tool.json`)) as ToolLibrary;
}

/** A sample with the behaviour examples added, so that rules and scripts are in the layout. */
export function sampleWithBehaviour(): ToolLibrary {
  const tool = sampleTool('bpmn-lite');
  const rule = JSON.parse(
    read('behaviour-examples/total-effort.rule.json'),
  ) as Rule;
  const script: Script = {
    id: 'scr_total_effort',
    name: 'Total effort by lane',
    source: read('behaviour-examples/total-effort.script.ts'),
  };
  const second: Script = {
    id: 'scr_gateway_check',
    name: 'Check gateways',
    source: read('behaviour-examples/gateway-check.script.ts'),
    enabled: false,
  };
  return {
    ...tool,
    rules: { ...tool.rules, [rule.id]: rule },
    scripts: { ...tool.scripts, [script.id]: script, [second.id]: second },
  };
}
