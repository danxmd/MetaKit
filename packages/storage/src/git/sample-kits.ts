import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Rule, Script, Kit } from '@metakit-app/core';

/** Test helper: the sample Kits of kits/. */
const read = (path: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../../../kits/${path}`, import.meta.url)),
    'utf8',
  );

export function sampleKit(name: 'bpmn-lite' | 'er-lite'): Kit {
  return JSON.parse(read(`${name}/kit.json`)) as Kit;
}

/** A sample with the behaviour examples added, so that rules and scripts are in the layout. */
export function sampleWithBehaviour(): Kit {
  const kit = sampleKit('bpmn-lite');
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
    ...kit,
    rules: { ...kit.rules, [rule.id]: rule },
    scripts: { ...kit.scripts, [script.id]: script, [second.id]: second },
  };
}
