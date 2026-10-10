import type {
  BatchCommand,
  ClassDef,
  Issue,
  Json,
  KitCommand,
  Kit,
} from '@metakit-app/core';
import { fromLayout, isLayoutPath, toLayout } from './layout';
import type { GitLink, GitLinkStore } from './link';
import {
  applyResolutions,
  describeChanges,
  fileChanges,
  jsonEqual,
  mergeLayouts,
  type MergeConflict,
  type MergeResult,
  type PartChange,
  type Resolutions,
} from './merge';
import type { GitFile, GitRemote, GitSnapshot, GitTag } from './remote';

/** Something the person can fix, with a message in plain English. */
export class GitSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitSyncError';
  }
}

const layoutOnly = (files: readonly GitFile[]): GitFile[] =>
  files.filter((f) => isLayoutPath(f.path));

/** A link for a Kit that was just opened from a snapshot of the repository. */
export function linkFromSnapshot(
  where: Pick<
    GitLink,
    'toolSlug' | 'service' | 'host' | 'repo' | 'folder' | 'branch'
  >,
  snapshot: GitSnapshot,
): GitLink {
  return {
    ...where,
    baseCommit: snapshot.commit,
    baseFiles: layoutOnly(snapshot.files),
  };
}

/** The parts of the Kit that differ from the last pulled or pushed state. */
export function pendingChanges(
  link: GitLink,
  kit: Kit,
  assets: readonly GitFile[] = [],
): PartChange[] {
  return describeChanges(link.baseFiles, toLayout(kit, assets));
}

// -- Commit ---------------------------------------------------------------------------------------

export interface CommitInput {
  remote: GitRemote;
  link: GitLink;
  kit: Kit;
  assets?: readonly GitFile[];
  message: string;
  /** When given, the moved link is saved here. */
  links?: GitLinkStore;
}

/**
 * One commit for all changed files. Throws `NonFastForwardError` (and changes nothing) when the
 * branch has moved on; the person pulls first. Returns the link moved to the new commit.
 */
export async function commitPending(
  input: CommitInput,
): Promise<{ link: GitLink; commit: string; files: number }> {
  const message = input.message.trim();
  if (message === '')
    throw new GitSyncError('Write a short message that says what you changed.');
  const current = toLayout(input.kit, input.assets);
  const changes = fileChanges(input.link.baseFiles, current);
  if (changes.length === 0)
    throw new GitSyncError(
      'There is nothing to commit: nothing has changed since the last pull or commit.',
    );
  const { commit } = await input.remote.commit({
    branch: input.link.branch,
    parent: input.link.baseCommit,
    message,
    changes,
  });
  const link: GitLink = {
    ...input.link,
    baseCommit: commit,
    baseFiles: current,
  };
  await input.links?.put(link);
  return { link, commit, files: changes.length };
}

// -- Pull -----------------------------------------------------------------------------------------

export interface PullInput {
  remote: GitRemote;
  link: GitLink;
  kit: Kit;
  assets?: readonly GitFile[];
}

export interface PullMerged {
  status: 'merged';
  /** The merge; hand it to `finishPull` with the person's choices when `conflicts` is not empty. */
  merge: MergeResult;
  conflicts: MergeConflict[];
  /** The Kit with every clash resolved to our side; final when there are no conflicts. */
  kit: Kit;
  assets: GitFile[];
  issues: Issue[];
  /** The link to save once the pull has been applied. */
  link: GitLink;
  /** Where the link moves to; the remote files. */
  theirs: GitSnapshot;
}

export type PullOutcome = { status: 'up-to-date' } | PullMerged;

function read(files: GitFile[]): {
  kit: Kit;
  assets: GitFile[];
  issues: Issue[];
} {
  const r = fromLayout(files);
  if (!r.kit)
    throw new GitSyncError(
      `The merged Kit cannot be read: ${r.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
    );
  return { kit: r.kit, assets: r.assets, issues: r.issues };
}

/** Fetches the head of the branch and merges it with the Kit, field by field. */
export async function pull(input: PullInput): Promise<PullOutcome> {
  const { remote, link } = input;
  const head = await remote.head(link.branch);
  if (head === link.baseCommit) return { status: 'up-to-date' };
  const theirs = await remote.read(head);
  const ours = toLayout(input.kit, input.assets);
  const merge = mergeLayouts(link.baseFiles, ours, layoutOnly(theirs.files));
  return {
    status: 'merged',
    merge,
    conflicts: merge.conflicts,
    ...read(merge.files),
    link: {
      ...link,
      baseCommit: theirs.commit,
      baseFiles: layoutOnly(theirs.files),
    },
    theirs,
  };
}

/** Applies the choices for the clashes (unchosen ones keep our side) and reads the result. */
export function finishPull(
  merged: PullMerged,
  choices: Resolutions,
): { kit: Kit; assets: GitFile[]; issues: Issue[]; link: GitLink } {
  return {
    ...read(applyResolutions(merged.merge, choices)),
    link: merged.link,
  };
}

// -- Applying a merge as commands -----------------------------------------------------------------

const asJson = (v: unknown) => v as Json;

/** Parents before children: sorts so that a part comes after the part it extends. */
function depthOf<T extends { id: string; extends?: string }>(
  table: Record<string, T>,
  id: string,
): number {
  let depth = 0;
  const seen = new Set<string>();
  for (
    let at = table[id]?.extends;
    at && !seen.has(at);
    at = table[at]?.extends
  ) {
    seen.add(at);
    depth++;
  }
  return depth;
}

/** Shapes that embed another shape are removed first, so the other is free to go. */
function shapeRemovalOrder(
  removed: string[],
  shapes: Record<string, unknown>,
): string[] {
  const text = new Map(removed.map((id) => [id, JSON.stringify(shapes[id])]));
  const left = [...removed];
  const out: string[] = [];
  while (left.length > 0) {
    const at = left.findIndex(
      (id) =>
        !left.some(
          (other) => other !== id && text.get(other)?.includes(`"${id}"`),
        ),
    );
    out.push(...left.splice(at < 0 ? 0 : at, 1));
  }
  return out;
}

/**
 * The Kit commands that turn `current` into `merged`. Parts are replaced whole (`putClass` and
 * so on), parts are added before others are removed, and a class is removed after what uses it.
 * Run the result as one batch so the pull is one undo step (`pullBatch`). Ids that do not exist
 * on one side are the only thing it relies on; the format version is left alone.
 */
export function diffKitCommands(current: Kit, merged: Kit): KitCommand[] {
  const out: KitCommand[] = [];

  const manifest: Extract<KitCommand, { type: 'updateManifest' }> = {
    type: 'updateManifest',
  };
  let manifestChanged = false;
  if (current.manifest.name !== merged.manifest.name) {
    manifest.name = merged.manifest.name;
    manifestChanged = true;
  }
  if (current.manifest.version !== merged.manifest.version) {
    manifest.version = merged.manifest.version;
    manifestChanged = true;
  }
  if (
    !jsonEqual(
      asJson(current.manifest.languages),
      asJson(merged.manifest.languages),
    )
  ) {
    manifest.languages = merged.manifest.languages;
    manifestChanged = true;
  }
  if (
    !jsonEqual(
      asJson(current.manifest.permissions),
      asJson(merged.manifest.permissions),
    )
  ) {
    manifest.permissions = merged.manifest.permissions ?? {};
    manifestChanged = true;
  }
  if (manifestChanged) out.push(manifest);

  if (!jsonEqual(asJson(current.settings), asJson(merged.settings))) {
    out.push({
      type: 'updateSettings',
      grid: merged.settings.grid,
      layers: merged.settings.layers,
      numbering: merged.settings.numbering,
    });
  }

  const changed = <T>(a: Record<string, T>, b: Record<string, T>): string[] =>
    Object.keys(b).filter(
      (id) => !(id in a) || !jsonEqual(asJson(a[id]), asJson(b[id])),
    );
  const removed = <T>(a: Record<string, T>, b: Record<string, T>): string[] =>
    Object.keys(a).filter((id) => !(id in b));

  for (const id of changed(current.shapes ?? {}, merged.shapes ?? {}))
    out.push({ type: 'putShape', def: merged.shapes[id as never]! });
  for (const id of changed(current.classes, merged.classes))
    out.push({ type: 'putClass', def: merged.classes[id as never]! });
  for (const id of changed(current.relations, merged.relations))
    out.push({ type: 'putRelation', def: merged.relations[id as never]! });
  for (const id of changed(current.modelTypes, merged.modelTypes))
    out.push({ type: 'putModelType', def: merged.modelTypes[id as never]! });
  for (const id of changed(current.rules ?? {}, merged.rules ?? {}))
    out.push({ type: 'putRule', rule: merged.rules[id as never]! });
  for (const id of changed(current.scripts ?? {}, merged.scripts ?? {}))
    out.push({ type: 'putScript', script: merged.scripts[id as never]! });
  for (const id of changed(current.panels ?? {}, merged.panels ?? {}))
    out.push({ type: 'putPanel', layout: merged.panels[id]! });

  for (const id of removed(current.panels ?? {}, merged.panels ?? {}))
    out.push({ type: 'removePanel', id: id as never });
  for (const id of removed(current.rules ?? {}, merged.rules ?? {}))
    out.push({ type: 'removeRule', id: id as never });
  for (const id of removed(current.scripts ?? {}, merged.scripts ?? {}))
    out.push({ type: 'removeScript', id: id as never });
  for (const id of removed(current.modelTypes, merged.modelTypes))
    out.push({ type: 'removeModelType', id: id as never });
  const byDepth = (table: Record<string, ClassDef>) => (a: string, b: string) =>
    depthOf(table, b) - depthOf(table, a);
  for (const id of removed(current.relations, merged.relations).sort(
    byDepth(current.relations as never),
  ))
    out.push({ type: 'removeRelation', id: id as never });
  for (const id of removed(current.classes, merged.classes).sort(
    byDepth(current.classes),
  ))
    out.push({ type: 'removeClass', id: id as never });
  for (const id of shapeRemovalOrder(
    removed(current.shapes ?? {}, merged.shapes ?? {}),
    current.shapes ?? {},
  ))
    out.push({ type: 'removeShape', id: id as never });
  return out;
}

/** The commands as one batch: a single undo step. Null when there is nothing to change. */
export function pullBatch(
  current: Kit,
  merged: Kit,
): BatchCommand<KitCommand> | null {
  const commands = diffKitCommands(current, merged);
  return commands.length === 0 ? null : { type: 'batch', commands };
}

// -- Releases -------------------------------------------------------------------------------------

/** The tags of the repository, as the service lists them. */
export function listReleases(remote: GitRemote): Promise<GitTag[]> {
  return remote.listTags();
}

export interface OpenedRelease {
  tag: string;
  commit: string;
  kit: Kit;
  assets: GitFile[];
  issues: Issue[];
}

/** Reads the Kit as it was at a tag. It is a copy to read or to follow, not to edit. */
export async function openRelease(
  remote: GitRemote,
  tag: string,
): Promise<OpenedRelease> {
  const snapshot = await remote.read(tag);
  const r = fromLayout(layoutOnly(snapshot.files));
  if (!r.kit)
    throw new GitSyncError(
      `The Kit at "${tag}" cannot be read: ${r.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
    );
  return {
    tag,
    commit: snapshot.commit,
    kit: r.kit,
    assets: r.assets,
    issues: r.issues,
  };
}
