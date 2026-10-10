import { Checker, type Issue, type ParseResult } from '../meta/guards';
import { isJson, whyNotJson } from '../json';
import { isPositionKey } from '../store/position';
import type { Model } from './types';

const ELEMENT_KEYS = [
  'id',
  'class',
  'x',
  'y',
  'w',
  'h',
  'parent',
  'attrs',
  'pos',
] as const;
const CONNECTOR_KEYS = [
  'id',
  'relation',
  'from',
  'to',
  'bends',
  'attrs',
  'pos',
] as const;

type Rec = Record<string, unknown>;

/**
 * Checks the shape of a model document: types, ids and position keys. Whether elements may
 * connect, or whether a class exists in the tool, is a question for validation, not for this.
 */
export function validateModelDocument(value: unknown): Issue[] {
  const c = new Checker();
  const root = c.object(
    value,
    '',
    ['formatVersion', 'manifest', 'attrs', 'elements', 'connectors'],
    'The model',
  );
  if (!root) return c.issues;
  c.int(root.formatVersion, 'formatVersion', 'The format version', 1);

  const m = c.object(
    root.manifest,
    'manifest',
    ['id', 'name', 'tool', 'toolVersion', 'modelType', 'folder'],
    'The manifest',
  );
  if (m) {
    c.id('model', m.id, 'manifest.id', 'The model id');
    c.string(m.name, 'manifest.name', 'The model name');
    c.id('tool', m.tool, 'manifest.tool', 'The Kit id');
    c.string(m.toolVersion, 'manifest.toolVersion', 'The Kit version');
    c.id('modelType', m.modelType, 'manifest.modelType', 'The model type id');
    if (m.folder !== undefined)
      c.string(m.folder, 'manifest.folder', 'The folder', { empty: true });
  }

  const attrs = (value: unknown, path: string) => {
    const o = c.object(
      value,
      path,
      Object.keys((value as Rec) ?? {}),
      'The attribute values',
    );
    if (!o) return;
    for (const [id, v] of Object.entries(o)) {
      c.id('attribute', id, `${path}.${id}`, 'An attribute id');
      const reason = whyNotJson(v);
      if (reason)
        c.add(`${path}.${id}`, `The value must be plain data: ${reason}.`);
    }
  };
  attrs(root.attrs, 'attrs');

  const records = (v: unknown, path: string, what: string): Rec | null => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      c.add(path, `${what} must be an object keyed by id.`);
      return null;
    }
    return v as Rec;
  };

  const elements = records(root.elements, 'elements', 'The elements');
  for (const [id, raw] of Object.entries(elements ?? {})) {
    const path = `elements.${id}`;
    const e = c.object(raw, path, ELEMENT_KEYS, 'An element');
    if (!e) continue;
    if (e.id !== id)
      c.add(
        `${path}.id`,
        `The id "${String(e.id)}" does not match the entry name "${id}".`,
      );
    c.id('element', e.id, `${path}.id`, 'The element id');
    c.id('class', e.class, `${path}.class`, 'The class id');
    for (const k of ['x', 'y'] as const)
      c.number(e[k], `${path}.${k}`, `The ${k} position`);
    for (const k of ['w', 'h'] as const) {
      if (
        c.number(
          e[k],
          `${path}.${k}`,
          `The ${k === 'w' ? 'width' : 'height'}`,
        ) !== null &&
        (e[k] as number) <= 0
      ) {
        c.add(
          `${path}.${k}`,
          `The ${k === 'w' ? 'width' : 'height'} must be above 0.`,
        );
      }
    }
    if (e.parent !== undefined)
      c.id('element', e.parent, `${path}.parent`, 'The container');
    attrs(e.attrs, `${path}.attrs`);
    if (!isPositionKey(e.pos))
      c.add(
        `${path}.pos`,
        `The position key must be letters and digits not ending in 0 (it is ${JSON.stringify(e.pos)}).`,
      );
  }

  const connectors = records(root.connectors, 'connectors', 'The connectors');
  for (const [id, raw] of Object.entries(connectors ?? {})) {
    const path = `connectors.${id}`;
    const k = c.object(raw, path, CONNECTOR_KEYS, 'A connector');
    if (!k) continue;
    if (k.id !== id)
      c.add(
        `${path}.id`,
        `The id "${String(k.id)}" does not match the entry name "${id}".`,
      );
    c.id('connector', k.id, `${path}.id`, 'The connector id');
    c.id('relation', k.relation, `${path}.relation`, 'The relation class id');
    c.id('element', k.from, `${path}.from`, 'The FROM element');
    c.id('element', k.to, `${path}.to`, 'The TO element');
    const bends = c.array(k.bends, `${path}.bends`, 'The bend points');
    bends?.forEach((p, i) => {
      const o = c.object(p, `${path}.bends[${i}]`, ['x', 'y'], 'A bend point');
      if (o) {
        c.number(o.x, `${path}.bends[${i}].x`, 'x');
        c.number(o.y, `${path}.bends[${i}].y`, 'y');
      }
    });
    attrs(k.attrs, `${path}.attrs`);
    if (!isPositionKey(k.pos))
      c.add(
        `${path}.pos`,
        `The position key must be letters and digits not ending in 0 (it is ${JSON.stringify(k.pos)}).`,
      );
  }
  if (!isJson(value)) c.add('', 'The model must be plain data.');
  return c.issues;
}

export function parseModel(value: unknown): ParseResult<Model> {
  const issues = validateModelDocument(value);
  return issues.length === 0
    ? { ok: true, value: value as Model }
    : { ok: false, issues };
}
