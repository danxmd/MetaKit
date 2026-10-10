import {
  validateKit,
  type AttributeDef,
  type Issue,
  type Json,
  type Model,
  type KitId,
  type Kit,
} from '@metakit-app/core';
import { FormatError, NewerFormatError } from './errors';
import { stringifyCanonical } from './json';
import { CURRENT_FORMAT, migrate } from './migrate';
import {
  KIT_PACKAGE_EXTENSION,
  KIT_PACKAGE_FILE,
  KIT_PACKAGE_KIND,
  OLDER_KIT_PACKAGE_FILE,
} from './names';
import { slugify } from './slugify';
import type { Workspace } from './workspace';
import { unzipFiles, zipFiles } from './zip';

/**
 * `package.json` in a `.mkkit`: what the package is and what it holds. A `.mktool` from a release
 * before the Kit rename (format 1) said `kind: "mktool"` and `tool`; it is read as this.
 */
export interface KitPackageInfo {
  formatVersion: number;
  kind: typeof KIT_PACKAGE_KIND;
  kit: { id: string; name: string; version: string };
  created: string;
  /** Every file in the package except `package.json` itself. */
  contents: string[];
}

export interface ExportKitPackageOptions {
  /** Script sources by file name, written to `scripts/`. Scripts arrive in phase 7. */
  scripts?: Record<string, string>;
  /** Assets (icons, images) by file name, written to `assets/`. */
  assets?: Record<string, Uint8Array>;
  now?: () => Date;
}

const json = (value: unknown): string => stringifyCanonical(value as Json);

/**
 * Packs a Kit into one `.mkkit` file: `package.json`, `kit.json` (definitions, shapes,
 * panels, rules, settings, manifest, and any other field the library has, such as `scripts`),
 * and the folders `scripts/` and `assets/`.
 */
export function exportKitPackage(
  kit: Kit,
  options: ExportKitPackageOptions = {},
): { bytes: Uint8Array; fileName: string } {
  const files: Record<string, Uint8Array | string> = {
    [KIT_PACKAGE_FILE]: json(kit),
  };
  for (const [name, source] of Object.entries(options.scripts ?? {}))
    files[`scripts/${name}`] = source;
  for (const [name, bytes] of Object.entries(options.assets ?? {}))
    files[`assets/${name}`] = bytes;
  const info: KitPackageInfo = {
    formatVersion: CURRENT_FORMAT['kit-package'],
    kind: KIT_PACKAGE_KIND,
    kit: {
      id: kit.manifest.id,
      name: kit.manifest.name,
      version: kit.manifest.version,
    },
    created: (options.now ?? (() => new Date()))().toISOString(),
    contents: Object.keys(files).sort(),
  };
  files['package.json'] = json(info);
  return {
    bytes: zipFiles(files),
    fileName: `${slugify(kit.manifest.name)}-${kit.manifest.version}${KIT_PACKAGE_EXTENSION}`,
  };
}

export interface ReadKitPackage {
  kit: Kit;
  /** Problems with the Kit in the package. Empty when it is fine. */
  issues: Issue[];
  info: KitPackageInfo;
  scripts: Record<string, string>;
  assets: Record<string, Uint8Array>;
}

function parse(bytes: Uint8Array, what: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch (error) {
    throw new FormatError(
      `${what} in this Kit package is not valid JSON: ${(error as Error).message}`,
    );
  }
}

/**
 * Reads a `.mkkit`, or a `.mktool` from a release before the Kit rename (with `tool.json` in it).
 * A package from an older release is brought up to date; one from a newer release is refused.
 * Problems in the Kit itself are returned as `issues` so that they can be shown; a package that
 * is not a package at all raises a `FormatError`.
 */
export function readKitPackage(bytes: Uint8Array): ReadKitPackage {
  const files = unzipFiles(bytes);
  const infoFile = files['package.json'];
  const kitName = files[KIT_PACKAGE_FILE]
    ? KIT_PACKAGE_FILE
    : files[OLDER_KIT_PACKAGE_FILE]
      ? OLDER_KIT_PACKAGE_FILE
      : null;
  if (!infoFile)
    throw new FormatError(
      'This is not a Kit package: there is no package.json in it.',
    );
  if (kitName === null)
    throw new FormatError(
      `This Kit package is incomplete: there is no ${KIT_PACKAGE_FILE} in it.`,
    );
  const kitFile = files[kitName]!;
  let info: KitPackageInfo;
  let kit: Kit;
  try {
    info = migrate('kit-package', parse(infoFile, 'package.json'))
      .value as unknown as KitPackageInfo;
    if (info.kind !== KIT_PACKAGE_KIND)
      throw new FormatError(
        'This is not a Kit package (package.json has the wrong kind).',
      );
    kit = migrate('kit-document', parse(kitFile, kitName))
      .value as unknown as Kit;
  } catch (error) {
    if (error instanceof NewerFormatError)
      throw new NewerFormatError(
        `This Kit package was made with a newer version of MetaKit than this one, so it cannot be imported safely. Update MetaKit and try again. (${error.message})`,
      );
    throw error;
  }
  const issues = validateKit(kit);
  if (issues.length === 0 && info.kit?.id !== kit.manifest.id)
    throw new FormatError(
      `This Kit package is damaged: package.json and ${kitName} name different Kits.`,
    );
  const scripts: Record<string, string> = {};
  const assets: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith('scripts/'))
      scripts[path.slice('scripts/'.length)] = new TextDecoder().decode(
        content,
      );
    else if (path.startsWith('assets/'))
      assets[path.slice('assets/'.length)] = content;
  }
  return { kit, issues, info, scripts, assets };
}

// --- the plan ----------------------------------------------------------------------------------

export type KitArea =
  | 'class'
  | 'relation class'
  | 'model type'
  | 'attribute'
  | 'shape'
  | 'panel layout'
  | 'rule'
  | 'settings';

export interface KitChange {
  area: KitArea;
  change: 'added' | 'removed' | 'changed';
  /** The key, such as `Task` or `Task.Priority`. */
  name: string;
  detail?: string;
}

/** What one existing model uses of the Kit (by id), so that the plan can say what an update does to it. */
export interface ModelUsage {
  slug: string;
  name: string;
  modelType: string;
  classes: string[];
  relations: string[];
  attributes: string[];
}

export function modelUsage(slug: string, model: Model): ModelUsage {
  const attrs = new Set<string>(Object.keys(model.attrs));
  const classes = new Set<string>();
  const relations = new Set<string>();
  for (const e of Object.values(model.elements)) {
    classes.add(e.class);
    for (const id of Object.keys(e.attrs)) attrs.add(id);
  }
  for (const c of Object.values(model.connectors)) {
    relations.add(c.relation);
    for (const id of Object.keys(c.attrs)) attrs.add(id);
  }
  return {
    slug,
    name: model.manifest.name,
    modelType: model.manifest.modelType,
    classes: [...classes],
    relations: [...relations],
    attributes: [...attrs],
  };
}

export interface AffectedModel {
  slug: string;
  name: string;
  effects: string[];
}

export interface KitUpdatePlan {
  /** The Kit is not in the workspace yet. */
  isNew: boolean;
  kit: { id: string; name: string };
  version: {
    from: string | null;
    to: string;
    direction: 'new' | 'same' | 'newer' | 'older';
  };
  changes: KitChange[];
  affectedModels: AffectedModel[];
  /** Things to read before confirming. */
  warnings: string[];
  /** The whole plan in plain English, one sentence per line. */
  lines: string[];
}

const same = (a: unknown, b: unknown): boolean => json(a) === json(b);

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((p) => parseInt(p, 10) || 0);
  const pb = b.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

const fieldsThatDiffer = (a: object, b: object): string[] =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter(
      (k) =>
        !same(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
    .sort();

interface Keyed {
  id: string;
  key: string;
}

/**
 * Says in plain English what importing `incoming` over `existing` (or as a new Kit, when
 * `existing` is null) will change. Things are matched by id, as models do; a changed key is
 * shown as a rename. Pass the models that use the existing library to see what happens to each.
 */
export function planKitUpdate(
  existing: Kit | null,
  incoming: Kit,
  usage: ModelUsage[] = [],
): KitUpdatePlan {
  const changes: KitChange[] = [];
  const warnings: string[] = [];
  const effects = new Map<string, string[]>();
  const affect = (model: ModelUsage, text: string) =>
    void effects.set(model.slug, [...(effects.get(model.slug) ?? []), text]);

  const from = existing?.manifest.version ?? null;
  const to = incoming.manifest.version;
  const direction =
    from === null
      ? 'new'
      : compareVersions(from, to) === 0
        ? 'same'
        : compareVersions(from, to) < 0
          ? 'newer'
          : 'older';

  if (existing) {
    // keyed definitions: classes, relation classes and model types, with their attributes
    const diff = <T extends Keyed>(
      area: KitArea,
      before: Record<string, T>,
      after: Record<string, T>,
      shallow: (item: T) => object,
      attributesOf: (item: T) => AttributeDef[],
      onRemoved: (item: T) => void,
    ) => {
      for (const [id, item] of Object.entries(after)) {
        const old = before[id];
        if (!old) {
          changes.push({ area, change: 'added', name: item.key });
          continue;
        }
        const fields = fieldsThatDiffer(shallow(old), shallow(item));
        if (fields.length > 0 || old.key !== item.key)
          changes.push({
            area,
            change: 'changed',
            name: item.key,
            detail:
              old.key !== item.key
                ? `renamed from ${old.key}${fields.filter((f) => f !== 'key').length ? `; also changed: ${fields.filter((f) => f !== 'key').join(', ')}` : ''}`
                : `changed: ${fields.join(', ')}`,
          });
        diffAttributes(item.key, attributesOf(old), attributesOf(item));
      }
      for (const [id, item] of Object.entries(before)) {
        if (after[id]) continue;
        changes.push({ area, change: 'removed', name: item.key });
        onRemoved(item);
      }
    };

    const diffAttributes = (
      owner: string,
      before: AttributeDef[],
      after: AttributeDef[],
    ) => {
      for (const def of after) {
        const old = before.find((d) => d.id === def.id);
        const name = `${owner}.${def.key}`;
        if (!old) changes.push({ area: 'attribute', change: 'added', name });
        else if (!same(old, def)) {
          const fields = fieldsThatDiffer(old, def).filter((f) => f !== 'key');
          changes.push({
            area: 'attribute',
            change: 'changed',
            name,
            detail: [
              old.key !== def.key ? `renamed from ${owner}.${old.key}` : '',
              fields.length ? `changed: ${fields.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join('; '),
          });
          if (old.type !== def.type) {
            warnings.push(
              `The attribute ${name} changes type from ${old.type} to ${def.type}. Values stored in existing models may not fit.`,
            );
            for (const m of usage)
              if (m.attributes.includes(def.id))
                affect(
                  m,
                  `Values of ${name} may not fit the new type (${def.type}).`,
                );
          }
        }
      }
      for (const old of before) {
        if (after.some((d) => d.id === old.id)) continue;
        const name = `${owner}.${old.key}`;
        changes.push({ area: 'attribute', change: 'removed', name });
        warnings.push(
          `The attribute ${name} is removed. Values already stored in existing models are kept as unknown attributes.`,
        );
        for (const m of usage)
          if (m.attributes.includes(old.id))
            affect(m, `Values of ${name} are kept as unknown attributes.`);
      }
    };

    diff(
      'class',
      existing.classes,
      incoming.classes,
      (c) => ({ ...c, attributes: undefined }),
      (c) => c.attributes,
      (c) => {
        warnings.push(
          `The class ${c.key} is removed. Its objects in existing models will be drawn as grey placeholders.`,
        );
        for (const m of usage)
          if (m.classes.includes(c.id))
            affect(
              m,
              `Objects of the class ${c.key} are drawn as grey placeholders.`,
            );
      },
    );
    diff(
      'relation class',
      existing.relations,
      incoming.relations,
      (r) => ({ ...r, attributes: undefined }),
      (r) => r.attributes,
      (r) => {
        warnings.push(
          `The relation class ${r.key} is removed. Its connectors in existing models will be drawn as grey placeholders.`,
        );
        for (const m of usage)
          if (m.relations.includes(r.id))
            affect(m, `Connectors of ${r.key} are drawn as grey placeholders.`);
      },
    );
    diff(
      'model type',
      existing.modelTypes,
      incoming.modelTypes,
      (t) => ({ ...t, attributes: undefined }),
      (t) => t.attributes,
      (t) => {
        warnings.push(
          `The model type ${t.key} is removed. Models of this type can no longer be opened normally.`,
        );
        for (const m of usage)
          if (m.modelType === t.id)
            affect(m, `This model is of the removed model type ${t.key}.`);
      },
    );

    const label = (id: string) =>
      incoming.classes[id as keyof typeof incoming.classes]?.key ??
      existing.classes[id as keyof typeof existing.classes]?.key ??
      incoming.relations[id as keyof typeof incoming.relations]?.key ??
      existing.relations[id as keyof typeof existing.relations]?.key ??
      id;
    // A shape has no name of its own; it is named by the class that uses it.
    const shapeName = (kit: Kit, id: string) => {
      const owner =
        Object.values(kit.classes).find((c) => c.shape === id) ??
        Object.values(kit.relations).find((r) => r.shape === id);
      return owner ? `${owner.key} (shape)` : `shape ${id}`;
    };
    const plain = <T>(
      area: KitArea,
      before: Record<string, T>,
      after: Record<string, T>,
      name: (id: string, side: 'old' | 'new') => string,
    ) => {
      for (const [id, item] of Object.entries(after)) {
        if (!(id in before))
          changes.push({ area, change: 'added', name: name(id, 'new') });
        else if (!same(before[id], item))
          changes.push({ area, change: 'changed', name: name(id, 'new') });
      }
      for (const id of Object.keys(before))
        if (!(id in after))
          changes.push({ area, change: 'removed', name: name(id, 'old') });
    };
    plain('shape', existing.shapes ?? {}, incoming.shapes ?? {}, (id, side) =>
      shapeName(side === 'new' ? incoming : existing, id),
    );
    plain('panel layout', existing.panels ?? {}, incoming.panels ?? {}, (id) =>
      label(id),
    );
    plain(
      'rule',
      existing.rules ?? {},
      incoming.rules ?? {},
      (id, side) =>
        (
          (side === 'new' ? incoming : existing).rules?.[id as never] as
            { label?: string } | undefined
        )?.label ?? id,
    );
    if (!same(existing.settings, incoming.settings))
      changes.push({ area: 'settings', change: 'changed', name: 'Settings' });
    if (existing.manifest.id !== incoming.manifest.id)
      warnings.push(
        'The package is for a different Kit than the one in the workspace.',
      );
    if (direction === 'older')
      warnings.push(
        `The package has version ${to}, which is older than the version ${from} in the workspace. Importing it replaces the newer Kit.`,
      );
    if (direction === 'same' && changes.length > 0)
      warnings.push(
        `The version number (${to}) is the same, but the content differs. Consider giving the changed Kit a new version number.`,
      );
  }

  const affectedModels = usage
    .filter((m) => effects.has(m.slug))
    .map((m) => ({
      slug: m.slug,
      name: m.name,
      effects: effects.get(m.slug)!,
    }));

  const lines: string[] = [];
  if (!existing)
    lines.push(
      `"${incoming.manifest.name}" (version ${to}) is not in this workspace yet. It will be added as a new Kit, with ${Object.keys(incoming.classes).length} classes, ${Object.keys(incoming.relations).length} relation classes and ${Object.keys(incoming.modelTypes).length} model types.`,
    );
  else {
    lines.push(
      direction === 'same'
        ? `"${incoming.manifest.name}" will be updated. The version stays ${to}.`
        : `"${incoming.manifest.name}" will be updated from version ${from} to version ${to}.`,
    );
    if (changes.length === 0) lines.push('Nothing in the Kit changes.');
    for (const c of changes)
      lines.push(
        `${c.change === 'added' ? 'Added' : c.change === 'removed' ? 'Removed' : 'Changed'} ${c.area} ${c.name}${c.detail ? ` (${c.detail})` : ''}.`,
      );
    lines.push('Existing models keep their ids and follow the update.');
    for (const m of affectedModels)
      lines.push(`Model "${m.name}": ${m.effects.join(' ')}`);
  }
  return {
    isNew: !existing,
    kit: { id: incoming.manifest.id, name: incoming.manifest.name },
    version: { from, to, direction },
    changes,
    affectedModels,
    warnings: [...new Set(warnings)],
    lines,
  };
}

// --- importing ---------------------------------------------------------------------------------

/** What the models of the workspace made with a Kit use of it. */
export async function collectUsage(
  workspace: Workspace,
  kitId: KitId,
): Promise<ModelUsage[]> {
  const usage: ModelUsage[] = [];
  for (const entry of await workspace.listModels()) {
    if (entry.kit !== kitId) continue;
    usage.push(
      modelUsage(entry.slug, (await workspace.loadModel(entry.slug)).document),
    );
  }
  return usage;
}

export interface PreparedKitImport {
  incoming: Kit;
  /** The folder of the Kit in the workspace that this updates; null when it is new. */
  existingSlug: string | null;
  plan: KitUpdatePlan;
  scripts: Record<string, string>;
  assets: Record<string, Uint8Array>;
}

/**
 * Reads a `.mkkit` (or `.mktool`) and works out what importing it would change, without changing anything. Show
 * `plan` to the person, then call `applyKitUpdate` once they confirm.
 */
export async function prepareKitImport(
  workspace: Workspace,
  bytes: Uint8Array,
): Promise<PreparedKitImport> {
  const { kit, issues, scripts, assets } = readKitPackage(bytes);
  if (issues.length > 0)
    throw new FormatError(
      `The Kit in this package has ${issues.length} problem${issues.length === 1 ? '' : 's'}, so it was not imported: ${issues
        .slice(0, 3)
        .map((i) => `${i.path || '(top level)'}: ${i.message}`)
        .join('; ')}${issues.length > 3 ? '; and more' : ''}.`,
    );
  const existingSlug = await workspace.findKitSlug(kit.manifest.id);
  const existing = existingSlug
    ? (await workspace.loadKit(existingSlug)).document
    : null;
  const plan = planKitUpdate(
    existing,
    kit,
    existing ? await collectUsage(workspace, kit.manifest.id) : [],
  );
  if (Object.keys(scripts).length > 0)
    plan.warnings.push(
      'The package contains scripts. This version of MetaKit does not run scripts yet, so they were not added.',
    );
  return { incoming: kit, existingSlug, plan, scripts, assets };
}

/**
 * Adds the Kit to the workspace, or replaces the one with the same id. The ids in the
 * package win, so models made with the old library follow the update; values of attributes the
 * new library no longer has stay stored in the models.
 */
export async function applyKitUpdate(
  workspace: Workspace,
  prepared: Pick<PreparedKitImport, 'incoming' | 'existingSlug' | 'assets'>,
): Promise<{ slug: string; created: boolean }> {
  const { incoming, existingSlug, assets } = prepared;
  let slug: string;
  if (existingSlug === null) {
    slug = await workspace.createKit(incoming);
  } else {
    const current = (await workspace.loadKit(existingSlug)).document;
    if (current.manifest.id !== incoming.manifest.id)
      throw new FormatError(
        'The package is for a different Kit than the one it should update, so nothing was changed.',
      );
    await workspace.saveKit(existingSlug, incoming);
    slug = existingSlug;
  }
  for (const [name, bytes] of Object.entries(assets))
    await workspace.addKitAsset(slug, name, bytes);
  return { slug, created: existingSlug === null };
}

/** Bytes and a file name for a Kit in the workspace, with its assets. */
export async function exportKitPackageFrom(
  workspace: Workspace,
  kitSlug: string,
  options: Pick<ExportKitPackageOptions, 'now'> = {},
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const { document } = await workspace.loadKit(kitSlug);
  const assets: Record<string, Uint8Array> = {};
  for (const name of await workspace.listKitAssets(kitSlug))
    assets[name] = await workspace.readKitAsset(kitSlug, name);
  return exportKitPackage(document, { assets, ...options });
}
