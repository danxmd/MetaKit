// Writes packages/ui/src/theme/looks.css from looks.ts. Run from the repository root with
// `pnpm looks:build`; looks.test.ts fails when the committed file differs from what this writes.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { looksCss } from '../src/theme/looks-css';

const target = resolve('packages/ui/src/theme/looks.css');
writeFileSync(target, looksCss());
console.log(`Wrote ${target}`);
