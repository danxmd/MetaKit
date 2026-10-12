/** A path into a document, as the sync layer sees it (same as the store's patch paths). */
export type Path = readonly string[];

export type DocKind = 'kit' | 'model';

/**
 * The kind a file names, as this release calls it. Releases before the Kit rename wrote `tool`
 * for a Kit (ADR 0011); it is read as `kit`. Anything else is null.
 */
export function docKindOf(value: unknown): DocKind | null {
  if (value === 'kit' || value === 'tool') return 'kit';
  if (value === 'model') return 'model';
  return null;
}

/**
 * Registers that earlier releases wrote under another name, by parent and old name (ADR 0011). A
 * path is read as its new name wherever it comes from (change files, snapshots, plain documents),
 * so an old snapshot and new change files meet in one register, and the last write wins as usual.
 * New ops are always written with the new names.
 */
export const PATH_ALIASES: Readonly<
  Record<DocKind, ReadonlyMap<string, ReadonlyMap<string, string>>>
> = {
  model: new Map([
    [
      'manifest',
      new Map([
        ['tool', 'kit'],
        ['toolVersion', 'kitVersion'],
      ]),
    ],
  ]),
  kit: new Map(),
};

/** The path as this release names it: `manifest/tool` of a model becomes `manifest/kit`. */
export function currentPath(kind: DocKind, path: string[]): string[] {
  if (path.length !== 2) return path;
  const renamed = PATH_ALIASES[kind].get(path[0]!)?.get(path[1]!);
  return renamed === undefined ? path : [path[0]!, renamed];
}

/**
 * The collections whose records are entities: each record is created, deleted and edited as one
 * unit, with its own birth and death stamps (ADR 0002).
 */
export const COLLECTIONS: Readonly<Record<DocKind, readonly string[]>> = {
  model: ['elements', 'connectors'],
  kit: [
    'classes',
    'relations',
    'modelTypes',
    'shapes',
    'panels',
    'rules',
    'scripts',
  ],
};

const escapePart = (part: string): string =>
  part.replace(/~/g, '~0').replace(/\//g, '~1');

/** A path as one string, usable as a map key; `/` and `~` inside a part are escaped. */
export function pathKey(path: Path): string {
  return path.map(escapePart).join('/');
}

export function keyToPath(key: string): string[] {
  if (key === '') return [];
  return key.split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export interface EntityRef {
  collection: string;
  id: string;
  /** The path below the entity; empty for an entity-level op (birth, death). */
  rest: string[];
}

/** Which entity a path belongs to, or null for a path outside the collections. */
export function entityOf(kind: DocKind, path: Path): EntityRef | null {
  if (path.length >= 2 && COLLECTIONS[kind].includes(path[0]!))
    return { collection: path[0]!, id: path[1]!, rest: path.slice(2) };
  return null;
}

export const entityKey = (collection: string, id: string): string =>
  `${collection}/${id}`;
