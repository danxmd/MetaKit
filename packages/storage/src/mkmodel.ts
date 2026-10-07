import {
  MODEL_FORMAT_VERSION,
  DEFAULT_ELEMENT_SIZE,
  effectiveAttributes,
  effectiveRelationAttributes,
  findClassByKey,
  findModelTypeByKey,
  findRelationByKey,
  inDrawingOrder,
  initialPositions,
  isId,
  newId,
  validateModelDocument,
  whyNotJson,
  type AttributeDef,
  type AttributeId,
  type ClassId,
  type ConnectorData,
  type ConnectorId,
  type ElementData,
  type ElementId,
  type Json,
  type Model,
  type ModelId,
  type ModelTypeId,
  type Point,
  type RandomSource,
  type RelationId,
  type ToolId,
  type ToolLibrary,
} from '@metakit-app/core';
import { FormatError } from './errors';
import { stringifyCanonical } from './json';
import { migrate } from './migrate';
import type { Workspace } from './workspace';
import { slugify } from './slugify';

/** One problem in an editable model file: where, and what. */
export interface MkModelIssue {
  path: string;
  message: string;
}

export class MkModelError extends FormatError {
  constructor(readonly issues: MkModelIssue[]) {
    super(
      `The model file has ${issues.length} problem${issues.length === 1 ? '' : 's'}:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`,
    );
  }
}

interface MkElement {
  id: string;
  class: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  parent?: string;
  attributes?: Record<string, Json>;
}

interface MkConnector {
  id?: string;
  relation: string;
  from: string;
  to: string;
  bends?: Point[];
  attributes?: Record<string, Json>;
}

/**
 * The model as a person writes and reads it: classes, relation classes and attributes by their
 * keys, elements in drawing order (bottom first). Everything else is as in the model.
 */
export interface MkModelFile {
  formatVersion: number;
  kind: 'mkmodel';
  id?: string;
  name: string;
  tool?: { id?: string; name?: string; version?: string };
  modelType: string;
  folder?: string;
  attributes?: Record<string, Json>;
  elements: MkElement[];
  connectors?: MkConnector[];
}

/** The key of an attribute, or its raw id when the tool no longer defines it (so nothing is lost). */
function attrKey(defs: AttributeDef[], id: string): string {
  return defs.find((d) => d.id === id)?.key ?? id;
}

function keyed(
  defs: AttributeDef[],
  values: Record<string, Json>,
): Record<string, Json> | undefined {
  const entries = Object.entries(values).map(
    ([id, v]) => [attrKey(defs, id), v] as const,
  );
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

function defsOf(read: () => AttributeDef[]): AttributeDef[] {
  try {
    return read();
  } catch {
    return [];
  }
}

export function toMkModel(tool: ToolLibrary, model: Model): MkModelFile {
  const modelType = tool.modelTypes[model.manifest.modelType];
  const known = tool.manifest.id === model.manifest.tool;
  const elements = inDrawingOrder(model.elements).map((e): MkElement => {
    const cls = tool.classes[e.class];
    const defs = cls ? defsOf(() => effectiveAttributes(tool, e.class)) : [];
    const attributes = keyed(defs, e.attrs);
    return {
      id: e.id,
      class: cls?.key ?? e.class,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      ...(e.parent === undefined ? {} : { parent: e.parent }),
      ...(attributes ? { attributes } : {}),
    };
  });
  const connectors = inDrawingOrder(model.connectors).map((c): MkConnector => {
    const rel = tool.relations[c.relation];
    const defs = rel
      ? defsOf(() => effectiveRelationAttributes(tool, c.relation))
      : [];
    const attributes = keyed(defs, c.attrs);
    return {
      id: c.id,
      relation: rel?.key ?? c.relation,
      from: c.from,
      to: c.to,
      ...(c.bends.length > 0 ? { bends: c.bends } : {}),
      ...(attributes ? { attributes } : {}),
    };
  });
  const modelAttributes = keyed(modelType?.attributes ?? [], model.attrs);
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    kind: 'mkmodel',
    id: model.manifest.id,
    name: model.manifest.name,
    tool: {
      id: model.manifest.tool,
      ...(known ? { name: tool.manifest.name } : {}),
      version: model.manifest.toolVersion,
    },
    modelType: modelType?.key ?? model.manifest.modelType,
    ...(model.manifest.folder === undefined
      ? {}
      : { folder: model.manifest.folder }),
    ...(modelAttributes ? { attributes: modelAttributes } : {}),
    elements,
    ...(connectors.length > 0 ? { connectors } : {}),
  };
}

/** The text of the editable model file, in canonical form. */
export function exportMkModel(tool: ToolLibrary, model: Model): string {
  return stringifyCanonical(toMkModel(tool, model) as unknown as Json);
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(
        row[j]! + 1,
        row[j - 1]! + 1,
        prev + (a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase() ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return row[b.length]!;
}

function didYouMean(name: string, options: string[]): string {
  const lower = name.toLowerCase();
  const scored = options.map((o) => {
    const l = o.toLowerCase();
    // A typo (a letter or two off, or two letters swapped) or the start of a longer name.
    const prefix =
      lower.length >= 3 && (l.startsWith(lower) || lower.startsWith(l));
    return [o, prefix ? 0 : distance(name, o)] as const;
  });
  const best = scored.sort((a, b) => a[1] - b[1])[0];
  const hint =
    best && best[1] <= Math.max(2, Math.floor(name.length / 3))
      ? ` Did you mean "${best[0]}"?`
      : '';
  return `${hint} Known: ${options.join(', ') || '(none)'}.`;
}

export interface ImportOptions {
  random?: RandomSource;
}

/**
 * Reads an editable model file against its tool library. Every problem found is reported with
 * its place in the file, not just the first. Ids that are not valid ids (hand-written names such
 * as `start`) are replaced by new ones and every reference is rewritten.
 */
export function importMkModel(
  tool: ToolLibrary,
  source: string | unknown,
  options: ImportOptions = {},
): Model {
  let parsed: unknown = source;
  if (typeof source === 'string') {
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw new FormatError(
        `The model file is not valid JSON: ${(error as Error).message}`,
      );
    }
  }
  const { value } = migrate('mkmodel', parsed);
  const file = value as unknown as MkModelFile;
  const issues: MkModelIssue[] = [];
  const add = (path: string, message: string) =>
    void issues.push({ path, message });
  const random = options.random;

  if (file.kind !== 'mkmodel')
    add('kind', 'This is not a model file (kind must be "mkmodel").');
  if (typeof file.name !== 'string' || file.name.trim() === '')
    add('name', 'The model needs a name.');
  if (file.tool?.id !== undefined && file.tool.id !== tool.manifest.id) {
    add(
      'tool.id',
      `The file was written for the tool ${file.tool.id}, but it is being read with ${tool.manifest.id} ("${tool.manifest.name}").`,
    );
  }

  // model type
  let modelTypeId: ModelTypeId | undefined;
  if (typeof file.modelType !== 'string')
    add('modelType', 'The model type is missing.');
  else {
    const byKey = findModelTypeByKey(tool, file.modelType);
    if (byKey) modelTypeId = byKey.id;
    else if (isId('modelType', file.modelType))
      modelTypeId = file.modelType as ModelTypeId;
    else
      add(
        'modelType',
        `Unknown model type "${file.modelType}".${didYouMean(
          file.modelType,
          Object.values(tool.modelTypes).map((m) => m.key),
        )}`,
      );
  }
  const modelType = modelTypeId ? tool.modelTypes[modelTypeId] : undefined;

  const resolveAttributes = (
    raw: unknown,
    path: string,
    defs: AttributeDef[],
    owner: string,
  ): Record<AttributeId, Json> => {
    const out: Record<string, Json> = {};
    if (raw === undefined) return out;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      add(
        path,
        'The attributes must be an object with one entry per attribute key.',
      );
      return out;
    }
    for (const [token, v] of Object.entries(raw as Record<string, unknown>)) {
      const def = defs.find((d) => d.key === token);
      let id: string | undefined = def?.id;
      if (!id && isId('attribute', token)) id = token;
      if (!id) {
        add(
          `${path}.${token}`,
          `Unknown attribute "${token}" on ${owner}.${didYouMean(
            token,
            defs.map((d) => d.key),
          )}`,
        );
        continue;
      }
      const reason = whyNotJson(v);
      if (reason)
        add(`${path}.${token}`, `The value must be plain data: ${reason}.`);
      else out[id] = v as Json;
    }
    return out as Record<AttributeId, Json>;
  };

  const attrs = resolveAttributes(
    file.attributes,
    'attributes',
    modelType?.attributes ?? [],
    modelType ? `the model type "${modelType.key}"` : 'the model',
  );

  // elements: names first, so that parents and connectors can refer to elements listed later
  const elementsIn = Array.isArray(file.elements) ? file.elements : [];
  if (!Array.isArray(file.elements))
    add('elements', 'The elements must be a list.');
  const elementIds = new Map<string, ElementId>();
  const taken = new Set<string>();
  elementsIn.forEach((e, i) => {
    const name = (e as MkElement | null)?.id;
    if (typeof name !== 'string' || name === '')
      return add(
        `elements[${i}].id`,
        'Every element needs an id (any name that is unique in the file).',
      );
    if (elementIds.has(name))
      return add(`elements[${i}].id`, `The id "${name}" is used twice.`);
    let id: ElementId;
    if (isId('element', name) && !taken.has(name)) id = name as ElementId;
    else {
      do id = newId('element', random);
      while (taken.has(id));
    }
    taken.add(id);
    elementIds.set(name, id);
  });
  // ids that were kept must not collide with ones just generated
  const elements: Record<string, ElementData> = {};
  const positions = initialPositions(elementsIn.length, random);
  elementsIn.forEach((raw, i) => {
    const path = `elements[${i}]`;
    const e = raw as MkElement | null;
    if (e === null || typeof e !== 'object')
      return add(path, 'An element must be an object.');
    const id = typeof e.id === 'string' ? elementIds.get(e.id) : undefined;
    if (!id) return;
    let classId: ClassId | undefined;
    if (typeof e.class !== 'string')
      add(`${path}.class`, 'The element needs a class.');
    else {
      const cls = findClassByKey(tool, e.class);
      if (cls) classId = cls.id;
      else if (isId('class', e.class)) classId = e.class as ClassId;
      else
        add(
          `${path}.class`,
          `Unknown class "${e.class}".${didYouMean(
            e.class,
            Object.values(tool.classes).map((c) => c.key),
          )}`,
        );
    }
    for (const k of ['x', 'y'] as const)
      if (typeof e[k] !== 'number' || !Number.isFinite(e[k]))
        add(`${path}.${k}`, `${k} must be a number.`);
    for (const k of ['w', 'h'] as const)
      if (
        e[k] !== undefined &&
        (typeof e[k] !== 'number' || !((e[k] as number) > 0))
      )
        add(
          `${path}.${k}`,
          `${k === 'w' ? 'The width' : 'The height'} must be a number above 0.`,
        );
    let parent: ElementId | undefined;
    if (e.parent !== undefined) {
      parent =
        typeof e.parent === 'string' ? elementIds.get(e.parent) : undefined;
      if (!parent)
        add(
          `${path}.parent`,
          `The container "${String(e.parent)}" is not an element of this file.`,
        );
    }
    const cls = classId ? tool.classes[classId] : undefined;
    const defs =
      cls && classId ? defsOf(() => effectiveAttributes(tool, classId!)) : [];
    const elementAttrs = resolveAttributes(
      e.attributes,
      `${path}.attributes`,
      defs,
      cls ? `the class "${cls.key}"` : 'an element of an unknown class',
    );
    if (!classId) return;
    elements[id] = {
      id,
      class: classId,
      x: e.x,
      y: e.y,
      w: e.w ?? DEFAULT_ELEMENT_SIZE.w,
      h: e.h ?? DEFAULT_ELEMENT_SIZE.h,
      ...(parent ? { parent } : {}),
      attrs: elementAttrs,
      pos: positions[i]!,
    };
  });
  // a container may not contain itself
  for (const el of Object.values(elements)) {
    const seen = new Set<string>([el.id]);
    for (let p = el.parent; p; p = elements[p]?.parent) {
      if (seen.has(p)) {
        add('elements', `The containers of "${el.id}" form a loop.`);
        break;
      }
      seen.add(p);
    }
  }

  // connectors
  const connectorsIn =
    file.connectors === undefined
      ? []
      : Array.isArray(file.connectors)
        ? file.connectors
        : null;
  if (connectorsIn === null)
    add('connectors', 'The connectors must be a list.');
  const connectors: Record<string, ConnectorData> = {};
  const cPositions = initialPositions((connectorsIn ?? []).length, random);
  const usedConnectorIds = new Set<string>();
  (connectorsIn ?? []).forEach((raw, i) => {
    const path = `connectors[${i}]`;
    const c = raw as MkConnector | null;
    if (c === null || typeof c !== 'object')
      return add(path, 'A connector must be an object.');
    let relationId: RelationId | undefined;
    if (typeof c.relation !== 'string')
      add(`${path}.relation`, 'The connector needs a relation class.');
    else {
      const rel = findRelationByKey(tool, c.relation);
      if (rel) relationId = rel.id;
      else if (isId('relation', c.relation))
        relationId = c.relation as RelationId;
      else
        add(
          `${path}.relation`,
          `Unknown relation class "${c.relation}".${didYouMean(
            c.relation,
            Object.values(tool.relations).map((r) => r.key),
          )}`,
        );
    }
    const ends: Record<'from' | 'to', ElementId | undefined> = {
      from: undefined,
      to: undefined,
    };
    for (const end of ['from', 'to'] as const) {
      ends[end] =
        typeof c[end] === 'string' ? elementIds.get(c[end]) : undefined;
      if (!ends[end])
        add(
          `${path}.${end}`,
          `"${String(c[end])}" is not an element of this file.`,
        );
    }
    let id: ConnectorId;
    if (
      typeof c.id === 'string' &&
      isId('connector', c.id) &&
      !usedConnectorIds.has(c.id)
    )
      id = c.id as ConnectorId;
    else {
      if (
        c.id !== undefined &&
        typeof c.id === 'string' &&
        usedConnectorIds.has(c.id)
      )
        add(`${path}.id`, `The id "${c.id}" is used twice.`);
      do id = newId('connector', random);
      while (usedConnectorIds.has(id));
    }
    usedConnectorIds.add(id);
    const rel = relationId ? tool.relations[relationId] : undefined;
    const defs =
      rel && relationId
        ? defsOf(() => effectiveRelationAttributes(tool, relationId!))
        : [];
    const cAttrs = resolveAttributes(
      c.attributes,
      `${path}.attributes`,
      defs,
      rel
        ? `the relation class "${rel.key}"`
        : 'a connector of an unknown relation class',
    );
    const bends = c.bends ?? [];
    if (
      !Array.isArray(bends) ||
      bends.some((p) => typeof p?.x !== 'number' || typeof p?.y !== 'number')
    )
      add(
        `${path}.bends`,
        'The bend points must be a list of { x, y } numbers.',
      );
    if (!relationId || !ends.from || !ends.to) return;
    connectors[id] = {
      id,
      relation: relationId,
      from: ends.from,
      to: ends.to,
      bends: bends as Point[],
      attrs: cAttrs,
      pos: cPositions[i]!,
    };
  });

  if (issues.length > 0) throw new MkModelError(issues);

  const modelId =
    typeof file.id === 'string' && isId('model', file.id)
      ? (file.id as ModelId)
      : newId('model', random);
  const model: Model = {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: modelId,
      name: file.name,
      tool: tool.manifest.id,
      toolVersion: file.tool?.version ?? tool.manifest.version,
      modelType: modelTypeId!,
      ...(file.folder === undefined ? {} : { folder: file.folder }),
    },
    attrs,
    elements: elements as Model['elements'],
    connectors: connectors as Model['connectors'],
  };
  const structure = validateModelDocument(model);
  if (structure.length > 0)
    throw new MkModelError(
      structure.map((s) => ({ path: s.path, message: s.message })),
    );
  return model;
}

// --- from the user interface: files, workspace and a report -----------------------------------

/** What an import did and what the person should know about it, in plain English. */
export interface MkModelImportReport {
  /** The tool library in the workspace that the model was read with. */
  tool: { id: ToolId; name: string; version: string };
  /** What the file says about its tool. */
  fileTool: { id?: string; name?: string; version?: string };
  /** The file was written with another version of the tool library than the one in the workspace. */
  toolVersionDiffers: boolean;
  /** Values the file holds for attributes the tool library does not define; they are kept as stored values. */
  unknownAttributes: number;
  /** The model got a new id because the workspace already has a model with the id from the file. */
  idChanged: boolean;
  messages: string[];
}

export interface MkModelImportResult {
  slug: string;
  model: Model;
  report: MkModelImportReport;
}

/** How many stored values belong to attributes the tool library does not define. */
export function countUnknownAttributes(
  tool: ToolLibrary,
  model: Model,
): number {
  const count = (values: Record<string, Json>, defs: AttributeDef[]) =>
    Object.keys(values).filter((id) => !defs.some((d) => d.id === id)).length;
  let total = count(
    model.attrs,
    tool.modelTypes[model.manifest.modelType]?.attributes ?? [],
  );
  for (const e of Object.values(model.elements))
    total += count(
      e.attrs,
      tool.classes[e.class]
        ? defsOf(() => effectiveAttributes(tool, e.class))
        : [],
    );
  for (const c of Object.values(model.connectors))
    total += count(
      c.attrs,
      tool.relations[c.relation]
        ? defsOf(() => effectiveRelationAttributes(tool, c.relation))
        : [],
    );
  return total;
}

/** The report for a model read with `tool` from a file that said `fileTool`. */
export function describeMkModelImport(
  tool: ToolLibrary,
  fileTool: MkModelFile['tool'],
  model: Model,
  idChanged: boolean,
): MkModelImportReport {
  const unknownAttributes = countUnknownAttributes(tool, model);
  const toolVersionDiffers =
    fileTool?.version !== undefined &&
    fileTool.version !== tool.manifest.version;
  const messages = [
    `Read with the tool library "${tool.manifest.name}" (version ${tool.manifest.version}).`,
  ];
  if (toolVersionDiffers)
    messages.push(
      `The file was written with version ${fileTool?.version} of the tool library, but this workspace has version ${tool.manifest.version}. The model was imported as it is; check it for changes.`,
    );
  if (unknownAttributes > 0)
    messages.push(
      `${unknownAttributes} value${unknownAttributes === 1 ? '' : 's'} belong${unknownAttributes === 1 ? 's' : ''} to attributes that this version of the tool library does not have. They are kept and shown under "Unknown attributes".`,
    );
  if (idChanged)
    messages.push(
      'This workspace already has a model with the same id, so the imported model got a new id.',
    );
  return {
    tool: {
      id: tool.manifest.id,
      name: tool.manifest.name,
      version: tool.manifest.version,
    },
    fileTool: { ...fileTool },
    toolVersionDiffers,
    unknownAttributes,
    idChanged,
    messages,
  };
}

/** A name for a downloaded model file, such as `order-process.mkmodel.json`. */
export function mkModelFileName(name: string): string {
  return `${slugify(name)}.mkmodel.json`;
}

/** The text of a model in the workspace as an editable model file, with the name to save it under. */
export async function exportModelFile(
  workspace: Workspace,
  slug: string,
): Promise<{ fileName: string; text: string }> {
  const { document } = await workspace.loadModel(slug);
  return {
    fileName: mkModelFileName(document.manifest.name),
    text: await workspace.exportModel(slug),
  };
}

export interface ImportModelFileOptions {
  /** The tool library to read the file with. By default the one the file names. */
  toolSlug?: string;
  slug?: string;
  /** Always give the model a new id (a bundle does). By default the id of the file is kept unless it is taken. */
  newId?: boolean;
  random?: RandomSource;
}

/**
 * Adds the model of an editable model file to the workspace. The tool library is found by the id
 * the file names. Nothing is changed when the file has problems (`MkModelError` lists them all).
 */
export async function importModelFile(
  workspace: Workspace,
  text: string,
  options: ImportModelFileOptions = {},
): Promise<MkModelImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new FormatError(
      `The model file is not valid JSON: ${(error as Error).message}`,
    );
  }
  const { value } = migrate('mkmodel', parsed);
  const file = value as unknown as MkModelFile;
  let toolSlug = options.toolSlug ?? null;
  if (toolSlug === null) {
    const wanted = file.tool?.id;
    if (typeof wanted !== 'string')
      throw new FormatError(
        'The model file does not say which tool library it was made with, so choose one.',
      );
    toolSlug = await workspace.findToolSlug(wanted as ToolId);
    if (toolSlug === null)
      throw new FormatError(
        `The model file was made with the tool library ${file.tool?.name ? `"${file.tool.name}" ` : ''}(${wanted}), which is not in this workspace. Import the tool package or the bundle first.`,
      );
  }
  const tool = (await workspace.loadTool(toolSlug)).document;
  const read = importMkModel(tool, value, {
    ...(options.random ? { random: options.random } : {}),
  });
  const taken = (await workspace.listModels({ includeTrashed: true })).some(
    (m) => m.id === read.manifest.id,
  );
  const idChanged = taken && options.newId !== true;
  const model: Model =
    options.newId === true || taken
      ? {
          ...read,
          manifest: {
            ...read.manifest,
            id: newId('model', options.random),
          },
        }
      : read;
  const slug = await workspace.createModel(
    model,
    options.slug ? { slug: options.slug } : {},
  );
  return {
    slug,
    model,
    report: describeMkModelImport(tool, file.tool, model, idChanged),
  };
}
