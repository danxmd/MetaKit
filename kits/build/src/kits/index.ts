import type { KitSpec } from '../define';
import { decisionTables } from './decision-tables';
import { enterpriseArchitecture } from './enterprise-architecture';
import { eventStorming } from './event-storming';
import { dataAiMaturity } from './data-ai-maturity';
import { dataAiStrategy } from './data-ai-strategy';
import { kpiMetricTree } from './kpi-metric-tree';
import { mindMap } from './mind-map';
import { orgChart } from './org-chart';
import { projectRaid } from './project-raid';
import { requirementsStories } from './requirements-stories';
import { softwareC4 } from './software-c4';
import { threatModel } from './threat-model';

/** Every built-in Kit made by the build script, in the order it writes them. */
export const KIT_SPECS: readonly KitSpec[] = [
  dataAiStrategy,
  dataAiMaturity,
  kpiMetricTree,
  projectRaid,
  requirementsStories,
  decisionTables,
  enterpriseArchitecture,
  softwareC4,
  eventStorming,
  threatModel,
  mindMap,
  orgChart,
];
