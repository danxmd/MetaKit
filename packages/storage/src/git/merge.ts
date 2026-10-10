import type { Json } from '@metakit-app/core';
import { stringifyCanonical } from '../json';
import { GIT_KIT_FILE } from '../names';
import { isKitFile, isLayoutPath, kitFileOf, LAYOUT_PARTS } from './layout';
import type { GitChange, GitFile } from './remote';

/**
 * Three-way merge of two layouts against their common base (ADR 0007). Files are matched by the
 * id kept inside them, so renaming a class on one side does not clash with editing it on the
 * other. Each matched file is merged field by field; only a field that both sides changed to
 * different values is a conflict.
 */

/** A step into a JSON value: an object key, or the element of a list that has this `id`. */
export type Step = string | { id: string };

export interface MergeConflict {
  /** The file as it is in the merged layout. */
  path: string;
  /** Where in the file, in plain words: `attributes > Name > labels > en`. Empty for a whole file. */
  field: string;
  /** Same place as `field`, for programs. */
  steps: Step[];
  /** What the part is called, such as `class "Task"`. */
  part: string;
  /** Values as parsed JSON; undefined means the field or file is not there. */
  base: Json | undefined;
  ours: Json | undefined;
  theirs: Json | undefined;
}

export type Choice = 'ours' | 'theirs';
export type Resolutions = Record<string, Choice>;

/** The key of a conflict in `Resolutions`. */
export const conflictKey = (c: Pick<MergeConflict, 'path' | 'steps'>): string =>
  `${c.path}\u0000${JSON.stringify(c.steps)}`;

interface Unit {
  identity: string;
  path: string;
  /** Parsed JSON, or text for files that are not JSON. */
  doc: Json;
  /** How to write `doc` back. */
  kind: 'json' | 'text' | 'script';
  encoding?: 'utf8' | 'base64';
}

export interface MergeResult {
  files: GitFile[];
  conflicts: MergeConflict[];
  /** Kept so that `applyResolutions` can change single fields. */
  readonly units: readonly Unit[];
}

const MISSING = Symbol('missing');
type Merged = Json | typeof MISSING;

const isObject = (v: unknown): v is { [k: string]: Json } =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Deep equality of JSON values; key order does not matter. */
export function jsonEqual(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  )
    return false;
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => jsonEqual(x, b[i]))
    );
  }
  if (Array.isArray(b)) return false;
  const ak = Object.keys(a);
  return (
    ak.length === Object.keys(b).length &&
    ak.every((k) => k in b && jsonEqual(a[k], b[k]))
  );
}

// -- Units: the files of a layout, matched by the ids inside them -------------------------------

const DIR_KEY: Record<string, string> = Object.fromEntries(
  LAYOUT_PARTS.map((p) => [p.dir, p.table]),
);

function parseJson(text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return undefined;
  }
}

function unitsOf(files: readonly GitFile[]): Unit[] {
  // `kit.json` and the `tool.json` of an older repository are one unit, so that the rename to
  // `kit.json` is a move, not a removal and an addition. Only one of them is used (ADR 0011).
  const head = kitFileOf(files);
  const byPath = new Map(
    files
      .filter((f) => isLayoutPath(f.path) && (!isKitFile(f.path) || f === head))
      .map((f) => [f.path, f]),
  );
  const units: Unit[] = [];
  const used = new Set<string>();
  for (const file of byPath.values()) {
    if (used.has(file.path)) continue;
    used.add(file.path);
    const dir = file.path.split('/')[0] ?? '';
    const parsed =
      file.path.endsWith('.json') && file.encoding !== 'base64'
        ? parseJson(file.content)
        : undefined;
    if (parsed === undefined) {
      // A script source is paired with its json below; alone it is a text file.
      if (file.path.endsWith('.ts') && dir === 'scripts') {
        const mate = byPath.get(`${file.path.slice(0, -3)}.json`);
        if (mate && isObject(parseJson(mate.content))) continue;
      }
      units.push({
        identity: file.path,
        path: file.path,
        doc: file.content,
        kind: 'text',
        ...(file.encoding ? { encoding: file.encoding } : {}),
      });
      continue;
    }
    if (isKitFile(file.path)) {
      units.push({
        identity: GIT_KIT_FILE,
        path: file.path,
        doc: parsed,
        kind: 'json',
      });
      continue;
    }
    if (!isObject(parsed) || DIR_KEY[dir] === undefined) {
      units.push({
        identity: file.path,
        path: file.path,
        doc: parsed,
        kind: 'json',
      });
      continue;
    }
    const key = dir === 'panels' ? parsed.class : parsed.id;
    if (typeof key !== 'string') {
      units.push({
        identity: file.path,
        path: file.path,
        doc: parsed,
        kind: 'json',
      });
      continue;
    }
    if (dir === 'scripts') {
      const tsPath = `${file.path.slice(0, -5)}.ts`;
      const ts = byPath.get(tsPath);
      if (ts) used.add(tsPath);
      units.push({
        identity: `${dir}:${key}`,
        path: file.path,
        doc: { ...parsed, source: ts?.content ?? '' },
        kind: 'script',
      });
      continue;
    }
    units.push({
      identity: `${dir}:${key}`,
      path: file.path,
      doc: parsed,
      kind: 'json',
    });
  }
  return units;
}

function render(unit: Unit): GitFile[] {
  switch (unit.kind) {
    case 'text':
      return [
        {
          path: unit.path,
          content: String(unit.doc),
          ...(unit.encoding ? { encoding: unit.encoding } : {}),
        },
      ];
    case 'script': {
      const { source, ...rest } = unit.doc as { [k: string]: Json };
      return [
        { path: unit.path, content: stringifyCanonical(rest) },
        {
          path: `${unit.path.slice(0, -5)}.ts`,
          content: typeof source === 'string' ? source : '',
        },
      ];
    }
    default:
      return [{ path: unit.path, content: stringifyCanonical(unit.doc) }];
  }
}

// -- Field merge --------------------------------------------------------------------------------

const byIdList = (v: Json | undefined): v is { [k: string]: Json }[] =>
  Array.isArray(v) &&
  v.every((x) => isObject(x) && typeof x.id === 'string') &&
  new Set(v.map((x) => (x as { id: string }).id)).size === v.length;

/** The ids in a merged order: keep the order of the side that moved things, then add the rest. */
function mergeOrder(
  base: string[],
  ours: string[],
  theirs: string[],
): string[] {
  const inBase = new Set(base);
  const inOurs = new Set(ours);
  const inTheirs = new Set(theirs);
  const alive = (id: string) =>
    (inOurs.has(id) || !inBase.has(id)) &&
    (inTheirs.has(id) || !inBase.has(id));
  const sameOrder = (a: string[], other: Set<string>) =>
    base.filter((id) => other.has(id)).join('\u0000') ===
    a.filter((id) => inBase.has(id)).join('\u0000');
  const theirsMoved = !sameOrder(theirs, inTheirs);
  const oursMoved = !sameOrder(ours, inOurs);
  const primary = !oursMoved && theirsMoved ? theirs : ours;
  const other = primary === ours ? theirs : ours;
  const result = primary.filter(alive);
  const placed = new Set(result);
  other.forEach((id, i) => {
    if (placed.has(id) || !alive(id)) return;
    const before = other
      .slice(0, i)
      .reverse()
      .find((x) => placed.has(x));
    let at = i === 0 ? 0 : result.length;
    if (before !== undefined) {
      // After the neighbour, and after anything the other side added at the same spot.
      at = result.indexOf(before) + 1;
      while (at < result.length && !inBase.has(result[at]!)) at++;
    }
    result.splice(at, 0, id);
    placed.add(id);
  });
  return result;
}

interface Context {
  conflicts: Omit<MergeConflict, 'path' | 'part'>[];
}

const stepsText = (steps: Step[]): string =>
  steps.map((s) => (typeof s === 'string' ? s : s.id)).join(' > ');

function mergeValue(
  base: Json | undefined,
  ours: Json | undefined,
  theirs: Json | undefined,
  steps: Step[],
  ctx: Context,
): Merged {
  if (jsonEqual(ours, theirs))
    return ours === undefined ? MISSING : (ours as Json);
  if (jsonEqual(base, ours))
    return theirs === undefined ? MISSING : (theirs as Json);
  if (jsonEqual(base, theirs))
    return ours === undefined ? MISSING : (ours as Json);

  if (
    isObject(ours) &&
    isObject(theirs) &&
    (base === undefined || isObject(base))
  ) {
    const b = base ?? {};
    const out: { [k: string]: Json } = {};
    const keys = new Set([
      ...Object.keys(b),
      ...Object.keys(ours),
      ...Object.keys(theirs),
    ]);
    for (const k of [...keys].sort()) {
      const m = mergeValue(b[k], ours[k], theirs[k], [...steps, k], ctx);
      if (m !== MISSING) out[k] = m;
    }
    return out;
  }

  // The lists of part ids in kit.json: adding on one side and removing on the other both count.
  const isIdList = (v: Json | undefined): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === 'string');
  if (
    steps[0] === 'parts' &&
    isIdList(ours) &&
    isIdList(theirs) &&
    (base === undefined || isIdList(base))
  )
    return mergeOrder(base ?? [], ours, theirs);

  // Lists of things with ids (attributes, constraints, views): merge by id.
  if (
    byIdList(ours) &&
    byIdList(theirs) &&
    (base === undefined || byIdList(base))
  ) {
    const find = (list: { [k: string]: Json }[] | undefined, id: string) =>
      list?.find((x) => x.id === id);
    const ids = mergeOrder(
      (base ?? []).map((x) => x.id as string),
      ours.map((x) => x.id as string),
      theirs.map((x) => x.id as string),
    );
    const all = new Set([
      ...(base ?? []).map((x) => x.id as string),
      ...ours.map((x) => x.id as string),
      ...theirs.map((x) => x.id as string),
    ]);
    const merged = new Map<string, Json>();
    for (const id of [...all].sort()) {
      const m = mergeValue(
        find(base, id),
        find(ours, id),
        find(theirs, id),
        [...steps, { id }],
        ctx,
      );
      if (m !== MISSING) merged.set(id, m);
    }
    // A conflict can keep an element one side removed; it is placed after the others.
    const order = [
      ...ids,
      ...[...merged.keys()].filter((id) => !ids.includes(id)),
    ];
    return order
      .filter((id) => merged.has(id))
      .map((id) => merged.get(id) as Json);
  }

  ctx.conflicts.push({
    field: stepsText(steps),
    steps,
    base,
    ours,
    theirs,
  });
  return ours === undefined ? MISSING : (ours as Json);
}

function nameOf(unit: Unit | undefined): string {
  if (!unit) return 'file';
  const dir = unit.path.split('/')[0] ?? '';
  const part = LAYOUT_PARTS.find((p) => p.dir === dir);
  if (isKitFile(unit.path)) return 'Kit settings';
  if (!part || !isObject(unit.doc)) return `file ${unit.path}`;
  const d = unit.doc;
  const pick = (k: string) =>
    typeof d[k] === 'string' ? (d[k] as string) : '';
  const name =
    part.table === 'shapes'
      ? pick('name')
      : part.table === 'rules'
        ? pick('label')
        : part.table === 'scripts'
          ? pick('name')
          : part.table === 'panels'
            ? pick('class')
            : pick('key');
  return name ? `${part.label} "${name}"` : part.label;
}

function uniquePath(path: string, taken: Set<string>, suffix: string): string {
  if (!taken.has(path)) return path;
  const dot = path.lastIndexOf('.');
  const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
  const ext = stem === path ? '' : path.slice(dot);
  let candidate = `${stem}-${suffix}${ext}`;
  for (let n = 2; taken.has(candidate); n++)
    candidate = `${stem}-${suffix}-${n}${ext}`;
  return candidate;
}

export function mergeLayouts(
  baseFiles: readonly GitFile[],
  oursFiles: readonly GitFile[],
  theirsFiles: readonly GitFile[],
): MergeResult {
  const index = (files: readonly GitFile[]) =>
    new Map(unitsOf(files).map((u) => [u.identity, u]));
  const base = index(baseFiles);
  const ours = index(oursFiles);
  const theirs = index(theirsFiles);
  const identities = [
    ...new Set([...base.keys(), ...ours.keys(), ...theirs.keys()]),
  ].sort();

  const units: Unit[] = [];
  const conflicts: MergeConflict[] = [];
  const taken = new Set<string>();

  for (const identity of identities) {
    const b = base.get(identity);
    const o = ours.get(identity);
    const t = theirs.get(identity);
    const ctx: Context = { conflicts: [] };
    const kind = (o ?? t ?? b)!.kind;
    // Text and binary files are one value; so is a file that is JSON on one side and text on the other.
    const wholeFile =
      kind === 'text' || [b, o, t].some((u) => u && u.kind === 'text');
    const merged = wholeFile
      ? mergeWhole(b, o, t, ctx)
      : mergeValue(b?.doc, o?.doc, t?.doc, [], ctx);
    // The path: a rename on one side wins over no change on the other.
    const path =
      o && t
        ? o.path === t.path
          ? o.path
          : b && o.path === b.path
            ? t.path
            : o.path
        : (o ?? t)?.path;
    if (path === undefined) continue;
    const finalPath = uniquePath(path, taken, identity.split(':')[1] ?? 'copy');
    for (const c of ctx.conflicts)
      conflicts.push({ ...c, path: finalPath, part: nameOf(o ?? t ?? b) });
    // Gone on one side and untouched on the other, or deleted by us in a clash: no file.
    if (merged === MISSING) continue;
    taken.add(finalPath);
    const sample = o ?? t ?? b!;
    units.push({
      identity,
      path: finalPath,
      doc: merged,
      kind: wholeFile ? 'text' : sample.kind,
      ...(sample.encoding ? { encoding: sample.encoding } : {}),
    });
  }
  const files = units
    .flatMap(render)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, conflicts, units };
}

function mergeWhole(
  b: Unit | undefined,
  o: Unit | undefined,
  t: Unit | undefined,
  ctx: Context,
): Merged {
  const text = (u: Unit | undefined) =>
    u === undefined
      ? undefined
      : typeof u.doc === 'string'
        ? u.doc
        : stringifyCanonical(u.doc);
  return mergeValue(text(b), text(o), text(t), [], ctx);
}

/**
 * Applies the person's choices to a merge. A conflict without a choice keeps our side. Returns
 * the files of the merged layout.
 */
export function applyResolutions(
  result: MergeResult,
  choices: Resolutions,
): GitFile[] {
  const wanted = result.conflicts.filter(
    (c) => choices[conflictKey(c)] === 'theirs',
  );
  if (wanted.length === 0) return result.files;
  const units = result.units.map((u) => ({ ...u }));
  const gone = new Set<Unit>();
  for (const c of wanted) {
    const unit = units.find((u) => u.path === c.path);
    if (!unit) continue;
    if (c.steps.length === 0) {
      if (c.theirs === undefined) gone.add(unit);
      else unit.doc = c.theirs;
      continue;
    }
    unit.doc = setAt(unit.doc, c.steps, c.theirs);
  }
  // A file deleted by ours but kept by theirs is not in `units`; bring it back.
  for (const c of wanted) {
    if (
      c.steps.length === 0 &&
      c.theirs !== undefined &&
      !units.some((u) => u.path === c.path)
    )
      units.push({
        identity: c.path,
        path: c.path,
        doc: c.theirs,
        kind: c.path.endsWith('.json') ? 'json' : 'text',
      });
  }
  return units
    .filter((u) => !gone.has(u))
    .flatMap(render)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function setAt(doc: Json, steps: Step[], value: Json | undefined): Json {
  const [step, ...rest] = steps;
  if (step === undefined) return value ?? null;
  if (typeof step === 'string') {
    const obj = isObject(doc) ? { ...doc } : {};
    if (rest.length === 0) {
      if (value === undefined) delete obj[step];
      else obj[step] = value;
    } else obj[step] = setAt(obj[step] ?? {}, rest, value);
    return obj;
  }
  const list = Array.isArray(doc) ? [...doc] : [];
  const at = list.findIndex((x) => isObject(x) && x.id === step.id);
  if (rest.length === 0) {
    if (value === undefined) {
      if (at >= 0) list.splice(at, 1);
    } else if (at >= 0) list[at] = value;
    else list.push(value);
  } else if (at >= 0) list[at] = setAt(list[at] as Json, rest, value);
  return list;
}

// -- What changed ---------------------------------------------------------------------------------

export interface PartChange {
  /** The file of the changed part (the new path for a rename). */
  path: string;
  change: 'added' | 'changed' | 'removed';
  /** `class`, `shape`, `script`, `Kit settings`, `asset`, ... */
  part: string;
  /** The key or name, empty if the part has none. */
  name: string;
  /** For example `class "Task" changed (labels, attributes)`. */
  text: string;
}

const PART_WORDS: Record<string, string> = Object.fromEntries(
  LAYOUT_PARTS.map((p) => [p.dir, p.label]),
);

function unitName(u: Unit): { part: string; name: string } {
  const dir = u.path.split('/')[0] ?? '';
  if (isKitFile(u.path)) return { part: 'Kit settings', name: '' };
  if (dir === 'assets') return { part: 'asset', name: u.path.slice(7) };
  const part = PART_WORDS[dir];
  if (part === undefined || !isObject(u.doc))
    return { part: 'file', name: u.path };
  const pick = (k: string) =>
    typeof u.doc === 'object' &&
    u.doc &&
    !Array.isArray(u.doc) &&
    typeof u.doc[k] === 'string'
      ? (u.doc[k] as string)
      : '';
  const table = DIR_KEY[dir];
  const name =
    table === 'shapes' || table === 'scripts'
      ? pick('name')
      : table === 'rules'
        ? pick('label')
        : table === 'panels'
          ? pick('class')
          : pick('key');
  return { part, name };
}

/** The parts that differ between two layouts, in plain English. Files outside the layout are ignored. */
export function describeChanges(
  from: readonly GitFile[],
  to: readonly GitFile[],
): PartChange[] {
  const a = new Map(unitsOf(from).map((u) => [u.identity, u]));
  const b = new Map(unitsOf(to).map((u) => [u.identity, u]));
  const out: PartChange[] = [];
  const make = (
    u: Unit,
    change: PartChange['change'],
    detail = '',
  ): PartChange => {
    const { part, name } = unitName(u);
    const subject = name ? `${part} "${name}"` : part;
    return {
      path: u.path,
      change,
      part,
      name,
      text: `${subject[0]!.toUpperCase()}${subject.slice(1)} ${change}${detail}`,
    };
  };
  for (const [id, u] of [...b].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const old = a.get(id);
    if (!old) {
      out.push(make(u, 'added'));
      continue;
    }
    const same =
      old.path === u.path &&
      jsonEqual(old.doc, u.doc) &&
      old.encoding === u.encoding;
    if (same) continue;
    const details: string[] = [];
    if (old.path !== u.path) details.push(`renamed from ${old.path}`);
    if (isObject(old.doc) && isObject(u.doc)) {
      const o = old.doc;
      const n = u.doc;
      details.push(
        ...[...new Set([...Object.keys(o), ...Object.keys(n)])]
          .filter((k) => !jsonEqual(o[k], n[k]))
          .sort(),
      );
    }
    out.push(
      make(u, 'changed', details.length > 0 ? ` (${details.join(', ')})` : ''),
    );
  }
  for (const [id, u] of [...a].sort(([x], [y]) => (x < y ? -1 : 1)))
    if (!b.has(id)) out.push(make(u, 'removed'));
  return out;
}

/** The file changes that turn `from` into `to`, as one commit sends them. */
export function fileChanges(
  from: readonly GitFile[],
  to: readonly GitFile[],
): GitChange[] {
  const a = new Map(
    from.filter((f) => isLayoutPath(f.path)).map((f) => [f.path, f]),
  );
  const b = new Map(
    to.filter((f) => isLayoutPath(f.path)).map((f) => [f.path, f]),
  );
  const out: GitChange[] = [];
  for (const [path, f] of [...b].sort(([x], [y]) => (x < y ? -1 : 1))) {
    const old = a.get(path);
    if (old && old.content === f.content && old.encoding === f.encoding)
      continue;
    out.push({
      path,
      content: f.content,
      ...(f.encoding ? { encoding: f.encoding } : {}),
    });
  }
  for (const path of [...a.keys()].sort())
    if (!b.has(path)) out.push({ path, content: null });
  return out;
}
