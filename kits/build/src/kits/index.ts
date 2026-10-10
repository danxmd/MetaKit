import type { KitSpec } from '../define';
import { dataAiMaturity } from './data-ai-maturity';
import { dataAiStrategy } from './data-ai-strategy';
import { dataMesh } from './data-mesh';
import { dataModelling } from './data-modelling';
import { dataPipelinesLineage } from './data-pipelines-lineage';
import { dataQuality } from './data-quality';
import { kpiMetricTree } from './kpi-metric-tree';

/** Every built-in Kit made by the build script, in the order it writes them. */
export const KIT_SPECS: readonly KitSpec[] = [
  dataAiStrategy,
  dataAiMaturity,
  kpiMetricTree,
  dataMesh,
  dataModelling,
  dataPipelinesLineage,
  dataQuality,
];
