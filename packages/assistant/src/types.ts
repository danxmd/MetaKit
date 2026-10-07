import type { NodeShape, RelationShape, Rule } from '@metakit-app/core';
import type { DraftKind } from './prompts';

/** A rule as drafted: everything but the id, which the app creates when the draft is accepted. */
export type RuleDraft = Omit<Rule, 'id'>;

export interface ScriptDraft {
  name: string;
  source: string;
}

export type ShapeDraft = Omit<NodeShape, 'id'> | Omit<RelationShape, 'id'>;

/** An attribute as drafted: no id yet. */
export type AttributeDraft = { key: string; type: string } & Record<
  string,
  unknown
>;

export interface ConstraintDraft {
  id: string;
  formula: string;
  message: string;
  severity?: 'error' | 'warning';
}

export interface ClassDraft {
  key: string;
  kind: 'node' | 'container' | 'swimlane';
  labels: Record<string, string>;
  /** The key (or id) of an existing class. */
  extends?: string;
  abstract?: boolean;
  attributes: AttributeDraft[];
  constraints?: ConstraintDraft[];
}

export interface DraftMap {
  rule: RuleDraft;
  script: ScriptDraft;
  shape: ShapeDraft;
  class: ClassDraft;
}

export type DraftOf<K extends DraftKind> = DraftMap[K];

/**
 * Checks a script against the generated declarations with the TypeScript language service and
 * returns one plain sentence per problem. The language service lives in the UI package (it runs
 * in a worker in the app), so the caller passes it in; without it only the compile check runs.
 */
export type TypeCheck = (
  source: string,
  declarations: string,
) => Promise<string[]>;

export interface DraftOutcome<K extends DraftKind> {
  /** The parsed draft, or null when the reply could not be read at all. */
  draft: DraftMap[K] | null;
  /** The reply as the provider wrote it, for the read-only box. */
  raw: string;
  /** What is still wrong; empty means the draft passed every check. */
  errors: string[];
  /** 1, or 2 when the first reply was invalid and was retried once. */
  attempts: number;
}
