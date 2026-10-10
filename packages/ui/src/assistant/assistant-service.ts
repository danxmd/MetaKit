import {
  AssistantError,
  ClaudeProvider,
  DEFAULT_ASSISTANT_SETTINGS,
  createKeyStore,
  createSettingsStore,
  draft as runDraft,
  safeMessage,
  type AssistantProvider,
  type AssistantSettings,
  type DraftKind,
  type DraftOutcome,
  type KeyStore,
  type KeyValue,
  type SettingsStore,
  type TypeCheck,
} from '@metakit-app/assistant';
import type { Kit } from '@metakit-app/core';
import { kvGet, kvSet } from '@metakit-app/storage';

/** What the editors need from the assistant; `AssistantService` is the implementation. */
export interface AssistantPort {
  /** True when the assistant is turned on and a key is saved. */
  readonly enabled: boolean;
  draft<K extends DraftKind>(
    kind: K,
    kit: Kit,
    sentence: string,
    language?: string,
  ): Promise<DraftOutcome<K>>;
  /** Calls `listener` when `enabled` may have changed; returns a function that stops it. */
  subscribe?(listener: () => void): () => void;
}

export interface AssistantServiceOptions {
  /** IndexedDB in the app (`browserKeyValue()`), memory in tests. */
  kv: KeyValue;
  createProvider?: (settings: AssistantSettings) => AssistantProvider;
  /** Type check for drafted scripts; without it scripts are only compiled. */
  typeCheck?: TypeCheck;
}

/** The IndexedDB of this browser profile as the assistant's key-value store. */
export function browserKeyValue(): KeyValue {
  return {
    get: <T>(key: string) => kvGet<T>(key),
    set: (key, value) => kvSet(key, value),
  };
}

/**
 * Settings, key and drafting in one place for the app: the settings page edits it, the editors
 * draft through it. The key is read from the key store only while a draft or a test runs and is
 * never kept here.
 */
export class AssistantService implements AssistantPort {
  private settingsStore: SettingsStore;
  private keys: KeyStore;
  private listeners: (() => void)[] = [];
  private current: AssistantSettings = { ...DEFAULT_ASSISTANT_SETTINGS };
  private keySet = false;
  private ready = false;

  constructor(private readonly options: AssistantServiceOptions) {
    this.settingsStore = createSettingsStore(options.kv);
    this.keys = createKeyStore(options.kv);
  }

  get settings(): AssistantSettings {
    return this.current;
  }
  get hasKey(): boolean {
    return this.keySet;
  }
  /** False until `load` has finished, so a page can wait before it shows a state. */
  get loaded(): boolean {
    return this.ready;
  }
  get enabled(): boolean {
    return this.current.enabled && this.keySet;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  private changed(): void {
    for (const l of [...this.listeners]) l();
  }

  async load(): Promise<void> {
    this.current = await this.settingsStore.load();
    this.keySet = await this.keys.has(this.current.providerId);
    this.ready = true;
    this.changed();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.current = await this.settingsStore.save({ enabled });
    this.changed();
  }

  async setModel(model: string): Promise<void> {
    this.current = await this.settingsStore.save({ model });
    this.changed();
  }

  async saveKey(key: string): Promise<void> {
    await this.keys.add(this.current.providerId, key);
    this.keySet = true;
    this.changed();
  }

  async removeKey(): Promise<void> {
    await this.keys.remove(this.current.providerId);
    this.keySet = false;
    this.changed();
  }

  private provider(): AssistantProvider {
    return (
      this.options.createProvider?.(this.current) ??
      new ClaudeProvider({ model: this.current.model })
    );
  }

  private async key(): Promise<string> {
    const key = await this.keys.reveal(this.current.providerId);
    if (!key)
      throw new AssistantError('Add a key in the assistant settings first.');
    return key;
  }

  /** Checks the saved key with a tiny request that holds no Kit or model content. */
  async testKey(): Promise<string> {
    const key = await this.key();
    try {
      return await this.provider().test(key);
    } catch (error) {
      throw error instanceof AssistantError
        ? error
        : new AssistantError(safeMessage(error, key));
    }
  }

  async draft<K extends DraftKind>(
    kind: K,
    kit: Kit,
    sentence: string,
    language?: string,
  ): Promise<DraftOutcome<K>> {
    if (!this.current.enabled)
      throw new AssistantError('The assistant is turned off.');
    return runDraft({
      provider: this.provider(),
      key: await this.key(),
      kit,
      kind,
      sentence,
      ...(language ? { language } : {}),
      ...(this.options.typeCheck ? { typeCheck: this.options.typeCheck } : {}),
    });
  }
}
