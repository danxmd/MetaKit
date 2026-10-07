/** A path into a document, as the sync layer sees it (same as the store's patch paths). */
export type Path = readonly string[];

export type DocKind = 'tool' | 'model';

/**
 * The collections whose records are entities: each record is created, deleted and edited as one
 * unit, with its own birth and death stamps (ADR 0002).
 */
export const COLLECTIONS: Readonly<Record<DocKind, readonly string[]>> = {
  model: ['elements', 'connectors'],
  tool: ['classes', 'relations', 'modelTypes', 'shapes', 'panels', 'rules'],
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
