import type { KitSpec } from '../define';
import { decisionTables } from './decision-tables';
import { dataAiMaturity } from './data-ai-maturity';
import { dataAiStrategy } from './data-ai-strategy';
import { kpiMetricTree } from './kpi-metric-tree';
import { projectRaid } from './project-raid';
import { requirementsStories } from './requirements-stories';

/** Every built-in Kit made by the build script, in the order it writes them. */
export const KIT_SPECS: readonly KitSpec[] = [
  dataAiStrategy,
  dataAiMaturity,
  kpiMetricTree,
  projectRaid,
  requirementsStories,
  decisionTables,
];
