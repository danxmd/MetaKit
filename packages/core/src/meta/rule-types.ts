import type { ClassId, RelationId } from '../ids';
import type { Json } from '../json';

/** The 24 events of the plan (ADR 0005). */
export const EVENT_NAMES = [
  'app.started',
  'app.closing',
  'model.creating',
  'model.created',
  'model.opened',
  'model.deleting',
  'model.deleted',
  'object.creating',
  'object.created',
  'object.deleting',
  'object.deleted',
  'object.moved',
  'object.resized',
  'object.renamed',
  'connector.creating',
  'connector.created',
  'connector.reconnected',
  'attribute.changing',
  'attribute.changed',
  'table.rowAdded',
  'table.rowRemoved',
  'view.changing',
  'view.changed',
  'selection.changed',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Events whose handlers can stop the action they announce. */
export const CANCELLABLE_EVENTS: readonly EventName[] = [
  'model.creating',
  'model.deleting',
  'object.creating',
  'object.deleting',
  'connector.creating',
  'attribute.changing',
  'view.changing',
];

export type RuleId = `rule_${string}`;

export interface RuleWhen {
  /** An event name, or `command` for a rule that runs on demand. */
  event: EventName | 'command';
  /** Only for objects of this class (or its subclasses). */
  class?: ClassId;
  /** Only for this attribute, by key (attribute and table events). */
  attribute?: string;
  /** Only for connectors of this relation class. */
  relation?: RelationId;
}

/** A value that is fixed, or text starting with `=` that is a formula. */
export type RuleValue = Json;

export type RuleAction =
  | {
      action: 'setAttribute';
      attribute: string;
      value: RuleValue;
      target?: string;
    }
  | {
      action: 'createObject';
      class: ClassId;
      attributes?: Record<string, RuleValue>;
      /** Where to put it relative to the object the rule is about. */
      offset?: { x: number; y: number };
    }
  | {
      action: 'createConnector';
      relation: RelationId;
      from?: string;
      to?: string;
    }
  | { action: 'delete'; target?: string }
  | { action: 'message'; kind: 'info' | 'warning' | 'error'; text: string }
  | { action: 'ask'; text: string; then: RuleAction[]; else?: RuleAction[] }
  | {
      action: 'choose';
      text: string;
      options: string[];
      attribute: string;
      target?: string;
    }
  | { action: 'cancel'; reason: string }
  | { action: 'openModel'; model: string }
  | { action: 'runCommand'; command: string }
  | { action: 'runScript'; script: string };

export type RuleActionType = RuleAction['action'];
export const RULE_ACTION_TYPES: readonly RuleActionType[] = [
  'setAttribute',
  'createObject',
  'createConnector',
  'delete',
  'message',
  'ask',
  'choose',
  'cancel',
  'openModel',
  'runCommand',
  'runScript',
];

export type CommandPlace = 'model' | 'toolbar' | 'context';

export interface Rule {
  id: RuleId;
  label: string;
  /** Rules are on unless this is false. */
  enabled?: boolean;
  when: RuleWhen;
  /** A formula starting with `=`; the rule runs when it is true. No `if` means always. */
  if?: string;
  then: RuleAction[];
  /** For a rule with the event `command`: where its entry appears. */
  command?: { label: string; place: CommandPlace };
}

export interface Constraint {
  id: string;
  /** A formula that is true when the object is fine. */
  formula: string;
  /** Plain text, or a formula starting with `=`. */
  message: string;
  severity?: 'error' | 'warning';
}
