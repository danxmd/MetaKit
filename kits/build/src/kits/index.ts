import type { KitSpec } from '../define';
import { aiRiskCompliance } from './ai-risk-compliance';
import { analyticsBi } from './analytics-bi';
import { businessModelCanvas } from './business-model-canvas';
import { capabilityMap } from './capability-map';
import { cloudDataMigration } from './cloud-data-migration';
import { dataAiMaturity } from './data-ai-maturity';
import { dataAiStrategy } from './data-ai-strategy';
import { dataMesh } from './data-mesh';
import { dataModelling } from './data-modelling';
import { dataPipelinesLineage } from './data-pipelines-lineage';
import { dataQuality } from './data-quality';
import { decisionTables } from './decision-tables';
import { enterpriseArchitecture } from './enterprise-architecture';
import { eventStorming } from './event-storming';
import { genaiSolution } from './genai-solution';
import { kpiMetricTree } from './kpi-metric-tree';
import { masterData } from './master-data';
import { mindMap } from './mind-map';
import { mlLifecycle } from './ml-lifecycle';
import { okrsGoals } from './okrs-goals';
import { orgChart } from './org-chart';
import { privacyRopa } from './privacy-ropa';
import { projectRaid } from './project-raid';
import { requirementsStories } from './requirements-stories';
import { softwareC4 } from './software-c4';
import { stakeholderOrgMap } from './stakeholder-org-map';
import { threatModel } from './threat-model';
import { valueStreamsJourneys } from './value-streams-journeys';

/** Every built-in Kit made by the build script, in the order it writes them. */
export const KIT_SPECS: readonly KitSpec[] = [
  dataAiStrategy,
  dataAiMaturity,
  kpiMetricTree,
  dataMesh,
  dataModelling,
  dataPipelinesLineage,
  dataQuality,
  masterData,
  analyticsBi,
  privacyRopa,
  cloudDataMigration,
  mlLifecycle,
  genaiSolution,
  aiRiskCompliance,
  capabilityMap,
  businessModelCanvas,
  valueStreamsJourneys,
  stakeholderOrgMap,
  okrsGoals,
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
