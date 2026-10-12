export const packageName = '@metakit-app/assistant';

export { redact, REDACTED } from './redact';
export {
  DEFAULT_ASSISTANT_SETTINGS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER_ID,
  createKeyStore,
  createSettingsStore,
  memoryKeyValue,
  safeMessage,
  type AssistantSettings,
  type KeyStore,
  type KeyValue,
  type SettingsStore,
} from './settings';
export {
  AssistantError,
  ClaudeProvider,
  type AssistantProvider,
  type ChatMessage,
  type ClaudeProviderOptions,
  type CompletionRequest,
} from './provider';
export {
  assertNoModelContent,
  describeOutgoing,
  type OutgoingPreview,
} from './outgoing';
export {
  DRAFT_KINDS,
  MAX_SENTENCE_CHARS,
  buildRequest,
  summariseKit,
  type DraftKind,
} from './prompts';
export { extractCode, parseJsonObject } from './extract';
export { formulaProblem, parseDraftReply, validateDraft } from './check';
export { draft, type DraftOptions } from './draft';
export { asOneStep, describeDraftChange, draftToCommands } from './apply';
export { scriptedProvider } from './testing';
export type {
  AttributeDraft,
  ClassDraft,
  ConstraintDraft,
  DraftMap,
  DraftOf,
  DraftOutcome,
  RuleDraft,
  ScriptDraft,
  ShapeDraft,
  TypeCheck,
} from './types';
