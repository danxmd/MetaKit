import { isId, type IdKind } from '../ids';
import { checkShapeReferences, checkShapeTables } from './shape-guards';
import {
  ATTRIBUTE_TYPES,
  CLASS_KINDS,
  type AttributeDef,
  type ToolLibrary,
} from './types';
import {
  checkAttributeValue,
  isIsoDate,
  isIsoDateTime,
  isIsoDuration,
} from './values';

/** One problem in a definition: where it is and what is wrong, in plain English. */
export interface Issue {
  path: string;
  message: string;
}

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; issues: Issue[] };

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/;

type Rec = Record<string, unknown>;

export class Checker {
  readonly issues: Issue[] = [];

  add(path: string, message: string): void {
    this.issues.push({ path, message });
  }

  /** The value as an object, or null after reporting that it is not one. */
  object(
    value: unknown,
    path: string,
    allowed: readonly string[],
    what: string,
  ): Rec | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.add(path, `${what} must be an object.`);
      return null;
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        this.add(
          `${path}.${key}`,
          `Unknown field "${key}" in ${what}. Allowed fields: ${allowed.join(', ')}.`,
        );
      }
    }
    return value as Rec;
  }

  array(value: unknown, path: string, what: string): unknown[] | null {
    if (!Array.isArray(value)) {
      this.add(path, `${what} must be a list.`);
      return null;
    }
    return value;
  }

  string(
    value: unknown,
    path: string,
    what: string,
    options: { empty?: boolean } = {},
  ): string | null {
    if (typeof value !== 'string') {
      this.add(path, `${what} must be text.`);
      return null;
    }
    if (!options.empty && value.trim() === '') {
      this.add(path, `${what} cannot be empty.`);
      return null;
    }
    return value;
  }

  boolean(value: unknown, path: string, what: string): boolean | null {
    if (typeof value !== 'boolean') {
      this.add(path, `${what} must be true or false.`);
      return null;
    }
    return value;
  }

  int(value: unknown, path: string, what: string, min?: number): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      this.add(path, `${what} must be a whole number.`);
      return null;
    }
    if (min !== undefined && value < min) {
      this.add(path, `${what} must be at least ${min}.`);
      return null;
    }
    return value;
  }

  number(value: unknown, path: string, what: string): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.add(path, `${what} must be a number.`);
      return null;
    }
    return value;
  }

  id(kind: IdKind, value: unknown, path: string, what: string): string | null {
    if (!isId(kind, value)) {
      this.add(
        path,
        `${what} must be an id of the form ${kindPrefix(kind)}_something (it is ${JSON.stringify(value)}).`,
      );
      return null;
    }
    return value as string;
  }

  key(value: unknown, path: string, what: string): string | null {
    if (typeof value !== 'string' || !KEY.test(value)) {
      this.add(
        path,
        `${what} must start with a letter or underscore and contain only letters, digits and underscores (it is ${JSON.stringify(value)}).`,
      );
      return null;
    }
    return value;
  }

  labels(
    value: unknown,
    path: string,
    what: string,
    languages: readonly string[],
    options: { required: boolean },
  ): void {
    const labels = this.object(
      value,
      path,
      Object.keys((value as Rec) ?? {}),
      what,
    );
    if (!labels) return;
    if (options.required && Object.keys(labels).length === 0) {
      this.add(path, `${what} needs a label in at least one language.`);
    }
    for (const [lang, text] of Object.entries(labels)) {
      if (!LANGUAGE.test(lang))
        this.add(
          `${path}.${lang}`,
          `"${lang}" is not a language code such as en or de.`,
        );
      else if (languages.length > 0 && !languages.includes(lang)) {
        this.add(
          `${path}.${lang}`,
          `The language "${lang}" is not listed in the tool's languages (${languages.join(', ')}).`,
        );
      }
      if (typeof text !== 'string')
        this.add(`${path}.${lang}`, `The label for "${lang}" must be text.`);
    }
  }
}

function kindPrefix(kind: IdKind): string {
  return {
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
  }[kind];
}

const BASE_ATTRIBUTE_KEYS = [
  'id',
  'key',
  'type',
  'labels',
  'help',
  'required',
  'group',
];
const TYPE_KEYS: Record<string, string[]> = {
  text: ['multiline', 'maxLength', 'pattern', 'default'],
  integer: ['min', 'max', 'default'],
  number: ['min', 'max', 'decimals', 'unit', 'default'],
  boolean: ['display', 'default'],
  date: ['default'],
  'date-time': ['default'],
  duration: ['default'],
  choice: ['options', 'default'],
  'multi-choice': ['options', 'min', 'max', 'default'],
  formula: ['formula', 'result'],
  table: ['columns', 'maxRows', 'default'],
  reference: ['target', 'max'],
  action: ['run'],
  link: ['target', 'default'],
};

function checkOptions(
  c: Checker,
  value: unknown,
  path: string,
  languages: readonly string[],
): string[] {
  const list = c.array(value, path, 'The options');
  if (!list) return [];
  if (list.length === 0) c.add(path, 'At least one option is required.');
  const seen = new Set<string>();
  const values: string[] = [];
  list.forEach((option, i) => {
    const p = `${path}[${i}]`;
    if (typeof option === 'string') {
      if (option === '') c.add(p, 'An option cannot be empty.');
      values.push(option);
    } else {
      const o = c.object(option, p, ['value', 'labels'], 'An option');
      if (!o) return;
      const v = c.string(o.value, `${p}.value`, 'The option value');
      if (v !== null) values.push(v);
      if (o.labels !== undefined)
        c.labels(o.labels, `${p}.labels`, 'The option labels', languages, {
          required: false,
        });
    }
  });
  for (const v of values) {
    if (seen.has(v)) c.add(path, `The option "${v}" is listed more than once.`);
    seen.add(v);
  }
  return values;
}

function checkAttribute(
  c: Checker,
  raw: unknown,
  path: string,
  languages: readonly string[],
): AttributeDef | null {
  const typeName = (raw as Rec | null)?.type;
  const allowed = [
    ...BASE_ATTRIBUTE_KEYS,
    ...(typeof typeName === 'string' ? (TYPE_KEYS[typeName] ?? []) : []),
  ];
  const a = c.object(raw, path, allowed, 'An attribute');
  if (!a) return null;
  c.id('attribute', a.id, `${path}.id`, 'The attribute id');
  c.key(a.key, `${path}.key`, 'The attribute key');
  if (a.labels !== undefined)
    c.labels(a.labels, `${path}.labels`, 'The attribute labels', languages, {
      required: false,
    });
  if (a.help !== undefined)
    c.labels(a.help, `${path}.help`, 'The attribute help', languages, {
      required: false,
    });
  if (a.required !== undefined)
    c.boolean(a.required, `${path}.required`, 'required');
  if (a.group !== undefined)
    c.string(a.group, `${path}.group`, 'The group name');
  if (
    typeof typeName !== 'string' ||
    !(ATTRIBUTE_TYPES as readonly string[]).includes(typeName)
  ) {
    c.add(
      `${path}.type`,
      `The attribute type must be one of: ${ATTRIBUTE_TYPES.join(', ')} (it is ${JSON.stringify(typeName)}).`,
    );
    return null;
  }
  const before = c.issues.length;

  const range = (minKey: string, maxKey: string, integer: boolean) => {
    const min =
      a[minKey] === undefined
        ? null
        : integer
          ? c.int(a[minKey], `${path}.${minKey}`, minKey)
          : c.number(a[minKey], `${path}.${minKey}`, minKey);
    const max =
      a[maxKey] === undefined
        ? null
        : integer
          ? c.int(a[maxKey], `${path}.${maxKey}`, maxKey)
          : c.number(a[maxKey], `${path}.${maxKey}`, maxKey);
    if (min !== null && max !== null && min > max)
      c.add(path, `The minimum (${min}) is above the maximum (${max}).`);
  };

  switch (typeName) {
    case 'text':
      if (a.multiline !== undefined)
        c.boolean(a.multiline, `${path}.multiline`, 'multiline');
      if (a.maxLength !== undefined)
        c.int(a.maxLength, `${path}.maxLength`, 'The maximum length', 1);
      if (
        a.pattern !== undefined &&
        c.string(a.pattern, `${path}.pattern`, 'The pattern') !== null
      ) {
        try {
          new RegExp(a.pattern as string);
        } catch {
          c.add(
            `${path}.pattern`,
            `The pattern ${JSON.stringify(a.pattern)} is not a valid regular expression.`,
          );
        }
      }
      break;
    case 'integer':
      range('min', 'max', true);
      break;
    case 'number':
      range('min', 'max', false);
      if (a.decimals !== undefined) {
        const d = c.int(a.decimals, `${path}.decimals`, 'decimals', 0);
        if (d !== null && d > 15)
          c.add(`${path}.decimals`, 'decimals can be at most 15.');
      }
      if (a.unit !== undefined)
        c.string(a.unit, `${path}.unit`, 'The unit', { empty: true });
      break;
    case 'boolean':
      if (
        a.display !== undefined &&
        a.display !== 'checkbox' &&
        a.display !== 'switch'
      ) {
        c.add(`${path}.display`, 'display must be "checkbox" or "switch".');
      }
      break;
    case 'choice':
    case 'multi-choice': {
      checkOptions(c, a.options, `${path}.options`, languages);
      if (typeName === 'multi-choice') range('min', 'max', true);
      break;
    }
    case 'formula':
      c.string(a.formula, `${path}.formula`, 'The formula');
      if (
        a.result !== undefined &&
        !['text', 'number', 'boolean', 'date'].includes(a.result as string)
      ) {
        c.add(
          `${path}.result`,
          'result must be one of: text, number, boolean, date.',
        );
      }
      break;
    case 'table': {
      const columns = c.array(a.columns, `${path}.columns`, 'The columns');
      if (columns) {
        if (columns.length === 0)
          c.add(`${path}.columns`, 'A table needs at least one column.');
        const ids = new Set<string>();
        const keys = new Set<string>();
        columns.forEach((col, i) => {
          const p = `${path}.columns[${i}]`;
          const o = c.object(
            col,
            p,
            ['id', 'key', 'type', 'labels', 'options'],
            'A column',
          );
          if (!o) return;
          const id = c.string(o.id, `${p}.id`, 'The column id');
          const key = c.key(o.key, `${p}.key`, 'The column key');
          if (id !== null) {
            if (ids.has(id))
              c.add(`${p}.id`, `The column id "${id}" is used twice.`);
            ids.add(id);
          }
          if (key !== null) {
            if (keys.has(key))
              c.add(`${p}.key`, `The column key "${key}" is used twice.`);
            keys.add(key);
          }
          if (
            ![
              'text',
              'integer',
              'number',
              'boolean',
              'date',
              'choice',
            ].includes(o.type as string)
          ) {
            c.add(
              `${p}.type`,
              'A column type must be one of: text, integer, number, boolean, date, choice.',
            );
          }
          if (o.type === 'choice')
            checkOptions(c, o.options, `${p}.options`, languages);
          if (o.labels !== undefined)
            c.labels(o.labels, `${p}.labels`, 'The column labels', languages, {
              required: false,
            });
        });
      }
      if (a.maxRows !== undefined)
        c.int(a.maxRows, `${path}.maxRows`, 'The maximum number of rows', 1);
      break;
    }
    case 'reference': {
      const t = c.object(
        a.target,
        `${path}.target`,
        ['modelTypes', 'classes'],
        'The target',
      );
      if (t) {
        for (const [field, kind] of [
          ['modelTypes', 'modelType'],
          ['classes', 'class'],
        ] as const) {
          if (t[field] === undefined) continue;
          const list = c.array(
            t[field],
            `${path}.target.${field}`,
            `The target ${field}`,
          );
          list?.forEach((id, i) =>
            c.id(kind, id, `${path}.target.${field}[${i}]`, 'The target id'),
          );
        }
      }
      if (a.max !== undefined)
        c.int(a.max, `${path}.max`, 'The maximum number of references', 1);
      break;
    }
    case 'action': {
      const r = c.object(a.run, `${path}.run`, ['kind', 'ref'], 'run');
      if (r) {
        if (!['rule', 'script', 'command'].includes(r.kind as string))
          c.add(
            `${path}.run.kind`,
            'run.kind must be one of: rule, script, command.',
          );
        c.string(r.ref, `${path}.run.ref`, 'run.ref');
      }
      break;
    }
    case 'link':
      if (
        a.target !== undefined &&
        !['url', 'file', 'any'].includes(a.target as string)
      ) {
        c.add(`${path}.target`, 'target must be one of: url, file, any.');
      }
      break;
    default:
      break;
  }

  // Defaults must fit the attribute they belong to, found now rather than when an element is created.
  if (a.default !== undefined && c.issues.length === before) {
    if (
      typeName === 'formula' ||
      typeName === 'action' ||
      typeName === 'reference'
    ) {
      c.add(`${path}.default`, `A ${typeName} attribute has no default.`);
    } else {
      const def = a as unknown as AttributeDef;
      for (const p of checkAttributeValue(def, a.default))
        c.add(`${path}.default`, `The default ${p.message}.`);
      if (
        typeName === 'date' &&
        typeof a.default === 'string' &&
        !isIsoDate(a.default)
      )
        c.add(`${path}.default`, 'The default is not a valid date.');
      if (
        typeName === 'date-time' &&
        typeof a.default === 'string' &&
        !isIsoDateTime(a.default)
      )
        c.add(`${path}.default`, 'The default is not a valid date and time.');
      if (
        typeName === 'duration' &&
        typeof a.default === 'string' &&
        !isIsoDuration(a.default)
      )
        c.add(`${path}.default`, 'The default is not a valid duration.');
    }
  }
  return c.issues.length === before ? (a as unknown as AttributeDef) : null;
}

function checkAttributes(
  c: Checker,
  value: unknown,
  path: string,
  languages: readonly string[],
): AttributeDef[] {
  const list = c.array(value, path, 'The attributes');
  if (!list) return [];
  return list
    .map((raw, i) => checkAttribute(c, raw, `${path}[${i}]`, languages))
    .filter((x): x is AttributeDef => x !== null);
}

function nameOf(def: Rec, fallback: string): string {
  return typeof def.key === 'string' ? def.key : fallback;
}

/**
 * Checks a tool library and returns every problem found, each with the path of the offending
 * part and a message a tool builder can act on. An empty list means the library is sound.
 */
/** Checks one attribute definition on its own, for editors that add or change attributes one at a time. */
export function validateAttribute(
  def: unknown,
  languages: readonly string[] = [],
): Issue[] {
  const c = new Checker();
  checkAttributes(c, [def], 'attribute', languages);
  return c.issues.map((i) => ({
    ...i,
    path: i.path.replace(/^attribute\[0\]\.?/, '') || 'attribute',
  }));
}

export function validateToolLibrary(value: unknown): Issue[] {
  const c = new Checker();
  const root = c.object(
    value,
    '',
    [
      'formatVersion',
      'manifest',
      'settings',
      'classes',
      'relations',
      'modelTypes',
      'shapes',
      'panels',
    ],
    'The tool library',
  );
  if (!root) return c.issues;

  c.int(root.formatVersion, 'formatVersion', 'The format version', 1);

  // manifest
  const languages: string[] = [];
  const manifest = c.object(
    root.manifest,
    'manifest',
    ['id', 'name', 'version', 'languages'],
    'The manifest',
  );
  if (manifest) {
    c.id('tool', manifest.id, 'manifest.id', 'The tool id');
    c.string(manifest.name, 'manifest.name', 'The tool name');
    if (
      c.string(manifest.version, 'manifest.version', 'The version') !== null &&
      !VERSION.test(manifest.version as string)
    ) {
      c.add(
        'manifest.version',
        `The version must look like 1.0.0 (it is ${JSON.stringify(manifest.version)}).`,
      );
    }
    const langs = c.array(
      manifest.languages,
      'manifest.languages',
      'The languages',
    );
    if (langs) {
      if (langs.length === 0)
        c.add('manifest.languages', 'At least one language is required.');
      langs.forEach((l, i) => {
        if (typeof l !== 'string' || !LANGUAGE.test(l))
          c.add(
            `manifest.languages[${i}]`,
            `${JSON.stringify(l)} is not a language code such as en or de.`,
          );
        else languages.push(l);
      });
      if (new Set(languages).size !== languages.length)
        c.add('manifest.languages', 'A language is listed more than once.');
    }
  } else if (root.manifest === undefined) {
    c.issues.pop();
    c.add(
      'manifest',
      'The manifest is missing. It holds the id, name, version and languages of the tool.',
    );
  }

  // settings
  const settings = c.object(
    root.settings,
    'settings',
    ['grid', 'layers', 'numbering'],
    'The settings',
  );
  if (settings) {
    const grid = c.object(
      settings.grid,
      'settings.grid',
      ['size', 'snap', 'visible'],
      'The grid',
    );
    if (grid) {
      if (
        c.number(grid.size, 'settings.grid.size', 'The grid size') !== null &&
        (grid.size as number) <= 0
      )
        c.add('settings.grid.size', 'The grid size must be above 0.');
      c.boolean(grid.snap, 'settings.grid.snap', 'snap');
      c.boolean(grid.visible, 'settings.grid.visible', 'visible');
    }
    const layers = c.array(settings.layers, 'settings.layers', 'The layers');
    const layerKeys = new Set<string>();
    layers?.forEach((l, i) => {
      const p = `settings.layers[${i}]`;
      const o = c.object(l, p, ['key', 'labels', 'visible'], 'A layer');
      if (!o) return;
      const key = c.key(o.key, `${p}.key`, 'The layer key');
      if (key !== null) {
        if (layerKeys.has(key))
          c.add(`${p}.key`, `The layer key "${key}" is used twice.`);
        layerKeys.add(key);
      }
      c.labels(o.labels, `${p}.labels`, 'The layer labels', languages, {
        required: true,
      });
      c.boolean(o.visible, `${p}.visible`, 'visible');
    });
    const numbering = c.object(
      settings.numbering,
      'settings.numbering',
      ['enabled', 'prefix', 'start'],
      'The numbering',
    );
    if (numbering) {
      c.boolean(numbering.enabled, 'settings.numbering.enabled', 'enabled');
      c.string(numbering.prefix, 'settings.numbering.prefix', 'The prefix', {
        empty: true,
      });
      c.int(numbering.start, 'settings.numbering.start', 'The start number', 0);
    }
  } else if (root.settings === undefined) {
    c.issues.pop();
    c.add(
      'settings',
      'The settings are missing. They hold the grid, layers and numbering.',
    );
  }

  const classes = recordOf(c, root.classes, 'classes', 'The classes');
  const relations = recordOf(
    c,
    root.relations,
    'relations',
    'The relation classes',
  );
  const modelTypes = recordOf(
    c,
    root.modelTypes,
    'modelTypes',
    'The model types',
  );
  const classIds = new Set(Object.keys(classes ?? {}));
  const relationIds = new Set(Object.keys(relations ?? {}));

  const parentOf = (
    table: Record<string, Rec>,
    id: string,
  ): string | undefined => {
    const p = table[id]?.extends;
    return typeof p === 'string' ? p : undefined;
  };
  /** Reports a loop once, naming every member, and says whether `id` is on one. */
  const loopReported = new Set<string>();
  const checkLoop = (
    table: Record<string, Rec>,
    id: string,
    path: string,
    what: string,
  ) => {
    const seen: string[] = [];
    let cur: string | undefined = id;
    while (cur !== undefined && table[cur]) {
      if (seen.includes(cur)) {
        const members = seen.slice(seen.indexOf(cur));
        const sig = [...members].sort().join('|');
        if (!loopReported.has(sig)) {
          loopReported.add(sig);
          c.add(
            path,
            `The ${what === 'class' ? 'classes' : 'relation classes'} ${members.map((m) => `"${nameOf(table[m]!, m)}"`).join(' and ')} extend each other in a loop.`,
          );
        }
        return;
      }
      seen.push(cur);
      cur = parentOf(table, cur);
    }
  };

  // classes
  const classKeys = new Map<string, string>();
  for (const [id, raw] of Object.entries(classes ?? {})) {
    const path = `classes.${id}`;
    const d = c.object(
      raw,
      path,
      [
        'id',
        'key',
        'kind',
        'labels',
        'extends',
        'abstract',
        'attributes',
        'shape',
        'panel',
        'help',
      ],
      'A class',
    );
    if (!d) continue;
    if (d.id !== id)
      c.add(
        `${path}.id`,
        `The id "${String(d.id)}" does not match the entry name "${id}".`,
      );
    c.id('class', d.id, `${path}.id`, 'The class id');
    const key = c.key(d.key, `${path}.key`, 'The class key');
    if (key !== null) {
      const other = classKeys.get(key);
      if (other)
        c.add(
          `${path}.key`,
          `The class key "${key}" is also used by ${other}.`,
        );
      else classKeys.set(key, id);
    }
    if (!(CLASS_KINDS as readonly string[]).includes(d.kind as string)) {
      c.add(
        `${path}.kind`,
        `The kind must be one of: ${CLASS_KINDS.join(', ')} (it is ${JSON.stringify(d.kind)}).`,
      );
    }
    c.labels(d.labels, `${path}.labels`, 'The class labels', languages, {
      required: true,
    });
    if (d.extends !== undefined) {
      if (
        c.id('class', d.extends, `${path}.extends`, 'The parent class') !== null
      ) {
        if (!classIds.has(d.extends as string))
          c.add(
            `${path}.extends`,
            `The parent class ${d.extends as string} does not exist.`,
          );
        else
          checkLoop(
            classes as Record<string, Rec>,
            id,
            `${path}.extends`,
            'class',
          );
      }
    }
    if (d.abstract !== undefined)
      c.boolean(d.abstract, `${path}.abstract`, 'abstract');
    if (d.shape !== undefined)
      c.id('shape', d.shape, `${path}.shape`, 'The shape');
    if (d.panel !== undefined)
      c.string(d.panel, `${path}.panel`, 'The panel layout');
    if (d.help !== undefined)
      c.labels(d.help, `${path}.help`, 'The help text', languages, {
        required: false,
      });
    checkAttributes(c, d.attributes, `${path}.attributes`, languages);
  }

  // relations
  const relationKeys = new Map<string, string>();
  for (const [id, raw] of Object.entries(relations ?? {})) {
    const path = `relations.${id}`;
    const d = c.object(
      raw,
      path,
      [
        'id',
        'key',
        'labels',
        'extends',
        'abstract',
        'from',
        'to',
        'attributes',
        'shape',
        'help',
      ],
      'A relation class',
    );
    if (!d) continue;
    if (d.id !== id)
      c.add(
        `${path}.id`,
        `The id "${String(d.id)}" does not match the entry name "${id}".`,
      );
    c.id('relation', d.id, `${path}.id`, 'The relation class id');
    const key = c.key(d.key, `${path}.key`, 'The relation class key');
    if (key !== null) {
      const other = relationKeys.get(key);
      if (other)
        c.add(
          `${path}.key`,
          `The relation class key "${key}" is also used by ${other}.`,
        );
      else relationKeys.set(key, id);
    }
    c.labels(
      d.labels,
      `${path}.labels`,
      'The relation class labels',
      languages,
      { required: true },
    );
    let hasParent = false;
    if (
      d.extends !== undefined &&
      c.id(
        'relation',
        d.extends,
        `${path}.extends`,
        'The parent relation class',
      ) !== null
    ) {
      if (!relationIds.has(d.extends as string))
        c.add(
          `${path}.extends`,
          `The parent relation class ${d.extends as string} does not exist.`,
        );
      else {
        hasParent = true;
        checkLoop(
          relations as Record<string, Rec>,
          id,
          `${path}.extends`,
          'relation class',
        );
      }
    }
    for (const end of ['from', 'to'] as const) {
      const list = c.array(
        d[end],
        `${path}.${end}`,
        `The ${end.toUpperCase()} classes`,
      );
      if (!list) continue;
      if (list.length === 0 && !hasParent)
        c.add(
          `${path}.${end}`,
          `At least one ${end.toUpperCase()} class is required, because the relation class has no parent to inherit them from.`,
        );
      list.forEach((cid, i) => {
        if (
          c.id(
            'class',
            cid,
            `${path}.${end}[${i}]`,
            `The ${end.toUpperCase()} class`,
          ) !== null &&
          !classIds.has(cid as string)
        ) {
          c.add(
            `${path}.${end}[${i}]`,
            `The ${end.toUpperCase()} class ${cid as string} does not exist.`,
          );
        }
      });
    }
    if (d.abstract !== undefined)
      c.boolean(d.abstract, `${path}.abstract`, 'abstract');
    if (d.shape !== undefined)
      c.id('shape', d.shape, `${path}.shape`, 'The line shape');
    if (d.help !== undefined)
      c.labels(d.help, `${path}.help`, 'The help text', languages, {
        required: false,
      });
    checkAttributes(c, d.attributes, `${path}.attributes`, languages);
  }

  // model types
  const modelTypeKeys = new Map<string, string>();
  for (const [id, raw] of Object.entries(modelTypes ?? {})) {
    const path = `modelTypes.${id}`;
    const d = c.object(
      raw,
      path,
      [
        'id',
        'key',
        'labels',
        'classes',
        'relations',
        'views',
        'cardinalities',
        'attributes',
        'background',
        'containers',
        'help',
      ],
      'A model type',
    );
    if (!d) continue;
    if (d.id !== id)
      c.add(
        `${path}.id`,
        `The id "${String(d.id)}" does not match the entry name "${id}".`,
      );
    c.id('modelType', d.id, `${path}.id`, 'The model type id');
    const key = c.key(d.key, `${path}.key`, 'The model type key');
    if (key !== null) {
      const other = modelTypeKeys.get(key);
      if (other)
        c.add(
          `${path}.key`,
          `The model type key "${key}" is also used by ${other}.`,
        );
      else modelTypeKeys.set(key, id);
    }
    c.labels(d.labels, `${path}.labels`, 'The model type labels', languages, {
      required: true,
    });
    const allowedClasses = new Set<string>();
    const allowedRelations = new Set<string>();
    for (const [field, kind, set, existing, what] of [
      ['classes', 'class', allowedClasses, classIds, 'class'],
      [
        'relations',
        'relation',
        allowedRelations,
        relationIds,
        'relation class',
      ],
    ] as const) {
      const list = c.array(
        d[field],
        `${path}.${field}`,
        `The allowed ${what}es`,
      );
      list?.forEach((x, i) => {
        if (c.id(kind, x, `${path}.${field}[${i}]`, `The ${what} id`) === null)
          return;
        if (!existing.has(x as string))
          c.add(
            `${path}.${field}[${i}]`,
            `The ${what} ${x as string} does not exist.`,
          );
        if (set.has(x as string))
          c.add(
            `${path}.${field}[${i}]`,
            `The ${what} ${x as string} is listed more than once.`,
          );
        set.add(x as string);
      });
    }
    const views = c.array(d.views, `${path}.views`, 'The views');
    const viewKeys = new Set<string>();
    views?.forEach((v, i) => {
      const p = `${path}.views[${i}]`;
      const o = c.object(
        v,
        p,
        ['id', 'key', 'labels', 'classes', 'relations'],
        'A view',
      );
      if (!o) return;
      c.id('view', o.id, `${p}.id`, 'The view id');
      const vkey = c.key(o.key, `${p}.key`, 'The view key');
      if (vkey !== null) {
        if (viewKeys.has(vkey))
          c.add(
            `${p}.key`,
            `The view key "${vkey}" is used twice in this model type.`,
          );
        viewKeys.add(vkey);
      }
      c.labels(o.labels, `${p}.labels`, 'The view labels', languages, {
        required: true,
      });
      for (const [field, set, what] of [
        ['classes', allowedClasses, 'class'],
        ['relations', allowedRelations, 'relation class'],
      ] as const) {
        c.array(o[field], `${p}.${field}`, `The view ${field}`)?.forEach(
          (x, j) => {
            if (typeof x === 'string' && !set.has(x))
              c.add(
                `${p}.${field}[${j}]`,
                `The view "${nameOf(o, '?')}" uses the ${what} ${x}, which the model type does not allow.`,
              );
          },
        );
      }
    });
    const cards = c.array(
      d.cardinalities,
      `${path}.cardinalities`,
      'The cardinalities',
    );
    cards?.forEach((card, i) => {
      const p = `${path}.cardinalities[${i}]`;
      const kind = (card as Rec | null)?.kind;
      const o = c.object(
        card,
        p,
        kind === 'degree'
          ? ['kind', 'class', 'relation', 'end', 'min', 'max']
          : ['kind', 'class', 'min', 'max'],
        'A cardinality',
      );
      if (!o) return;
      if (kind !== 'count' && kind !== 'degree')
        c.add(`${p}.kind`, 'The cardinality kind must be "count" or "degree".');
      if (
        c.id('class', o.class, `${p}.class`, 'The cardinality class') !==
          null &&
        !allowedClasses.has(o.class as string)
      ) {
        c.add(
          `${p}.class`,
          `The cardinality refers to the class ${o.class as string}, which the model type does not allow.`,
        );
      }
      if (kind === 'degree') {
        if (
          c.id(
            'relation',
            o.relation,
            `${p}.relation`,
            'The cardinality relation class',
          ) !== null &&
          !allowedRelations.has(o.relation as string)
        ) {
          c.add(
            `${p}.relation`,
            `The cardinality refers to the relation class ${o.relation as string}, which the model type does not allow.`,
          );
        }
        if (o.end !== 'from' && o.end !== 'to')
          c.add(`${p}.end`, 'end must be "from" or "to".');
      }
      const min =
        o.min === undefined ? null : c.int(o.min, `${p}.min`, 'The minimum', 0);
      const max =
        o.max === undefined ? null : c.int(o.max, `${p}.max`, 'The maximum', 0);
      if (min !== null && max !== null && min > max)
        c.add(p, `The minimum (${min}) is above the maximum (${max}).`);
      if (o.min === undefined && o.max === undefined)
        c.add(p, 'A cardinality needs a minimum, a maximum or both.');
    });
    checkAttributes(c, d.attributes, `${path}.attributes`, languages);
    if (d.background !== undefined)
      c.id('shape', d.background, `${path}.background`, 'The background shape');
    if (d.containers !== undefined) {
      const co = c.object(
        d.containers,
        `${path}.containers`,
        Object.keys((d.containers as Rec | null) ?? {}),
        'The container rules',
      );
      for (const [container, accepted] of Object.entries(co ?? {})) {
        c.id(
          'class',
          container,
          `${path}.containers.${container}`,
          'The container class',
        );
        c.array(
          accepted,
          `${path}.containers.${container}`,
          'The accepted classes',
        )?.forEach((a, i) =>
          c.id(
            'class',
            a,
            `${path}.containers.${container}[${i}]`,
            'An accepted class',
          ),
        );
      }
    }
    if (d.help !== undefined)
      c.labels(d.help, `${path}.help`, 'The help text', languages, {
        required: false,
      });
  }

  // Keys must be unique among the attributes an element can have, inherited ones included.
  if (!c.issues.some((i) => i.path.endsWith('.extends'))) {
    const uniqueAttributes = (
      path: string,
      attrs: AttributeDef[],
      what: string,
    ) => {
      const keys = new Map<string, string>();
      const ids = new Map<string, string>();
      for (const a of attrs) {
        if (typeof a.key !== 'string' || typeof a.id !== 'string') continue;
        if (keys.has(a.key))
          c.add(
            path,
            `${what} has two attributes with the key "${a.key}" (${keys.get(a.key)} and ${a.id}), counting inherited attributes.`,
          );
        keys.set(a.key, a.id);
        if (ids.has(a.id))
          c.add(
            path,
            `${what} has two attributes with the id ${a.id}, counting inherited attributes.`,
          );
        ids.set(a.id, a.key);
      }
    };
    const own = (x: unknown): AttributeDef[] =>
      Array.isArray((x as Rec)?.attributes)
        ? ((x as Rec).attributes as AttributeDef[])
        : [];
    for (const id of Object.keys(classes ?? {})) {
      const chainOf: AttributeDef[] = [];
      let cur: string | undefined = id;
      const guard = new Set<string>();
      while (cur && classes?.[cur] && !guard.has(cur)) {
        guard.add(cur);
        chainOf.unshift(...own(classes[cur]));
        cur = parentOf(classes as Record<string, Rec>, cur);
      }
      uniqueAttributes(
        `classes.${id}.attributes`,
        chainOf,
        `The class "${nameOf(classes![id] as Rec, id)}"`,
      );
    }
    for (const id of Object.keys(relations ?? {})) {
      const chainOf: AttributeDef[] = [];
      let cur: string | undefined = id;
      const guard = new Set<string>();
      while (cur && relations?.[cur] && !guard.has(cur)) {
        guard.add(cur);
        chainOf.unshift(...own(relations[cur]));
        cur = parentOf(relations as Record<string, Rec>, cur);
      }
      uniqueAttributes(
        `relations.${id}.attributes`,
        chainOf,
        `The relation class "${nameOf(relations![id] as Rec, id)}"`,
      );
    }
    for (const id of Object.keys(modelTypes ?? {})) {
      uniqueAttributes(
        `modelTypes.${id}.attributes`,
        own(modelTypes![id]),
        `The model type "${nameOf(modelTypes![id] as Rec, id)}"`,
      );
    }
  }

  for (const key of ['shapes', 'panels'])
    if (root[key] === undefined)
      c.add(
        key,
        `The ${key} are missing. Use an empty object if there are none (format 2).`,
      );
  checkShapeTables(c, root);
  if (c.issues.length === 0) checkShapeReferences(c, value as ToolLibrary);

  return c.issues;
}

function recordOf(
  c: Checker,
  value: unknown,
  path: string,
  what: string,
): Record<string, unknown> | null {
  if (value === undefined) {
    c.add(path, `${what} are missing. Use an empty object if there are none.`);
    return null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    c.add(path, `${what} must be an object keyed by id.`);
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseToolLibrary(value: unknown): ParseResult<ToolLibrary> {
  const issues = validateToolLibrary(value);
  return issues.length === 0
    ? { ok: true, value: value as ToolLibrary }
    : { ok: false, issues };
}

export function formatIssues(issues: readonly Issue[]): string {
  return issues
    .map((i) => `${i.path === '' ? '(top level)' : i.path}: ${i.message}`)
    .join('\n');
}
