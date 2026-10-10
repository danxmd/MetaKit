import { kvGet, kvSet, type KeyValue } from '../browser-state';
import type { GitFile } from './remote';

/**
 * The link between a Kit of the workspace and a folder of a repository (ADR 0007). It
 * lives in IndexedDB of this browser profile only. It holds no token: those are kept elsewhere
 * (rule 9). `baseFiles` is the layout at the last pull or push, so what differs from it is the
 * pending change.
 */
export interface GitLink {
  /** The Kit in the workspace. */
  toolSlug: string;
  service: 'github' | 'gitlab';
  /** The host, such as `github.com` or `gitlab.example.org`. */
  host: string;
  /** `owner/name` or the GitLab project path. */
  repo: string;
  /** The folder of the repository that holds the layout; empty for the root. */
  folder: string;
  branch: string;
  /** The commit `baseFiles` is the tree of. */
  baseCommit: string;
  baseFiles: GitFile[];
}

export interface GitLinkStore {
  get(kitSlug: string): Promise<GitLink | undefined>;
  put(link: GitLink): Promise<void>;
  remove(kitSlug: string): Promise<void>;
  list(): Promise<GitLink[]>;
}

const LINKS_KEY = 'gitLinks';

const isLink = (v: unknown): v is GitLink => {
  const x = v as Partial<GitLink> | null;
  return (
    !!x &&
    typeof x.toolSlug === 'string' &&
    (x.service === 'github' || x.service === 'gitlab') &&
    typeof x.host === 'string' &&
    typeof x.repo === 'string' &&
    typeof x.folder === 'string' &&
    typeof x.branch === 'string' &&
    typeof x.baseCommit === 'string' &&
    Array.isArray(x.baseFiles)
  );
};

/** A link store over the key-value store of this browser (IndexedDB unless one is passed in). */
export function createGitLinkStore(
  kv: KeyValue = { get: (k) => kvGet(k), set: (k, v) => kvSet(k, v) },
): GitLinkStore {
  const all = async (): Promise<Record<string, GitLink>> => {
    const stored = await kv.get<Record<string, unknown>>(LINKS_KEY);
    const out: Record<string, GitLink> = {};
    for (const [slug, l] of Object.entries(stored ?? {}))
      if (isLink(l) && l.toolSlug === slug) out[slug] = l;
    return out;
  };
  return {
    get: async (slug) => (await all())[slug],
    list: async () => Object.values(await all()),
    put: async (link) => {
      await kv.set(LINKS_KEY, { ...(await all()), [link.toolSlug]: link });
    },
    remove: async (slug) => {
      const rest = await all();
      delete rest[slug];
      await kv.set(LINKS_KEY, rest);
    },
  };
}
