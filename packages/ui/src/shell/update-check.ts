/**
 * The update notice (ADR 0015): a copy of MetaKit run from a download asks GitHub once a day for
 * the latest release and says when it is newer than itself. Fetch, clock and storage are passed
 * in, so the logic runs in tests without a browser or a network.
 */

// Set by Vite's `define` in apps/web/vite.config.ts from apps/web/package.json; absent in tests.
declare const __METAKIT_VERSION__: string | undefined;

/** The version of this copy of MetaKit, such as "0.1.0". */
export const APP_VERSION: string =
  typeof __METAKIT_VERSION__ === 'string' ? __METAKIT_VERSION__ : '0.0.0';

export const LATEST_RELEASE_URL =
  'https://api.github.com/repos/danxmd/MetaKit/releases/latest';

export const UPDATE_KEY = 'metakit.updateCheck';

/** Once a day at most, so opening MetaKit often never runs into GitHub's rate limit. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface Release {
  /** Without the leading "v" of the tag, such as "0.2.0". */
  version: string;
  /** The release page on GitHub. */
  url: string;
}

/** The part of `Storage` the check needs, so tests can pass a map. */
export interface UpdateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Stored {
  checkedAt?: number;
  latest?: Release;
  dismissed?: string;
}

/** "v1.2.3", "1.2.3" or "1.2" as numbers; null for anything else. A suffix such as "-beta" is ignored. */
export function parseVersion(text: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:[-+].*)?$/.exec(text.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

/** Negative when a is older than b, positive when newer, 0 when equal or either is unreadable. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return 0;
}

/** The release in GitHub's answer for `releases/latest`, or null when it is not one. */
export function releaseFromJson(data: unknown): Release | null {
  if (!data || typeof data !== 'object') return null;
  const { tag_name, html_url, draft, prerelease } = data as Record<
    string,
    unknown
  >;
  if (draft === true || prerelease === true) return null;
  if (typeof tag_name !== 'string' || typeof html_url !== 'string') return null;
  if (!html_url.startsWith('https://github.com/')) return null;
  if (!parseVersion(tag_name)) return null;
  return { version: tag_name.trim().replace(/^v/, ''), url: html_url };
}

/** Asks GitHub for the latest release; null when offline, rate-limited or the answer is odd. */
export async function fetchLatestRelease(
  fetchFn: typeof fetch,
): Promise<Release | null> {
  try {
    const response = await fetchFn(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    return releaseFromJson(await response.json());
  } catch (error) {
    // The notice is a convenience: a failed check stays out of the person's way.
    console.debug('MetaKit could not check for a newer version.', error);
    return null;
  }
}

/**
 * Whether this copy should look for updates. The copy on GitHub Pages is always the newest, so it
 * does not; a hostname is used rather than BASE_PATH because the e2e tests build with BASE_PATH too.
 */
export function updateCheckApplies(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host !== 'github.io' && !host.endsWith('.github.io');
}

function read(storage: UpdateStorage | undefined): Stored {
  try {
    const raw = storage?.getItem(UPDATE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Stored;
    return {
      checkedAt:
        typeof data.checkedAt === 'number' ? data.checkedAt : undefined,
      latest:
        releaseFromJson(
          data.latest && {
            tag_name: data.latest.version,
            html_url: data.latest.url,
          },
        ) ?? undefined,
      dismissed:
        typeof data.dismissed === 'string' ? data.dismissed : undefined,
    };
  } catch {
    return {};
  }
}

function write(storage: UpdateStorage | undefined, stored: Stored): void {
  try {
    storage?.setItem(UPDATE_KEY, JSON.stringify(stored));
  } catch {
    // Blocked storage: the check simply runs again next time.
  }
}

export interface UpdateCheckOptions {
  current: string;
  storage?: UpdateStorage;
  now: () => number;
  /** GitHub's latest release, or null when it could not be read. */
  latest: () => Promise<Release | null>;
}

/**
 * The release to tell the person about: newer than `current` and not dismissed, or null. Asks
 * `latest` only when the last check is more than a day old; otherwise the remembered answer is
 * used, so the notice stays until it is dismissed or MetaKit is updated.
 */
export async function checkForUpdate(
  options: UpdateCheckOptions,
): Promise<Release | null> {
  const { current, storage, now } = options;
  const stored = read(storage);
  const fresh =
    stored.checkedAt !== undefined &&
    now() - stored.checkedAt >= 0 &&
    now() - stored.checkedAt < CHECK_INTERVAL_MS;
  let latest = stored.latest;
  if (!fresh) {
    // A failed check counts too: it is not retried before tomorrow.
    latest = (await options.latest()) ?? latest;
    write(storage, { ...stored, checkedAt: now(), latest });
  }
  if (!latest || compareVersions(latest.version, current) <= 0) return null;
  if (stored.dismissed === latest.version) return null;
  return latest;
}

/** Hides the notice for this version; a later release shows it again. */
export function dismissUpdate(
  storage: UpdateStorage | undefined,
  version: string,
): void {
  write(storage, { ...read(storage), dismissed: version });
}

/** This browser's localStorage, or undefined when site data is blocked. */
export function browserUpdateStorage(): UpdateStorage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}
