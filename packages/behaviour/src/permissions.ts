import type { KitId, KitPermissions } from '@metakit-app/core';

/** What this browser has allowed the scripts of one Kit to do. */
export interface PermissionGrant {
  network: boolean;
  files: boolean;
}

export const NO_PERMISSIONS: PermissionGrant = Object.freeze({
  network: false,
  files: false,
});

/**
 * What the person decided about one Kit in this browser: what is allowed, and what was ever asked
 * (so that a "no" is not asked again and a permission the Kit did not ask for before is).
 * Stored in IndexedDB of the browser profile, never in the workspace folder (rule 9).
 */
export interface PermissionRecord {
  toolId: KitId;
  granted: PermissionGrant;
  asked: PermissionGrant;
  /** When the person last decided, as an ISO date and time. */
  decidedAt: string;
}

export interface PermissionBacking {
  load(): Promise<PermissionRecord[]>;
  save(record: PermissionRecord): Promise<void>;
  remove(kitId: KitId): Promise<void>;
}

export interface PermissionStore {
  /** What is allowed now; instant, from what was loaded when the store was created. */
  granted(kitId: KitId): PermissionGrant;
  /**
   * Makes sure what the Kit wants is allowed: true when it is. Asks the person (once per Kit in
   * each browser) for what has not been decided yet; a Kit that later wants a new permission asks
   * again, for that one only.
   */
  request(kitId: KitId, wanted: KitPermissions): Promise<boolean>;
  /** Forgets every decision about the Kit, so that the next request asks again. */
  forget(kitId: KitId): Promise<void>;
}

/**
 * Shows the permission dialog. `fresh` lists what was never asked before; the dialog should say
 * what the Kit wants in plain English and answer true to allow all of `wanted`.
 */
export type PermissionAsk = (
  kitId: KitId,
  wanted: PermissionGrant,
  fresh: PermissionGrant,
) => Promise<boolean>;

const KINDS = ['network', 'files'] as const;

export function wantedOf(
  permissions: KitPermissions | undefined,
): PermissionGrant {
  return {
    network: permissions?.network === true,
    files: permissions?.files === true,
  };
}

/** Plain-English lines for what a Kit wants, for the permission dialog and the Kit's settings. */
export function describePermissions(wanted: KitPermissions): string[] {
  const lines: string[] = [];
  if (wanted.network)
    lines.push(
      'Contact web services on the internet. Scripts can send and receive data from addresses they choose, but only from services that accept requests from web pages.',
    );
  if (wanted.files)
    lines.push(
      'Read and write files in your workspace folder, and open or save files you pick in a dialog. Scripts cannot start programs on your computer.',
    );
  return lines;
}

export async function createPermissionStore(
  backing: PermissionBacking,
  ask: PermissionAsk,
  now: () => Date = () => new Date(),
): Promise<PermissionStore> {
  const records = new Map<string, PermissionRecord>();
  for (const r of await backing.load()) records.set(r.toolId, r);
  // Two requests for one Kit at once must show one dialog.
  const asking = new Map<string, Promise<boolean>>();

  const allowed = (kitId: KitId, wanted: PermissionGrant): boolean => {
    const have = records.get(kitId)?.granted ?? NO_PERMISSIONS;
    return KINDS.every((k) => !wanted[k] || have[k]);
  };

  return {
    granted: (kitId) => ({
      ...(records.get(kitId)?.granted ?? NO_PERMISSIONS),
    }),

    async request(kitId, wantedPermissions) {
      const wanted = wantedOf(wantedPermissions);
      if (!KINDS.some((k) => wanted[k])) return true;
      if (allowed(kitId, wanted)) return true;
      const running = asking.get(kitId);
      if (running) return running.then(() => allowed(kitId, wanted));
      const record = records.get(kitId);
      const asked = record?.asked ?? NO_PERMISSIONS;
      const fresh: PermissionGrant = {
        network: wanted.network && !asked.network,
        files: wanted.files && !asked.files,
      };
      // Everything missing was asked before and refused: the person said no, so do not ask again.
      if (!KINDS.some((k) => fresh[k])) return false;
      const decision = (async () => {
        const yes = await ask(kitId, wanted, fresh);
        const next: PermissionRecord = {
          toolId: kitId,
          granted: {
            network:
              (record?.granted.network ?? false) || (yes && wanted.network),
            files: (record?.granted.files ?? false) || (yes && wanted.files),
          },
          asked: {
            network: asked.network || wanted.network,
            files: asked.files || wanted.files,
          },
          decidedAt: now().toISOString(),
        };
        records.set(kitId, next);
        await backing.save(next);
        return yes;
      })();
      asking.set(kitId, decision);
      try {
        return await decision;
      } finally {
        asking.delete(kitId);
      }
    },

    async forget(kitId) {
      records.delete(kitId);
      await backing.remove(kitId);
    },
  };
}

/** A store that remembers nothing between runs, for tests and headless runs. */
export function memoryPermissionBacking(
  initial: PermissionRecord[] = [],
): PermissionBacking & { records: Map<string, PermissionRecord> } {
  const records = new Map(initial.map((r) => [r.toolId as string, r]));
  return {
    records,
    load: () => Promise.resolve([...records.values()]),
    save: (r) => {
      records.set(r.toolId, r);
      return Promise.resolve();
    },
    remove: (id) => {
      records.delete(id);
      return Promise.resolve();
    },
  };
}
