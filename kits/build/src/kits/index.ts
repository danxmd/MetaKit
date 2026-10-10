import type { KitSpec } from '../define';
import { aiRiskCompliance } from './ai-risk-compliance';
import { businessModelCanvas } from './business-model-canvas';
import { capabilityMap } from './capability-map';
import { dataAiMaturity } from './data-ai-maturity';
import { dataAiStrategy } from './data-ai-strategy';
import { genaiSolution } from './genai-solution';
import { kpiMetricTree } from './kpi-metric-tree';
import { okrsGoals } from './okrs-goals';
import { stakeholderOrgMap } from './stakeholder-org-map';
import { valueStreamsJourneys } from './value-streams-journeys';
import { mlLifecycle } from './ml-lifecycle';

/** Every built-in Kit made by the build script, in the order it writes them. */
export const KIT_SPECS: readonly KitSpec[] = [
  dataAiStrategy,
  dataAiMaturity,
  kpiMetricTree,
  mlLifecycle,
  genaiSolution,
  aiRiskCompliance,
  capabilityMap,
  businessModelCanvas,
  valueStreamsJourneys,
  stakeholderOrgMap,
  okrsGoals,
];
