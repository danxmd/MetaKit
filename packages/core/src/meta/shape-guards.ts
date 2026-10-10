import type { Checker } from './guards';
import { effectiveAttributes, effectiveRelationAttributes } from './inherit';
import {
  LOOK_BASE_IDS,
  LOOK_ICON_NAMES,
  PANEL_CONTROLS,
  PART_TYPES,
} from './shape-types';
import type { Kit } from './types';

type Rec = Record<string, unknown>;

const COMMON_PART = [
  'type',
  'x',
  'y',
  'width',
  'height',
  'visible',
  'tooltip',
  'onClick',
  'fill',
  'stroke',
  'strokeWidth',
  'dash',
  'shadow',
  'font',
  'clip',
  'transform',
  'repeat',
  'opacity',
];

const PART_FIELDS: Record<string, string[]> = {
  rect: [...COMMON_PART, 'radius'],
  ellipse: COMMON_PART,
  polygon: [...COMMON_PART, 'points'],
  path: [...COMMON_PART, 'd', 'viewBox'],
  text: [...COMMON_PART, 'text', 'wrap', 'fit', 'align', 'valign'],
  image: [...COMMON_PART, 'src', 'fit'],
  group: [...COMMON_PART, 'parts', 'layout'],
  use: [...COMMON_PART, 'shape'],
};

const isNumberOrText = (v: unknown) =>
  (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string';

function dim(c: Checker, value: unknown, path: string, what: string): void {
  if (value !== undefined && !isNumberOrText(value))
    c.add(path, `${what} must be a number or text such as "50%".`);
}

function layout(c: Checker, value: unknown, path: string): void {
  const l = c.object(
    value,
    path,
    ['kind', 'direction', 'gap', 'columns'],
    'A layout',
  );
  if (!l) return;
  if (l.kind !== 'stack' && l.kind !== 'grid')
    c.add(`${path}.kind`, 'The layout kind must be "stack" or "grid".');
  if (l.kind === 'grid') c.int(l.columns, `${path}.columns`, 'The columns', 1);
  if (
    l.direction !== undefined &&
    l.direction !== 'row' &&
    l.direction !== 'column'
  )
    c.add(`${path}.direction`, 'The direction must be "row" or "column".');
  if (l.gap !== undefined) c.number(l.gap, `${path}.gap`, 'The gap');
}

function font(c: Checker, value: unknown, path: string): void {
  c.object(
    value,
    path,
    ['family', 'size', 'weight', 'style', 'color'],
    'A font',
  );
}

function part(c: Checker, raw: unknown, path: string, depth: number): void {
  if (depth > 12) {
    c.add(path, 'Groups are nested too deeply.');
    return;
  }
  const type = (raw as Rec | null)?.type;
  if (typeof type !== 'string' || !PART_TYPES.includes(type as never)) {
    c.add(
      `${path}.type`,
      `The part type must be one of ${PART_TYPES.join(', ')} (it is ${JSON.stringify(type)}).`,
    );
    return;
  }
  const p = c.object(raw, path, PART_FIELDS[type]!, `A ${type} part`);
  if (!p) return;
  for (const k of ['x', 'y', 'width', 'height'])
    dim(c, p[k], `${path}.${k}`, `The ${k}`);
  if (p.font !== undefined) font(c, p.font, `${path}.font`);
  if (p.shadow !== undefined)
    c.object(
      p.shadow,
      `${path}.shadow`,
      ['color', 'blur', 'x', 'y'],
      'A shadow',
    );
  if (p.transform !== undefined)
    c.object(
      p.transform,
      `${path}.transform`,
      ['rotate', 'scaleX', 'scaleY', 'translateX', 'translateY'],
      'A transform',
    );
  if (p.repeat !== undefined) {
    const r = c.object(
      p.repeat,
      `${path}.repeat`,
      ['over', 'as', 'layout', 'cellWidth', 'cellHeight'],
      'A repeat',
    );
    if (r) {
      c.string(r.over, `${path}.repeat.over`, 'What to repeat over');
      if (r.layout !== undefined) layout(c, r.layout, `${path}.repeat.layout`);
    }
  }
  switch (type) {
    case 'polygon': {
      const pts = c.array(p.points, `${path}.points`, 'The points');
      if (pts) {
        if (pts.length < 3)
          c.add(`${path}.points`, 'A polygon needs at least three points.');
        pts.forEach((pt, i) => {
          if (
            !Array.isArray(pt) ||
            pt.length !== 2 ||
            !pt.every(isNumberOrText)
          )
            c.add(`${path}.points[${i}]`, 'A point is a pair [x, y].');
        });
      }
      break;
    }
    case 'path':
      c.string(p.d, `${path}.d`, 'The path');
      break;
    case 'text':
      if (typeof p.text !== 'string')
        c.add(
          `${path}.text`,
          'The text must be text (or a formula starting with =).',
        );
      break;
    case 'image':
      c.string(p.src, `${path}.src`, 'The image source');
      break;
    case 'group': {
      const parts = c.array(p.parts, `${path}.parts`, 'The parts of a group');
      parts?.forEach((q, i) => part(c, q, `${path}.parts[${i}]`, depth + 1));
      if (p.layout !== undefined) layout(c, p.layout, `${path}.layout`);
      break;
    }
    case 'use':
      c.id('shape', p.shape, `${path}.shape`, 'The shape to use');
      break;
  }
}

function parts(c: Checker, value: unknown, path: string): void {
  const list = c.array(value, path, 'The parts');
  list?.forEach((p, i) => part(c, p, `${path}[${i}]`, 0));
}

function letTable(c: Checker, value: unknown, path: string): void {
  if (value === undefined) return;
  const t = c.object(
    value,
    path,
    Object.keys((value as Rec) ?? {}),
    'The let table',
  );
  if (!t) return;
  for (const [k, v] of Object.entries(t)) {
    c.key(k, `${path}.${k}`, 'A let name');
    if (typeof v !== 'string')
      c.add(
        `${path}.${k}`,
        'A let value must be a formula (text starting with =) or a fixed text.',
      );
  }
}

function nodeShape(c: Checker, d: Rec, path: string): void {
  const size = c.object(
    d.size,
    `${path}.size`,
    ['width', 'height', 'resizable', 'minWidth', 'minHeight'],
    'The size',
  );
  if (size) {
    c.number(size.width, `${path}.size.width`, 'The width');
    c.number(size.height, `${path}.size.height`, 'The height');
  }
  if (d.outline !== undefined) {
    const o = d.outline;
    if (typeof o === 'string') {
      if (!['rect', 'ellipse', 'auto'].includes(o))
        c.add(
          `${path}.outline`,
          'The outline must be "rect", "ellipse", "auto" or a polygon.',
        );
    } else {
      const poly = c.object(
        o,
        `${path}.outline`,
        ['type', 'points'],
        'The outline',
      );
      if (poly) {
        if (poly.type !== 'polygon')
          c.add(
            `${path}.outline.type`,
            'An outline object must have type "polygon".',
          );
        const pts = c.array(
          poly.points,
          `${path}.outline.points`,
          'The points',
        );
        if (pts && pts.length < 3)
          c.add(
            `${path}.outline.points`,
            'A polygon needs at least three points.',
          );
      }
    }
  }
  letTable(c, d.let, `${path}.let`);
  parts(c, d.parts, `${path}.parts`);
  if (d.variants !== undefined) {
    const vs = c.array(d.variants, `${path}.variants`, 'The variants');
    vs?.forEach((v, i) => {
      const vo = c.object(
        v,
        `${path}.variants[${i}]`,
        ['when', 'parts'],
        'A variant',
      );
      if (!vo) return;
      if (vo.when !== undefined)
        c.string(vo.when, `${path}.variants[${i}].when`, 'The condition');
      parts(c, vo.parts, `${path}.variants[${i}].parts`);
    });
  }
}

function relationShape(c: Checker, d: Rec, path: string): void {
  letTable(c, d.let, `${path}.let`);
  const line = c.object(
    d.line,
    `${path}.line`,
    ['stroke', 'strokeWidth', 'dash', 'routing', 'corners'],
    'The line',
  );
  if (
    line &&
    line.routing !== undefined &&
    !['straight', 'orthogonal', 'curved'].includes(line.routing as string)
  )
    c.add(
      `${path}.line.routing`,
      'The routing must be "straight", "orthogonal" or "curved".',
    );
  for (const k of ['startMarker', 'endMarker'] as const)
    if (d[k] !== undefined)
      c.object(d[k], `${path}.${k}`, ['type', 'fill', 'size'], 'A marker');
  if (d.labels !== undefined) {
    const ls = c.array(d.labels, `${path}.labels`, 'The labels');
    ls?.forEach((l, i) => {
      const lo = c.object(
        l,
        `${path}.labels[${i}]`,
        ['at', 'offset', 'text', 'font', 'background', 'visible'],
        'A label',
      );
      if (!lo) return;
      if (!['start', 'middle', 'end'].includes(lo.at as string))
        c.add(
          `${path}.labels[${i}].at`,
          'A label is at "start", "middle" or "end".',
        );
      if (typeof lo.text !== 'string')
        c.add(
          `${path}.labels[${i}].text`,
          'The label text must be text (or a formula).',
        );
    });
  }
}

function panelItems(
  c: Checker,
  value: unknown,
  path: string,
  depth: number,
): void {
  const items = c.array(value, path, 'The items');
  items?.forEach((item, i) => {
    const p = `${path}[${i}]`;
    const o = item as Rec | null;
    if (o && typeof o === 'object' && 'group' in o) {
      const g = c.object(
        o,
        p,
        ['group', 'labels', 'visible', 'items'],
        'A group',
      );
      if (!g) return;
      c.string(g.group, `${p}.group`, 'The group name');
      if (depth >= 3) c.add(p, 'Groups are nested too deeply.');
      else panelItems(c, g.items, `${p}.items`, depth + 1);
      return;
    }
    const a = c.object(
      item,
      p,
      ['attribute', 'control', 'visible', 'readOnly', 'required', 'height'],
      'An attribute item',
    );
    if (!a) return;
    c.key(a.attribute, `${p}.attribute`, 'The attribute key');
    if (a.control !== undefined && !PANEL_CONTROLS.includes(a.control as never))
      c.add(
        `${p}.control`,
        `The control must be one of ${PANEL_CONTROLS.join(', ')}.`,
      );
    for (const k of ['visible', 'readOnly', 'required'])
      if (
        a[k] !== undefined &&
        typeof a[k] !== 'boolean' &&
        typeof a[k] !== 'string'
      )
        c.add(`${p}.${k}`, `${k} must be true, false or a formula.`);
  });
}

const LOOK_LINE_STYLES = ['solid', 'dashed', 'dotted'];
const LOOK_ROUTING = ['straight', 'orthogonal', 'curved'];
const LOOK_MARKERS = [
  'none',
  'arrow',
  'open-arrow',
  'triangle',
  'diamond',
  'circle',
  'cross',
  'bar',
];

function lookColour(c: Checker, value: unknown, path: string): void {
  if (typeof value === 'string') return;
  const o = c.object(value, path, ['by', 'values', 'fallback'], 'A colour');
  if (!o) return;
  c.key(o.by, `${path}.by`, 'The attribute key');
  c.string(o.fallback, `${path}.fallback`, 'The fallback colour');
  const values = o.values;
  if (values === null || typeof values !== 'object' || Array.isArray(values))
    c.add(`${path}.values`, 'The values must be an object of colours.');
  else
    for (const [k, v] of Object.entries(values))
      if (typeof v !== 'string')
        c.add(`${path}.values.${k}`, 'A colour must be text such as #d93025.');
}

function lookText(c: Checker, value: unknown, path: string): void {
  const o = c.object(
    value,
    path,
    ['attribute', 'text', 'colour', 'bold', 'size'],
    'A line of text',
  );
  if (!o) return;
  if (o.attribute !== undefined && o.attribute !== null)
    c.key(o.attribute, `${path}.attribute`, 'The attribute key');
  if (o.text !== undefined) c.string(o.text, `${path}.text`, 'The text');
  if (o.colour !== undefined) lookColour(c, o.colour, `${path}.colour`);
}

/** Checks the structure of a simple look (ADR 0009). */
function checkLook(
  c: Checker,
  value: unknown,
  path: string,
  kind: string,
): void {
  if (kind === 'relation') {
    const o = c.object(
      value,
      path,
      ['colour', 'width', 'style', 'routing', 'start', 'end', 'label'],
      'A relation look',
    );
    if (!o) return;
    lookColour(c, o.colour, `${path}.colour`);
    c.number(o.width, `${path}.width`, 'The line width');
    if (!LOOK_LINE_STYLES.includes(o.style as string))
      c.add(
        `${path}.style`,
        `The style must be one of ${LOOK_LINE_STYLES.join(', ')}.`,
      );
    if (!LOOK_ROUTING.includes(o.routing as string))
      c.add(
        `${path}.routing`,
        `The routing must be one of ${LOOK_ROUTING.join(', ')}.`,
      );
    for (const end of ['start', 'end'])
      if (!LOOK_MARKERS.includes(o[end] as string))
        c.add(
          `${path}.${end}`,
          `The ${end} must be one of ${LOOK_MARKERS.join(', ')}.`,
        );
    if (o.label !== null) {
      const l = c.object(o.label, `${path}.label`, ['attribute'], 'The label');
      if (l) c.key(l.attribute, `${path}.label.attribute`, 'The attribute key');
    }
    return;
  }
  const o = c.object(
    value,
    path,
    [
      'base',
      'fill',
      'border',
      'borderWidth',
      'borderStyle',
      'corner',
      'title',
      'subtitle',
      'icon',
      'badge',
      'fields',
      'size',
    ],
    'A look',
  );
  if (!o) return;
  if (!LOOK_BASE_IDS.includes(o.base as never))
    c.add(
      `${path}.base`,
      `The base form must be one of ${LOOK_BASE_IDS.join(', ')}.`,
    );
  lookColour(c, o.fill, `${path}.fill`);
  lookColour(c, o.border, `${path}.border`);
  c.number(o.borderWidth, `${path}.borderWidth`, 'The border width');
  if (!LOOK_LINE_STYLES.includes(o.borderStyle as string))
    c.add(
      `${path}.borderStyle`,
      `The border style must be one of ${LOOK_LINE_STYLES.join(', ')}.`,
    );
  if (o.corner !== undefined)
    c.number(o.corner, `${path}.corner`, 'The corner');
  lookText(c, o.title, `${path}.title`);
  if (o.subtitle !== undefined) lookText(c, o.subtitle, `${path}.subtitle`);
  if (o.icon !== undefined) {
    const i = c.object(o.icon, `${path}.icon`, ['name', 'colour'], 'The icon');
    if (i && !LOOK_ICON_NAMES.includes(i.name as never))
      c.add(
        `${path}.icon.name`,
        `The icon must be one of ${LOOK_ICON_NAMES.join(', ')}.`,
      );
  }
  if (o.badge !== undefined) {
    const b = c.object(
      o.badge,
      `${path}.badge`,
      ['attribute', 'equals', 'text', 'colour'],
      'The badge',
    );
    if (b) {
      c.key(b.attribute, `${path}.badge.attribute`, 'The attribute key');
      c.string(b.equals, `${path}.badge.equals`, 'The value');
      c.string(b.text, `${path}.badge.text`, 'The text');
      c.string(b.colour, `${path}.badge.colour`, 'The colour');
    }
  }
  if (o.fields !== undefined)
    c.array(o.fields, `${path}.fields`, 'The fields')?.forEach((f, i) =>
      c.key(f, `${path}.fields[${i}]`, 'The attribute key'),
    );
  const size = c.object(
    o.size,
    `${path}.size`,
    ['width', 'height', 'resizable'],
    'The size',
  );
  if (size) {
    c.number(size.width, `${path}.size.width`, 'The width');
    c.number(size.height, `${path}.size.height`, 'The height');
  }
}

/** Checks the structure of `shapes`, `panels` and the container rules (version 2 tables). */
export function checkShapeTables(c: Checker, root: Rec): void {
  const shapes = root.shapes;
  if (shapes !== undefined) {
    if (shapes === null || typeof shapes !== 'object' || Array.isArray(shapes))
      c.add('shapes', 'The shapes must be an object keyed by id.');
    else
      for (const [id, raw] of Object.entries(shapes)) {
        const path = `shapes.${id}`;
        const kind = (raw as Rec | null)?.kind;
        const d = c.object(
          raw,
          path,
          kind === 'relation'
            ? [
                'id',
                'name',
                'kind',
                'let',
                'line',
                'startMarker',
                'endMarker',
                'labels',
                'look',
              ]
            : [
                'id',
                'name',
                'kind',
                'size',
                'outline',
                'let',
                'parts',
                'variants',
                'look',
              ],
          'A shape',
        );
        if (!d) continue;
        if (d.id !== id)
          c.add(
            `${path}.id`,
            `The id "${String(d.id)}" does not match the entry name "${id}".`,
          );
        c.id('shape', d.id, `${path}.id`, 'The shape id');
        if (kind !== 'node' && kind !== 'relation') {
          c.add(`${path}.kind`, 'The shape kind must be "node" or "relation".');
          continue;
        }
        if (d.name !== undefined)
          c.string(d.name, `${path}.name`, 'The shape name');
        if (kind === 'node') nodeShape(c, d, path);
        else relationShape(c, d, path);
        if (d.look !== undefined) checkLook(c, d.look, `${path}.look`, kind);
      }
  }
  const panels = root.panels;
  if (panels !== undefined) {
    if (panels === null || typeof panels !== 'object' || Array.isArray(panels))
      c.add(
        'panels',
        'The panels must be an object keyed by class or relation class id.',
      );
    else
      for (const [id, raw] of Object.entries(panels)) {
        const path = `panels.${id}`;
        const d = c.object(
          raw,
          path,
          ['class', 'tabs', 'showRelations'],
          'A panel layout',
        );
        if (!d) continue;
        if (d.class !== id)
          c.add(
            `${path}.class`,
            `The class "${String(d.class)}" does not match the entry name "${id}".`,
          );
        const tabs = c.array(d.tabs, `${path}.tabs`, 'The tabs');
        tabs?.forEach((t, i) => {
          const tab = c.object(
            t,
            `${path}.tabs[${i}]`,
            ['label', 'labels', 'visible', 'items'],
            'A tab',
          );
          if (!tab) return;
          c.string(tab.label, `${path}.tabs[${i}].label`, 'The tab label');
          panelItems(c, tab.items, `${path}.tabs[${i}].items`, 0);
        });
        if (d.showRelations !== undefined)
          c.boolean(d.showRelations, `${path}.showRelations`, 'showRelations');
      }
  }
}

function keysOfItems(items: unknown[], out: string[]): void {
  for (const item of items) {
    const o = item as Rec;
    if ('group' in o) keysOfItems((o.items as unknown[]) ?? [], out);
    else out.push(String(o.attribute));
  }
}

/** Checks references between the tables; run only when the structure is sound. */
export function checkShapeReferences(c: Checker, kit: Kit): void {
  const shapes = kit.shapes ?? {};
  const known = (id: unknown) => typeof id === 'string' && id in shapes;
  for (const cls of Object.values(kit.classes))
    if (cls.shape !== undefined && !known(cls.shape))
      c.add(
        `classes.${cls.id}.shape`,
        `The shape ${cls.shape} does not exist in this Kit.`,
      );
  for (const rel of Object.values(kit.relations))
    if (rel.shape !== undefined && !known(rel.shape))
      c.add(
        `relations.${rel.id}.shape`,
        `The shape ${rel.shape} does not exist in this Kit.`,
      );
  for (const mt of Object.values(kit.modelTypes)) {
    if (mt.background !== undefined && !known(mt.background))
      c.add(
        `modelTypes.${mt.id}.background`,
        `The shape ${mt.background} does not exist in this Kit.`,
      );
  }
  for (const shape of Object.values(shapes)) {
    if (shape.kind !== 'node') continue;
    const visit = (
      list: { type: string; shape?: string; parts?: unknown[] }[],
    ) => {
      for (const p of list) {
        if (p.type === 'use' && !known(p.shape))
          c.add(
            `shapes.${shape.id}`,
            `The shape uses ${String(p.shape)}, which does not exist.`,
          );
        if (p.type === 'group') visit((p.parts ?? []) as never);
      }
    };
    visit(shape.parts as never);
    for (const v of shape.variants ?? []) visit(v.parts as never);
  }
  for (const [id, layout] of Object.entries(kit.panels ?? {})) {
    const isClass = id in kit.classes;
    const isRelation = id in kit.relations;
    if (!isClass && !isRelation) {
      c.add(
        `panels.${id}`,
        `There is no class or relation class ${id} for this layout.`,
      );
      continue;
    }
    let attrs: string[];
    try {
      attrs = (
        isClass
          ? effectiveAttributes(kit, id as never)
          : effectiveRelationAttributes(kit, id as never)
      ).map((a) => a.key);
    } catch {
      continue; // The inheritance problem is reported elsewhere.
    }
    const used: string[] = [];
    for (const tab of layout.tabs) keysOfItems(tab.items, used);
    for (const key of used)
      if (!attrs.includes(key))
        c.add(
          `panels.${id}`,
          `The layout lists the attribute "${key}", which the class does not have.`,
        );
    if (new Set(used).size !== used.length)
      c.add(
        `panels.${id}`,
        'An attribute is listed more than once in the layout.',
      );
  }
}
