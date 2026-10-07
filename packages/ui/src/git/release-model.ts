import type { GitTag } from '@metakit-app/storage';

/** What the release picker shows. A release is a tag of the repository (ADR 0007). */

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

const parts = (name: string): number[] | null => {
  const m = SEMVER.exec(name);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/**
 * Newest version first when every tag looks like a version (`v1.2.0`); otherwise the order the
 * service gave, which is newest first for GitHub and GitLab.
 */
export function sortReleases(tags: readonly GitTag[]): GitTag[] {
  const keyed = tags.map((t) => ({ t, v: parts(t.name) }));
  if (keyed.length === 0 || keyed.some((k) => k.v === null)) return [...tags];
  return keyed
    .sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        const d = (b.v![i] ?? 0) - (a.v![i] ?? 0);
        if (d !== 0) return d;
      }
      return 0;
    })
    .map((k) => k.t);
}

/** `v1.2.0 (commit 3fa9c21)` */
export function releaseLabel(tag: GitTag): string {
  return `${tag.name} (commit ${tag.commit.slice(0, 7)})`;
}

export const NO_RELEASES_TEXT =
  'This repository has no tags yet. Tag a commit on GitHub or GitLab (for example v1.0.0) to publish a version of the tool library.';
