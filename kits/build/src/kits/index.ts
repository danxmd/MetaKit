import type { KitSpec } from '../define';
import { analyticsBi } from './analytics-bi';
import { cloudDataMigration } from './cloud-data-migration';
import { dataAiMaturity } from './data-ai-maturity';
import { dataAiStrategy } from './data-ai-strategy';
import { dataMesh } from './data-mesh';
import { dataModelling } from './data-modelling';
import { dataPipelinesLineage } from './data-pipelines-lineage';
import { dataQuality } from './data-quality';
import { kpiMetricTree } from './kpi-metric-tree';
import { masterData } from './master-data';
import { privacyRopa } from './privacy-ropa';

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
];
