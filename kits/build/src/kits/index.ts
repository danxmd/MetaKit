import type { KitSpec } from '../define';
import { aiRiskCompliance } from './ai-risk-compliance';
import { dataAiMaturity } from './data-ai-maturity';
import { dataAiStrategy } from './data-ai-strategy';
import { genaiSolution } from './genai-solution';
import { kpiMetricTree } from './kpi-metric-tree';
import { mlLifecycle } from './ml-lifecycle';

/** Every built-in Kit made by the build script, in the order it writes them. */
export const KIT_SPECS: readonly KitSpec[] = [
  dataAiStrategy,
  dataAiMaturity,
  kpiMetricTree,
  mlLifecycle,
  genaiSolution,
  aiRiskCompliance,
];
