import { kvGet, kvSet, type KeyValue } from '../browser-state';

export type GitService = 'github' | 'gitlab';

/** A saved access token. It exists in IndexedDB of this browser profile and nowhere else (rule 9). */
export interface TokenRecord {
  id: string;
  service: GitService;
  host: string;
  /** A name the person chooses, such as "Work laptop, Kits". */
  label: string;
  token: string;
  createdAt: string;
}

/** What lists and screens get to see: everything except the secret. */
export type TokenInfo = Omit<TokenRecord, 'token'>;

export const DEFAULT_HOSTS: Record<GitService, string> = {
  github: 'github.com',
  gitlab: 'gitlab.com',
};

const KEY = 'gitTokens';

const isRecord = (r: unknown): r is TokenRecord => {
  const x = r as Partial<TokenRecord> | null;
  return (
    !!x &&
    typeof x.id === 'string' &&
    (x.service === 'github' || x.service === 'gitlab') &&
    typeof x.host === 'string' &&
    typeof x.label === 'string' &&
    typeof x.token === 'string' &&
    typeof x.createdAt === 'string'
  );
};

// Built field by field so a field added to the record later is not exposed by accident.
const withoutSecret = (record: TokenRecord): TokenInfo => ({
  id: record.id,
  service: record.service,
  host: record.host,
  label: record.label,
  createdAt: record.createdAt,
});

/** A key-value store in memory, for tests and for browsers where IndexedDB is not available. */
export function createMemoryKeyValue(): KeyValue {
  const map = new Map<string, unknown>();
  return {
    get: <T>(key: string) => Promise.resolve(map.get(key) as T | undefined),
    set: (key, value) => {
      map.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
}

/**
 * Tokens for GitHub and GitLab. `list` never returns the secret; `reveal` is for the one piece of
 * code that builds a remote and makes requests.
 */
export class TokenStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly kv: KeyValue = {
      get: (k) => kvGet(k),
      set: (k, v) => kvSet(k, v),
    },
  ) {}

  /** Changes are applied one after the other, so two quick clicks cannot overwrite each other. */
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async load(): Promise<Record<string, TokenRecord>> {
    const stored = await this.kv.get<Record<string, unknown>>(KEY);
    const out: Record<string, TokenRecord> = {};
    for (const [id, r] of Object.entries(stored ?? {}))
      if (isRecord(r) && r.id === id) out[id] = r;
    return out;
  }

  add(input: {
    service: GitService;
    host?: string;
    label: string;
    token: string;
  }): Promise<TokenInfo> {
    return this.exclusive(async () => {
      const token = input.token.trim();
      if (token === '') throw new Error('Paste the token first.');
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const record: TokenRecord = {
        id: `tok_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`,
        service: input.service,
        host: (input.host?.trim() || DEFAULT_HOSTS[input.service]).replace(
          /\/+$/,
          '',
        ),
        label: input.label.trim() || DEFAULT_HOSTS[input.service],
        token,
        createdAt: new Date().toISOString(),
      };
      await this.kv.set(KEY, { ...(await this.load()), [record.id]: record });
      return withoutSecret(record);
    });
  }

  async list(): Promise<TokenInfo[]> {
    return Object.values(await this.load())
      .map(withoutSecret)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** The secret itself. Call it only where a request is made, and keep the result out of state, logs and messages. */
  async reveal(id: string): Promise<string | undefined> {
    return (await this.load())[id]?.token;
  }

  remove(id: string): Promise<void> {
    return this.exclusive(async () => {
      const rest = await this.load();
      delete rest[id];
      await this.kv.set(KEY, rest);
    });
  }

  rename(id: string, label: string): Promise<void> {
    return this.exclusive(async () => {
      const all = await this.load();
      const record = all[id];
      if (!record) return;
      await this.kv.set(KEY, {
        ...all,
        [id]: { ...record, label: label.trim() || record.label },
      });
    });
  }
}
