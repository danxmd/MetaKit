import { describe, expect, it, vi } from 'vitest';
import {
  CHECK_INTERVAL_MS,
  LATEST_RELEASE_URL,
  UPDATE_KEY,
  checkForUpdate,
  compareVersions,
  dismissUpdate,
  fetchLatestRelease,
  parseVersion,
  releaseFromJson,
  updateCheckApplies,
  type Release,
  type UpdateStorage,
} from './update-check';

function memory(): UpdateStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

const release = (version: string): Release => ({
  version,
  url: `https://github.com/danxmd/MetaKit/releases/tag/v${version}`,
});

describe('versions', () => {
  it('reads tags with and without v', () => {
    expect(parseVersion('v0.2.0')).toEqual([0, 2, 0]);
    expect(parseVersion('1.10.3')).toEqual([1, 10, 3]);
    expect(parseVersion('2.1')).toEqual([2, 1, 0]);
    expect(parseVersion('1.0.0-beta.1')).toEqual([1, 0, 0]);
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });

  it('compares by number, not by text', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('v0.2.0', '0.1.0')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('0.1.0', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('nonsense', '0.1.0')).toBe(0);
  });
});

describe('GitHub answer', () => {
  const answer = {
    tag_name: 'v0.2.0',
    html_url: 'https://github.com/danxmd/MetaKit/releases/tag/v0.2.0',
    draft: false,
    prerelease: false,
  };

  it('takes the version from the tag and the release page', () => {
    expect(releaseFromJson(answer)).toEqual(release('0.2.0'));
  });

  it('refuses drafts, pre-releases, odd tags and links off GitHub', () => {
    expect(releaseFromJson({ ...answer, draft: true })).toBeNull();
    expect(releaseFromJson({ ...answer, prerelease: true })).toBeNull();
    expect(releaseFromJson({ ...answer, tag_name: 'nightly' })).toBeNull();
    expect(
      releaseFromJson({ ...answer, html_url: 'https://example.com/x' }),
    ).toBeNull();
    expect(releaseFromJson(null)).toBeNull();
    expect(releaseFromJson('v1.0.0')).toBeNull();
  });

  it('asks the latest-release endpoint and fails quietly', async () => {
    const ok = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(answer), { status: 200 }),
    );
    expect(await fetchLatestRelease(ok as typeof fetch)).toEqual(
      release('0.2.0'),
    );
    expect(ok.mock.calls[0]![0]).toBe(LATEST_RELEASE_URL);

    const limited = async () => new Response('{}', { status: 403 });
    expect(await fetchLatestRelease(limited as typeof fetch)).toBeNull();
    const bad = async () => new Response('not json', { status: 200 });
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(await fetchLatestRelease(bad as typeof fetch)).toBeNull();
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await fetchLatestRelease(offline as typeof fetch)).toBeNull();
    debug.mockRestore();
  });
});

describe('checkForUpdate', () => {
  it('tells about a newer release only', async () => {
    for (const [latest, expected] of [
      ['0.2.0', true],
      ['0.1.0', false],
      ['0.0.9', false],
    ] as const) {
      const found = await checkForUpdate({
        current: '0.1.0',
        storage: memory(),
        now: () => 0,
        latest: async () => release(latest),
      });
      expect(found !== null).toBe(expected);
    }
  });

  it('asks at most once a day and keeps the answer in between', async () => {
    const storage = memory();
    const latest = vi.fn(async () => release('0.2.0'));
    let now = 1_000;
    const check = () =>
      checkForUpdate({ current: '0.1.0', storage, now: () => now, latest });

    expect(await check()).toEqual(release('0.2.0'));
    now += CHECK_INTERVAL_MS - 1;
    expect(await check()).toEqual(release('0.2.0'));
    expect(latest).toHaveBeenCalledTimes(1);
    now += 1;
    await check();
    expect(latest).toHaveBeenCalledTimes(2);
  });

  it('counts a failed check and keeps the last known release', async () => {
    const storage = memory();
    let now = 0;
    await checkForUpdate({
      current: '0.1.0',
      storage,
      now: () => now,
      latest: async () => release('0.2.0'),
    });
    now = CHECK_INTERVAL_MS;
    const failing = vi.fn(async () => null);
    const options = {
      current: '0.1.0',
      storage,
      now: () => now,
      latest: failing,
    };
    expect(await checkForUpdate(options)).toEqual(release('0.2.0'));
    expect(await checkForUpdate(options)).toEqual(release('0.2.0'));
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('stays hidden after Dismiss until a later release', async () => {
    const storage = memory();
    let now = 0;
    let latest = release('0.2.0');
    const check = () =>
      checkForUpdate({
        current: '0.1.0',
        storage,
        now: () => now,
        latest: async () => latest,
      });
    expect(await check()).not.toBeNull();
    dismissUpdate(storage, '0.2.0');
    expect(await check()).toBeNull();
    now = CHECK_INTERVAL_MS;
    latest = release('0.3.0');
    expect(await check()).toEqual(release('0.3.0'));
  });

  it('says nothing once this copy is updated', async () => {
    const storage = memory();
    await checkForUpdate({
      current: '0.1.0',
      storage,
      now: () => 0,
      latest: async () => release('0.2.0'),
    });
    expect(
      await checkForUpdate({
        current: '0.2.0',
        storage,
        now: () => 1,
        latest: async () => release('0.2.0'),
      }),
    ).toBeNull();
  });

  it('survives broken or blocked storage', async () => {
    const storage = memory();
    storage.map.set(UPDATE_KEY, '{not json');
    expect(
      await checkForUpdate({
        current: '0.1.0',
        storage,
        now: () => 0,
        latest: async () => release('0.2.0'),
      }),
    ).toEqual(release('0.2.0'));
    const blocked: UpdateStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(
      await checkForUpdate({
        current: '0.1.0',
        storage: blocked,
        now: () => 0,
        latest: async () => release('0.2.0'),
      }),
    ).toEqual(release('0.2.0'));
    expect(() => dismissUpdate(blocked, '0.2.0')).not.toThrow();
  });
});

describe('updateCheckApplies', () => {
  it('skips GitHub Pages and runs everywhere else', () => {
    expect(updateCheckApplies('danxmd.github.io')).toBe(false);
    expect(updateCheckApplies('DANXMD.GitHub.io')).toBe(false);
    expect(updateCheckApplies('localhost')).toBe(true);
    expect(updateCheckApplies('127.0.0.1')).toBe(true);
    expect(updateCheckApplies('github.io.example.com')).toBe(true);
  });
});
