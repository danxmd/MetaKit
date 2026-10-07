/** Kind prefixes of stable identifiers. `mdl_` and `vw_` extend the list in CLAUDE.md. */
export const ID_PREFIXES = {
  tool: 'tool',
  class: 'cls',
  relation: 'rel',
  attribute: 'att',
  modelType: 'mt',
  shape: 'shp',
  element: 'el',
  connector: 'cn',
  model: 'mdl',
  view: 'vw',
  rule: 'rule',
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

export type ToolId = `tool_${string}`;
export type ClassId = `cls_${string}`;
export type RelationId = `rel_${string}`;
export type AttributeId = `att_${string}`;
export type ModelTypeId = `mt_${string}`;
export type ShapeId = `shp_${string}`;
export type ElementId = `el_${string}`;
export type ConnectorId = `cn_${string}`;
export type ModelId = `mdl_${string}`;
export type ViewId = `vw_${string}`;

export interface RandomSource {
  getRandomValues(array: Uint8Array): Uint8Array;
}

// 32 characters, no vowels that spell words and no look-alikes (i, l, o, u).
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const LENGTH = 10;

function platformRandom(): RandomSource {
  const source = (globalThis as unknown as { crypto?: RandomSource }).crypto;
  if (!source)
    throw new Error('No random source is available on this platform');
  return source;
}

/**
 * `<prefix>_<10 base-32 characters>`: 50 random bits. 256 is a multiple of 32, so masking a
 * random byte to five bits keeps every character equally likely.
 */
export function newId<K extends IdKind>(
  kind: K,
  random: RandomSource = platformRandom(),
): `${(typeof ID_PREFIXES)[K]}_${string}` {
  const bytes = random.getRandomValues(new Uint8Array(LENGTH));
  let text = '';
  for (const byte of bytes) text += ALPHABET[byte & 31];
  return `${ID_PREFIXES[kind]}_${text}`;
}

export function idKind(id: string): IdKind | null {
  const underscore = id.indexOf('_');
  if (underscore <= 0) return null;
  const prefix = id.slice(0, underscore);
  for (const [kind, p] of Object.entries(ID_PREFIXES)) {
    if (p === prefix) return kind as IdKind;
  }
  return null;
}

/** True when `id` has the prefix of `kind` and something after it. */
export function isId(kind: IdKind, id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.startsWith(`${ID_PREFIXES[kind]}_`) &&
    id.length > ID_PREFIXES[kind].length + 1
  );
}
