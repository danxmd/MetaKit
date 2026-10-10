import type { AttributeDef, NodeLook, RelationLook } from '@metakit-app/core';

/**
 * The shapes of catalog entries (openspec/changes/ai-data-catalog, kit-library). Entries carry
 * no ids and no language: `catalogCommands` makes fresh ids and puts the English text under the
 * first language of the Kit when it does not list English.
 */

export type CatalogTopicId =
  | 'general'
  | 'people'
  | 'business'
  | 'customer'
  | 'finance'
  | 'delivery'
  | 'ea'
  | 'apps'
  | 'security'
  | 'data'
  | 'mesh'
  | 'quality'
  | 'analytics'
  | 'ai'
  | 'genai'
  | 'governance';

export interface CatalogTopic {
  id: CatalogTopicId;
  label: string;
}

type WithoutIdAndText<T> = T extends unknown
  ? Omit<T, 'id' | 'labels' | 'help'>
  : never;

/** An attribute as the Kit has it, without id; `label` and `help` are English. */
export type CatalogAttribute = WithoutIdAndText<AttributeDef> & {
  label: string;
  help?: string;
};

export interface CatalogClass {
  key: string;
  labels: { en: string };
  topic: CatalogTopicId;
  /** One or two plain sentences, shown in the dialog and as the class help. */
  help: string;
  kind: 'node' | 'container';
  look: NodeLook;
  attributes: CatalogAttribute[];
}

export interface CatalogRelation {
  key: string;
  labels: { en: string };
  help: string;
  /** Catalog class keys; empty means any class (every class of the Kit once added). */
  from: string[];
  to: string[];
  attributes: CatalogAttribute[];
  look: RelationLook;
}
