import {
  validateKit,
  type Issue,
  type Json,
  type Kit,
} from '@metakit-app/core';
import { FormatError, NewerFormatError } from '../errors';
import { stringifyCanonical } from '../json';
import { migrate } from '../migrate';
import { GIT_KIT_FILE, OLDER_GIT_KIT_FILE } from '../names';
import type { GitFile } from './remote';

/**
 * The one-file-per-part form of a Kit (ADR 0007): `kit.json` for the manifest, the
 * settings and the order of the parts, then one file for each class, relation class, model type,
 * shape, panel layout, rule and script. Scripts are a `.ts` file with the source and a small
 * `.json` file with the rest. Ids stay inside the files, so renaming a file never changes what a
 * part is, and two people editing different parts never touch the same file.
 *
 * Repositories written before the Kit rename have `tool.json` instead of `kit.json` (ADR 0011).
 * It is read when there is no `kit.json`, and the next commit replaces it with `kit.json`.
 */

/** The parts that have a folder, with the table of the Kit, the id prefix and the plain name. */
export const LAYOUT_PARTS = [
  { table: 'classes', dir: 'classes', prefix: 'cls_', label: 'class' },
  {
    table: 'relations',
    dir: 'relations',
    prefix: 'rel_',
    label: 'relation class',
  },
  {
    table: 'modelTypes',
    dir: 'model-types',
    prefix: 'mt_',
    label: 'model type',
  },
  { table: 'shapes', dir: 'shapes', prefix: 'shp_', label: 'shape' },
  // A panel layout has no id of its own: it belongs to a class or a relation class.
  { table: 'panels', dir: 'panels', prefix: '', label: 'panel layout' },
  { table: 'rules', dir: 'rules', prefix: 'rule_', label: 'rule' },
  { table: 'scripts', dir: 'scripts', prefix: 'scr_', label: 'script' },
] as const;

export type PartTable = (typeof LAYOUT_PARTS)[number]['table'];

export const ASSET_DIR = 'assets';

/** Whether a path is the head file of a layout: `kit.json`, or `tool.json` of an older repository. */
export function isKitFile(path: string): boolean {
  return path === GIT_KIT_FILE || path === OLDER_GIT_KIT_FILE;
}

/** The head file of a layout: `kit.json`, or else the `tool.json` of an older repository. */
export function kitFileOf<T extends { path: string }>(
  files: readonly T[],
): T | undefined {
  return (
    files.find((f) => f.path === GIT_KIT_FILE) ??
    files.find((f) => f.path === OLDER_GIT_KIT_FILE)
  );
}

/** Whether a repository path belongs to the layout; README files and the like are left alone. */
export function isLayoutPath(path: string): boolean {
  return (
    isKitFile(path) ||
    LAYOUT_PARTS.some((p) => path.startsWith(`${p.dir}/`)) ||
    path.startsWith(`${ASSET_DIR}/`)
  );
}

export interface LayoutResult {
  /** Null when `kit.json` (or `tool.json`) is missing or unusable; the issues say why. */
  kit: Kit | null;
  issues: Issue[];
  /** Files under `assets/`, with the path relative to that folder. */
  assets: GitFile[];
}

interface NamedPart {
  id: string;
  name: string;
  value: unknown;
}

/** `StartEvent` and `Start event` both give `start-event`. */
export function kebab(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

const safeId = (id: string) => id.replace(/[^A-Za-z0-9_-]+/g, '-');

/**
 * File names from names. Parts whose names give the same file name all get their id as a suffix,
 * so the name does not depend on the order the parts were made in.
 */
function fileNames(parts: NamedPart[]): Map<string, string> {
  const slugs = new Map<string, string>();
  const count = new Map<string, number>();
  for (const p of parts) {
    const slug = kebab(p.name) || kebab(p.id) || 'part';
    slugs.set(p.id, slug);
    count.set(slug, (count.get(slug) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const p of parts) {
    const slug = slugs.get(p.id) ?? 'part';
    let name = (count.get(slug) ?? 0) > 1 ? `${slug}-${safeId(p.id)}` : slug;
    for (let n = 2; used.has(name); n++) name = `${slug}-${safeId(p.id)}-${n}`;
    used.add(name);
    out.set(p.id, name);
  }
  return out;
}

const json = (path: string, value: unknown): GitFile => ({
  path,
  content: stringifyCanonical(value as Json),
});

type Table = Record<string, Record<string, unknown> & { id?: string }>;

function partName(
  table: PartTable,
  id: string,
  def: Record<string, unknown>,
  kit: Kit,
): string {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  switch (table) {
    case 'shapes':
      return str(def.name) || id;
    case 'rules':
      return str(def.label) || id;
    case 'scripts':
      return str(def.name) || id;
    case 'panels': {
      const owner = kit.classes[id as never] ?? kit.relations[id as never];
      return str(owner?.key) || id;
    }
    default:
      return str(def.key) || id;
  }
}

/**
 * The files of a Kit. Equal Kits give equal files, and the files are sorted
 * by path. `assets` have paths relative to `assets/` (an optional `assets/` prefix is accepted).
 */
export function toLayout(kit: Kit, assets: readonly GitFile[] = []): GitFile[] {
  const files: GitFile[] = [];
  const parts: Record<string, string[]> = {};
  for (const part of LAYOUT_PARTS) {
    const table = (kit[part.table] ?? {}) as unknown as Table;
    // Sorted: the key order of a table is not kept when a Kit goes through sync, so an
    // order taken from it would show up as a change nobody made.
    const ids = Object.keys(table).sort();
    parts[part.table] = ids;
    const names = fileNames(
      ids.map((id) => ({
        id,
        value: table[id],
        name: partName(part.table, id, table[id] ?? {}, kit),
      })),
    );
    for (const id of ids) {
      const def = table[id] ?? {};
      const base = `${part.dir}/${names.get(id) ?? id}`;
      if (part.table === 'scripts') {
        const { source, ...rest } = def as { source?: unknown };
        files.push(json(`${base}.json`, rest));
        files.push({
          path: `${base}.ts`,
          content: typeof source === 'string' ? source : '',
        });
      } else files.push(json(`${base}.json`, def));
    }
  }
  files.push(
    json(GIT_KIT_FILE, {
      formatVersion: kit.formatVersion,
      manifest: kit.manifest,
      settings: kit.settings,
      parts,
    }),
  );
  for (const asset of assets) {
    const rel = asset.path.replace(new RegExp(`^${ASSET_DIR}/`), '');
    files.push({ ...asset, path: `${ASSET_DIR}/${rel}` });
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Reads the files back. A file that cannot be read is reported with its path and left out; the
 * other files still load. Files outside the layout (a README, say) are ignored.
 */
export function fromLayout(files: readonly GitFile[]): LayoutResult {
  const issues: Issue[] = [];
  const assets: GitFile[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));

  const parse = (file: GitFile): unknown => {
    try {
      return JSON.parse(file.content);
    } catch (error) {
      issues.push({
        path: file.path,
        message: `This file is not valid JSON: ${(error as Error).message}`,
      });
      return undefined;
    }
  };

  for (const f of files)
    if (f.path.startsWith(`${ASSET_DIR}/`))
      assets.push({ ...f, path: f.path.slice(ASSET_DIR.length + 1) });

  const head = kitFileOf(files);
  if (!head) {
    issues.push({
      path: GIT_KIT_FILE,
      message:
        'This file is missing, so the Kit cannot be read. It holds the name, settings and order of the parts.',
    });
    return { kit: null, issues, assets };
  }
  const headPath = head.path;
  const top = parse(head);
  if (!isObject(top)) {
    if (top !== undefined)
      issues.push({
        path: headPath,
        message: 'This file must hold an object.',
      });
    return { kit: null, issues, assets };
  }
  if (!isObject(top.manifest) || !isObject(top.settings)) {
    issues.push({
      path: headPath,
      message: 'This file needs a "manifest" and "settings".',
    });
    return { kit: null, issues, assets };
  }

  const order = isObject(top.parts) ? top.parts : {};
  const tables: Record<string, Record<string, unknown>> = {};
  const owner = new Map<string, string>(); // "table.id" -> file path, to place validation issues

  for (const part of LAYOUT_PARTS) {
    const found: {
      id: string;
      path: string;
      value: Record<string, unknown>;
    }[] = [];
    const prefix = `${part.dir}/`;
    for (const file of files) {
      if (
        !file.path.startsWith(prefix) ||
        file.path.slice(prefix.length).includes('/')
      )
        continue;
      if (!file.path.endsWith('.json')) {
        if (part.table === 'scripts' && file.path.endsWith('.ts')) {
          if (!byPath.has(`${file.path.slice(0, -3)}.json`))
            issues.push({
              path: file.path,
              message:
                'This script has no .json file next to it with its id and name, so it was left out.',
            });
        }
        continue;
      }
      const value = parse(file);
      if (value === undefined) continue;
      if (!isObject(value)) {
        issues.push({
          path: file.path,
          message: 'This file must hold an object.',
        });
        continue;
      }
      const id = part.table === 'panels' ? value.class : value.id;
      if (
        typeof id !== 'string' ||
        (part.prefix !== '' && !id.startsWith(part.prefix))
      ) {
        issues.push({
          path: file.path,
          message:
            part.table === 'panels'
              ? 'This panel layout needs a "class" with the id of a class or relation class.'
              : `This ${part.label} needs an "id" starting with ${part.prefix}.`,
        });
        continue;
      }
      if (part.table === 'scripts') {
        const ts = byPath.get(`${file.path.slice(0, -5)}.ts`);
        if (!ts) {
          issues.push({
            path: file.path,
            message: 'The .ts file with the source of this script is missing.',
          });
          value.source = '';
        } else value.source = ts.content;
      }
      found.push({ id, path: file.path, value });
    }
    const ranked = Array.isArray(order[part.table])
      ? (order[part.table] as unknown[])
      : [];
    const rank = (id: string) => {
      const at = ranked.indexOf(id);
      return at < 0 ? Number.MAX_SAFE_INTEGER : at;
    };
    found.sort(
      (a, b) =>
        rank(a.id) - rank(b.id) ||
        (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    );
    const table: Record<string, unknown> = {};
    for (const item of found) {
      if (item.id in table) {
        issues.push({
          path: item.path,
          message: `The id ${item.id} is already used by ${owner.get(`${part.table}.${item.id}`) ?? 'another file'}, so this file was left out.`,
        });
        continue;
      }
      table[item.id] = item.value;
      owner.set(`${part.table}.${item.id}`, item.path);
    }
    tables[part.table] = table;
  }

  let value: Record<string, unknown>;
  try {
    value = migrate('kit-document', {
      formatVersion: top.formatVersion,
      manifest: top.manifest,
      settings: top.settings,
      ...tables,
    }).value;
  } catch (error) {
    if (error instanceof FormatError || error instanceof NewerFormatError) {
      issues.push({ path: headPath, message: error.message });
      return { kit: null, issues, assets };
    }
    throw error;
  }

  const placed =
    /^(classes|relations|modelTypes|shapes|panels|rules|scripts)\.([^.[]+)/;
  for (const issue of validateKit(value)) {
    const m = placed.exec(issue.path);
    const where = m ? owner.get(`${m[1]}.${m[2]}`) : undefined;
    issues.push({
      path: where ?? headPath,
      message: where
        ? `${issue.path}: ${issue.message}`
        : `${issue.path || '(top level)'}: ${issue.message}`,
    });
  }
  return { kit: value as unknown as Kit, issues, assets };
}
