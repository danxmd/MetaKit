import { redact } from './redact';

/** The few things the assistant remembers besides the key. */
export interface AssistantSettings {
  /** Off until the person turns it on. */
  enabled: boolean;
  providerId: string;
  model: string;
}

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_PROVIDER_ID = 'claude';

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  enabled: false,
  providerId: DEFAULT_PROVIDER_ID,
  model: DEFAULT_MODEL,
};

/**
 * Where settings and keys are kept. The app passes the IndexedDB helpers of the storage package
 * (`kvGet`, `kvSet`) so that this package needs no DOM; tests pass `memoryKeyValue()`.
 */
export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export function memoryKeyValue(): KeyValue & { dump(): string } {
  const data = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      const v = data.get(key);
      return v === undefined ? undefined : (structuredClone(v) as T);
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    // For tests that check where a key ended up.
    dump: () => JSON.stringify([...data.entries()]),
  };
}

const SETTINGS_KEY = 'assistantSettings';
const KEYS_KEY = 'assistantKeys';

/** The settings are not secret, so they are stored apart from the keys. */
export function createSettingsStore(kv: KeyValue) {
  const load = async (): Promise<AssistantSettings> => {
    const s = await kv.get<Partial<AssistantSettings>>(SETTINGS_KEY);
    return {
      enabled: s?.enabled === true,
      providerId:
        typeof s?.providerId === 'string' && s.providerId
          ? s.providerId
          : DEFAULT_PROVIDER_ID,
      model:
        typeof s?.model === 'string' && s.model.trim()
          ? s.model.trim()
          : DEFAULT_MODEL,
    };
  };
  return {
    load,
    async save(patch: Partial<AssistantSettings>): Promise<AssistantSettings> {
      const next = { ...(await load()), ...patch };
      await kv.set(SETTINGS_KEY, next);
      return next;
    },
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

/**
 * The API keys of this browser profile, one per provider. They live in IndexedDB only and are
 * never part of the settings, a model, a Kit or a log. `reveal` hands a key to the code
 * that calls the provider and to nothing else; the settings page shows only whether one is set.
 */
export interface KeyStore {
  add(providerId: string, key: string): Promise<void>;
  has(providerId: string): Promise<boolean>;
  remove(providerId: string): Promise<void>;
  reveal(providerId: string): Promise<string | null>;
}

export function createKeyStore(kv: KeyValue): KeyStore {
  const all = async (): Promise<Record<string, string>> => {
    const stored = await kv.get<Record<string, unknown>>(KEYS_KEY);
    const out: Record<string, string> = {};
    for (const [id, key] of Object.entries(stored ?? {}))
      if (typeof key === 'string' && key !== '') out[id] = key;
    return out;
  };
  return {
    async add(providerId, key) {
      const trimmed = key.trim();
      if (trimmed === '') throw new Error('Enter a key first.');
      await kv.set(KEYS_KEY, { ...(await all()), [providerId]: trimmed });
    },
    async has(providerId) {
      return providerId in (await all());
    },
    async remove(providerId) {
      const rest = await all();
      delete rest[providerId];
      await kv.set(KEYS_KEY, rest);
    },
    async reveal(providerId) {
      return (await all())[providerId] ?? null;
    },
  };
}

/** An error text that is safe to show: no key in it. */
export function safeMessage(error: unknown, key?: string): string {
  const text = error instanceof Error ? error.message : String(error);
  return redact(text, key);
}
