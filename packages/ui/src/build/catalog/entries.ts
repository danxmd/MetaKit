import { FIRST_RELATIONS } from './relations';
import { AI_CLASSES, AI_RELATIONS } from './topics/ai';
import { ANALYTICS_CLASSES, ANALYTICS_RELATIONS } from './topics/analytics';
import { APPS_CLASSES, APPS_RELATIONS } from './topics/apps';
import { BUSINESS_CLASSES, BUSINESS_RELATIONS } from './topics/business';
import { CUSTOMER_CLASSES, CUSTOMER_RELATIONS } from './topics/customer';
import { DATA_CLASSES, DATA_RELATIONS } from './topics/data';
import { DELIVERY_CLASSES, DELIVERY_RELATIONS } from './topics/delivery';
import { EA_CLASSES, EA_RELATIONS } from './topics/ea';
import { FINANCE_CLASSES, FINANCE_RELATIONS } from './topics/finance';
import { GENAI_CLASSES, GENAI_RELATIONS } from './topics/genai';
import { GENERAL_CLASSES, GENERAL_RELATIONS } from './topics/general';
import { GOVERNANCE_CLASSES, GOVERNANCE_RELATIONS } from './topics/governance';
import { MESH_CLASSES, MESH_RELATIONS } from './topics/mesh';
import { PEOPLE_CLASSES, PEOPLE_RELATIONS } from './topics/people';
import { QUALITY_CLASSES, QUALITY_RELATIONS } from './topics/quality';
import { SECURITY_CLASSES, SECURITY_RELATIONS } from './topics/security';
import type { CatalogClass, CatalogRelation, CatalogTopic } from './types';

/**
 * The class catalog (openspec/changes/ai-data-catalog, kit-library): generic classes and
 * relation classes a method engineer adds to a Kit instead of typing them in. Each topic has its
 * own file in `topics/`; this file puts them together in the order of the tabs.
 */

export type {
  CatalogAttribute,
  CatalogClass,
  CatalogRelation,
  CatalogTopic,
  CatalogTopicId,
} from './types';

export const CATALOG_TOPICS: readonly CatalogTopic[] = [
  { id: 'general', label: 'General' },
  { id: 'people', label: 'People and organisation' },
  { id: 'business', label: 'Strategy and value' },
  { id: 'customer', label: 'Customer and marketing' },
  { id: 'finance', label: 'Finance and operations' },
  { id: 'delivery', label: 'Project delivery' },
  { id: 'ea', label: 'Enterprise architecture' },
  { id: 'apps', label: 'Software and cloud' },
  { id: 'security', label: 'Security' },
  { id: 'data', label: 'Data' },
  { id: 'mesh', label: 'Data mesh' },
  { id: 'quality', label: 'Data quality and MDM' },
  { id: 'analytics', label: 'Analytics and BI' },
  { id: 'ai', label: 'AI and MLOps' },
  { id: 'genai', label: 'Generative AI' },
  { id: 'governance', label: 'Governance and privacy' },
];

export const CATALOG_CLASSES: readonly CatalogClass[] = [
  ...GENERAL_CLASSES,
  ...PEOPLE_CLASSES,
  ...BUSINESS_CLASSES,
  ...CUSTOMER_CLASSES,
  ...FINANCE_CLASSES,
  ...DELIVERY_CLASSES,
  ...EA_CLASSES,
  ...APPS_CLASSES,
  ...SECURITY_CLASSES,
  ...DATA_CLASSES,
  ...MESH_CLASSES,
  ...QUALITY_CLASSES,
  ...ANALYTICS_CLASSES,
  ...AI_CLASSES,
  ...GENAI_CLASSES,
  ...GOVERNANCE_CLASSES,
];

/** The first relation classes keep their order; the ones of each topic follow. */
export const CATALOG_RELATIONS: readonly CatalogRelation[] = [
  ...FIRST_RELATIONS,
  ...GENERAL_RELATIONS,
  ...PEOPLE_RELATIONS,
  ...BUSINESS_RELATIONS,
  ...CUSTOMER_RELATIONS,
  ...FINANCE_RELATIONS,
  ...DELIVERY_RELATIONS,
  ...EA_RELATIONS,
  ...APPS_RELATIONS,
  ...SECURITY_RELATIONS,
  ...DATA_RELATIONS,
  ...MESH_RELATIONS,
  ...QUALITY_RELATIONS,
  ...ANALYTICS_RELATIONS,
  ...AI_RELATIONS,
  ...GENAI_RELATIONS,
  ...GOVERNANCE_RELATIONS,
];
