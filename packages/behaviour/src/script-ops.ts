import {
  checkAttributeValue,
  effectiveAttributes,
  effectiveRelationAttributes,
  findClassByKey,
  findModelTypeByKey,
  findRelationByKey,
  inDrawingOrder,
  isA,
  ModelCalculator,
  optionValue,
  relationIsA,
  type AttributeDef,
  type AttributeId,
  type ClassDef,
  type ClassId,
  type CommandPlace,
  type ConnectorId,
  type ElementId,
  type Json,
  type Model,
  type ModelStore,
  type ModelTypeDef,
  type RelationDef,
  type RelationId,
  type TableAttribute,
  type ToolLibrary,
} from '@metakit-app/core';
import type { BehaviourHost, FormSpec, ProgressHandle } from './host';
import {
  MAX_TRANSFER_CHARS,
  workspacePath,
  type ScriptFiles,
  type ScriptHttp,
  type ScriptHttpRequest,
} from './script-services';

/** What the operations need from the engine. */
export interface OpsContext {
  store: ModelStore;
  calculator: ModelCalculator;
  tool(): ToolLibrary;
  host: BehaviourHost;
  selection(): string[];
  files: ScriptFiles | undefined;
  http: ScriptHttp | undefined;
  /** Throws a plain-English error unless the tool declares the permission and this browser allowed it. */
  require(kind: 'files' | 'network'): void;
  log(
    level: 'log' | 'info' | 'warn' | 'error',
    text: string,
    scriptId: string | null,
  ): void;
  scriptError(message: string, stack: string, scriptId: string | null): void;
  onRegister(
    event: string,
    filter: Record<string, string>,
    index: number,
  ): void;
  onCommand(
    spec: { id: string; label: string; place: CommandPlace },
    index: number,
  ): void;
  runDone(runId: number, error: string | null): void;
}

type Args = unknown[];

const fail = (message: string): never => {
  throw new Error(message);
};

const model = (c: OpsContext): Model => c.store.working;

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') return fail(`${what} must be text.`);
  return value;
}

function json(value: unknown): Json {
  if (value === undefined) return null;
  return value as Json;
}

// -- looking things up ----------------------------------------------------------------------

function classOf(tool: ToolLibrary, key: unknown): ClassDef {
  const found = typeof key === 'string' ? findClassByKey(tool, key) : undefined;
  if (found) return found;
  const names = Object.values(tool.classes)
    .filter((c) => !c.abstract)
    .map((c) => c.key);
  return fail(
    `This Kit has no class "${String(key)}".${names.length ? ` Classes: ${names.join(', ')}.` : ''}`,
  );
}

function relationOf(tool: ToolLibrary, key: unknown): RelationDef {
  const found =
    typeof key === 'string' ? findRelationByKey(tool, key) : undefined;
  if (found) return found;
  const names = Object.values(tool.relations).map((r) => r.key);
  return fail(
    `This Kit has no relation class "${String(key)}".${names.length ? ` Relation classes: ${names.join(', ')}.` : ''}`,
  );
}

type Subject =
  | { kind: 'element'; id: ElementId; class: ClassDef }
  | { kind: 'connector'; id: ConnectorId; relation: RelationDef }
  | { kind: 'model' };

function subjectOf(c: OpsContext, id: unknown): Subject {
  if (id === 'model') return { kind: 'model' };
  const tool = c.tool();
  const m = model(c);
  const el = m.elements[id as ElementId];
  if (el) {
    const def = tool.classes[el.class];
    if (def) return { kind: 'element', id: el.id, class: def };
  }
  const cn = m.connectors[id as ConnectorId];
  if (cn) {
    const def = tool.relations[cn.relation];
    if (def) return { kind: 'connector', id: cn.id, relation: def };
  }
  return fail(
    `The object ${String(id)} does not exist in this model (it may have been deleted).`,
  );
}

function definitions(c: OpsContext, s: Subject): AttributeDef[] {
  const tool = c.tool();
  switch (s.kind) {
    case 'element':
      return effectiveAttributes(tool, s.class.id);
    case 'connector':
      return effectiveRelationAttributes(tool, s.relation.id);
    case 'model':
      return tool.modelTypes[model(c).manifest.modelType]?.attributes ?? [];
  }
}

function ownerName(c: OpsContext, s: Subject): string {
  switch (s.kind) {
    case 'element':
      return `the class "${s.class.key}"`;
    case 'connector':
      return `the relation class "${s.relation.key}"`;
    case 'model':
      return 'the model type';
  }
}

function definition(c: OpsContext, s: Subject, key: unknown): AttributeDef {
  const found = definitions(c, s).find((d) => d.key === key);
  if (found) return found;
  const keys = definitions(c, s).map((d) => d.key);
  return fail(
    `${String(key)} is not an attribute of ${ownerName(c, s)}.${keys.length ? ` Attributes: ${keys.join(', ')}.` : ''}`,
  );
}

function storedOf(c: OpsContext, s: Subject): Record<string, Json> {
  const m = model(c);
  if (s.kind === 'model') return m.attrs;
  return s.kind === 'element'
    ? m.elements[s.id]!.attrs
    : m.connectors[s.id]!.attrs;
}

// -- values -----------------------------------------------------------------------------------

/** Rows are stored by column id and shown to scripts by column key. */
function rowsOut(def: TableAttribute, raw: Json | undefined): Json {
  if (!Array.isArray(raw)) return [];
  const keyOf = new Map(def.columns.map((col) => [col.id, col.key]));
  return raw.map((row) => {
    const out: Record<string, Json> = {};
    if (row !== null && typeof row === 'object' && !Array.isArray(row))
      for (const [col, v] of Object.entries(row))
        out[keyOf.get(col) ?? col] = v;
    return out;
  });
}

function rowsIn(def: TableAttribute, value: Json): Json {
  if (!Array.isArray(value))
    return fail(
      `The attribute "${def.key}" is a table: set it to a list of rows.`,
    );
  const idOf = new Map(def.columns.map((col) => [col.key, col.id]));
  return value.map((row) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row))
      return fail(`A row of "${def.key}" must be an object of column values.`);
    const out: Record<string, Json> = {};
    for (const [key, v] of Object.entries(row)) {
      const id = idOf.get(key);
      if (!id)
        return fail(
          `The table "${def.key}" has no column "${key}". Columns: ${def.columns.map((col) => col.key).join(', ')}.`,
        );
      out[id] = v;
    }
    return out;
  });
}

/**
 * Formulas are calculated over the state the script sees, including its own writes. The shared
 * calculator reads the committed state, which does not have what this step has done so far, so a
 * calculator is made per state (a state is a new object after every write).
 */
const calculators = new WeakMap<
  Model,
  { tool: ToolLibrary; calculator: ModelCalculator }
>();

function calculatorFor(c: OpsContext): ModelCalculator {
  const state = model(c);
  const tool = c.tool();
  const known = calculators.get(state);
  if (known && known.tool === tool) return known.calculator;
  const calculator = new ModelCalculator(tool, () => state);
  calculators.set(state, { tool, calculator });
  return calculator;
}

function readAttribute(c: OpsContext, s: Subject, def: AttributeDef): Json {
  if (def.type === 'formula')
    return calculatorFor(c).get(
      s.kind === 'model' ? 'model' : s.id,
      def.key,
    ) as Json;
  const raw = storedOf(c, s)[def.id];
  if (def.type === 'table') return rowsOut(def, raw ?? def.default);
  if (raw !== undefined) return raw;
  return 'default' in def && def.default !== undefined ? def.default : null;
}

function valueIn(def: AttributeDef, value: Json): Json {
  if (def.type === 'formula' || def.type === 'action')
    return fail(
      `The attribute "${def.key}" is ${def.type === 'formula' ? 'calculated' : 'a button'} and cannot be set.`,
    );
  const stored = def.type === 'table' ? rowsIn(def, value) : value;
  const wrong = checkAttributeValue(def, stored).find((p) =>
    ['wrong-type', 'not-an-option', 'not-integer'].includes(p.code),
  );
  if (wrong) return fail(`The attribute "${def.key}" ${wrong.message}.`);
  return stored;
}

function attrsIn(
  c: OpsContext,
  s: Subject,
  attrs: unknown,
): Record<AttributeId, Json> {
  const out: Record<string, Json> = {};
  if (attrs === null || typeof attrs !== 'object' || Array.isArray(attrs))
    return fail('"attrs" must be an object of attribute values by key.');
  for (const [key, value] of Object.entries(attrs)) {
    const def = definition(c, s, key);
    out[def.id] = valueIn(def, json(value));
  }
  return out as Record<AttributeId, Json>;
}

// -- changing the model ---------------------------------------------------------------------------

function run(
  c: OpsContext,
  command: Parameters<ModelStore['execute']>[0],
): unknown {
  const result = c.store.execute(command);
  if (!result.ok) return fail(`The change was cancelled: ${result.reason}`);
  return result.value;
}

function classKey(tool: ToolLibrary, id: ClassId): string {
  return tool.classes[id]?.key ?? id;
}

function create(
  c: OpsContext,
  clsKey: unknown,
  spec: Record<string, unknown>,
): string {
  const tool = c.tool();
  const cls = classOf(tool, clsKey);
  if (cls.abstract)
    return fail(
      `The class "${cls.key}" is abstract; create one of its subclasses.`,
    );
  const subject: Subject = { kind: 'element', id: '' as ElementId, class: cls };
  const attrs = attrsIn(c, subject, spec.attrs ?? {});
  const id = run(c, {
    type: 'createElement',
    class: cls.id,
    x: Number(spec.x ?? 0),
    y: Number(spec.y ?? 0),
    ...(spec.w !== undefined ? { w: Number(spec.w) } : {}),
    ...(spec.h !== undefined ? { h: Number(spec.h) } : {}),
    ...(typeof spec.parent === 'string'
      ? { parent: spec.parent as ElementId }
      : {}),
    ...(Object.keys(attrs).length ? { attrs } : {}),
  });
  return id as string;
}

function update(
  c: OpsContext,
  id: unknown,
  patch: Record<string, unknown>,
): void {
  const s = subjectOf(c, id);
  if (s.kind === 'model')
    return fail('The model itself cannot be changed here; use model.attrs.');
  const attrs = patch.attrs === undefined ? {} : attrsIn(c, s, patch.attrs);
  if (s.kind === 'element') {
    const el = model(c).elements[s.id]!;
    const moves =
      patch.x !== undefined ||
      patch.y !== undefined ||
      patch.parent !== undefined;
    if (moves)
      run(c, {
        type: 'move',
        id: s.id,
        x: Number(patch.x ?? el.x),
        y: Number(patch.y ?? el.y),
        ...(patch.parent !== undefined
          ? { parent: patch.parent as ElementId | null }
          : {}),
      });
    if (patch.w !== undefined || patch.h !== undefined)
      run(c, {
        type: 'resize',
        id: s.id,
        w: Number(patch.w ?? el.w),
        h: Number(patch.h ?? el.h),
      });
  } else if (
    ['x', 'y', 'w', 'h', 'parent'].some((k) => patch[k] !== undefined)
  ) {
    return fail('A connector has attributes only; it has no position or size.');
  }
  for (const [attr, value] of Object.entries(attrs))
    run(c, {
      type: 'setAttribute',
      target: s.id,
      attr: attr as AttributeId,
      value,
    });
}

// -- the meta-model as data ---------------------------------------------------------------------------

function attributeOut(def: AttributeDef): Json {
  const out: Record<string, Json> = {
    ...(def as unknown as Record<string, Json>),
  };
  if ('options' in def) out.options = def.options.map((o) => optionValue(o));
  return out;
}

function classOut(tool: ToolLibrary, def: ClassDef): Json {
  return {
    key: def.key,
    kind: def.kind,
    labels: def.labels,
    extends: def.extends ? classKey(tool, def.extends) : null,
    abstract: def.abstract === true,
    attributes: effectiveAttributes(tool, def.id).map(attributeOut),
  };
}

function relationOut(tool: ToolLibrary, def: RelationDef): Json {
  return {
    key: def.key,
    labels: def.labels,
    extends: def.extends ? (tool.relations[def.extends]?.key ?? null) : null,
    abstract: def.abstract === true,
    from: def.from.map((id) => classKey(tool, id)),
    to: def.to.map((id) => classKey(tool, id)),
    attributes: effectiveRelationAttributes(tool, def.id).map(attributeOut),
  };
}

function modelTypeOut(tool: ToolLibrary, def: ModelTypeDef): Json {
  return {
    key: def.key,
    labels: def.labels,
    classes: def.classes.map((id) => classKey(tool, id)),
    relations: def.relations.map((id) => tool.relations[id]?.key ?? id),
    views: def.views.map((v) => ({
      key: v.key,
      labels: v.labels,
      classes: v.classes.map((id) => classKey(tool, id)),
      relations: v.relations.map((id) => tool.relations[id]?.key ?? id),
    })),
    attributes: def.attributes.map(attributeOut),
  };
}

// -- web and files ---------------------------------------------------------------------------------

function cap(textValue: string, what: string): string {
  if (textValue.length > MAX_TRANSFER_CHARS)
    return fail(`${what} is longer than ${MAX_TRANSFER_CHARS} characters.`);
  return textValue;
}

function filesOf(c: OpsContext): ScriptFiles {
  c.require('files');
  return (
    c.files ??
    fail('This app does not give scripts access to the workspace files.')
  );
}

function pathOf(value: unknown): string {
  const path = workspacePath(value);
  if (path === null || path === '')
    return fail(
      'A file path must be inside the workspace, written like "reports/tasks.csv", without ".." or a drive letter.',
    );
  return path;
}

function request(
  c: OpsContext,
  spec: Record<string, unknown>,
): ScriptHttpRequest {
  c.require('network');
  let url: URL;
  try {
    url = new URL(text(spec.url, 'The address'));
  } catch {
    return fail(`"${String(spec.url)}" is not a web address.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return fail(
      'Scripts can only call web addresses that start with http:// or https://.',
    );
  const method = String(spec.method ?? 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
    return fail(`The method ${method} is not supported.`);
  const headers: Record<string, string> = {};
  if (spec.headers && typeof spec.headers === 'object')
    for (const [k, v] of Object.entries(spec.headers)) headers[k] = String(v);
  return {
    method: method as ScriptHttpRequest['method'],
    url: url.toString(),
    headers,
    ...(typeof spec.body === 'string'
      ? { body: cap(spec.body, 'The request') }
      : {}),
  };
}

// -- the operations ---------------------------------------------------------------------------------

/**
 * Everything a script can ask the host to do, by name. Each runs the checks itself: the prelude
 * inside the sandbox is a convenience and is never trusted. All of them must stay short, because
 * the time limit of the sandbox cannot interrupt host code.
 */
export function createOps(c: OpsContext): (op: string, args: Args) => unknown {
  const progresses = new Map<number, ProgressHandle>();
  let nextProgress = 1;

  return (op, a) => {
    const tool = c.tool();
    switch (op) {
      // --- console and bookkeeping
      case 'console': {
        const level =
          a[0] === 'warn' || a[0] === 'error' || a[0] === 'info' ? a[0] : 'log';
        c.log(level, String(a[1]), typeof a[2] === 'string' ? a[2] : null);
        return null;
      }
      case 'script.error':
        c.scriptError(
          String(a[0]),
          String(a[1]),
          typeof a[2] === 'string' ? a[2] : null,
        );
        return null;
      case 'run.done':
        c.runDone(Number(a[0]), typeof a[1] === 'string' ? a[1] : null);
        return null;
      case 'on.register': {
        const event = text(a[0], 'The event name');
        const filter = (a[1] ?? {}) as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(filter)) {
          if (v === undefined || v === null) continue;
          if (k === 'class') out.class = classOf(tool, v).id;
          else if (k === 'relation') out.relation = relationOf(tool, v).id;
          else if (k === 'attribute') out.attribute = text(v, 'The attribute');
          else
            return fail(
              `The filter "${k}" is not known. Use class, attribute or relation.`,
            );
        }
        c.onRegister(event, out, Number(a[2]));
        return null;
      }
      case 'cmd.register': {
        const spec = (a[0] ?? {}) as Record<string, unknown>;
        const id = text(spec.id, 'The command id');
        if (!/^[A-Za-z0-9._-]+$/.test(id))
          return fail(
            'A command id uses letters, digits, dots, dashes and underscores only.',
          );
        const label = text(spec.label, 'The command label');
        const places: CommandPlace[] = [];
        if (typeof spec.menu === 'string' || spec.menu === true)
          places.push('model');
        if (spec.toolbar) places.push('toolbar');
        if (spec.context) places.push('context');
        if (places.length === 0) places.push('model');
        for (const place of places)
          c.onCommand(
            { id: places.length > 1 ? `${id}:${place}` : id, label, place },
            Number(a[1]),
          );
        return null;
      }

      // --- the model: queries
      case 'm.exists':
        return (
          typeof a[0] === 'string' &&
          (a[0] in model(c).elements || a[0] in model(c).connectors)
        );
      case 'm.objects': {
        const cls = a[0] === null ? null : classOf(tool, a[0]);
        const list = inDrawingOrder(model(c).elements).filter(
          (e) => cls === null || isA(tool, e.class, cls.id),
        );
        return list.map((e) => e.id);
      }
      case 'm.connectors': {
        const rel = a[0] === null ? null : relationOf(tool, a[0]);
        return inDrawingOrder(model(c).connectors)
          .filter(
            (cn) => rel === null || relationIsA(tool, cn.relation, rel.id),
          )
          .map((cn) => cn.id);
      }
      case 'm.selection':
        return c
          .selection()
          .filter((id) => id in model(c).elements || id in model(c).connectors);
      case 'el.get': {
        const s = subjectOf(c, a[0]);
        if (s.kind !== 'element')
          return fail(`${String(a[0])} is not an object.`);
        const e = model(c).elements[s.id]!;
        return {
          class: s.class.key,
          x: e.x,
          y: e.y,
          w: e.w,
          h: e.h,
          parent: e.parent ?? null,
        };
      }
      case 'cn.get': {
        const s = subjectOf(c, a[0]);
        if (s.kind !== 'connector')
          return fail(`${String(a[0])} is not a connector.`);
        const cn = model(c).connectors[s.id]!;
        return { relation: s.relation.key, from: cn.from, to: cn.to };
      }
      case 'el.children': {
        const s = subjectOf(c, a[0]);
        return inDrawingOrder(model(c).elements)
          .filter((e) => s.kind === 'element' && e.parent === s.id)
          .map((e) => e.id);
      }
      case 'el.linked': {
        const s = subjectOf(c, a[0]);
        const rel = a[2] === null ? null : relationOf(tool, a[2]);
        const out: string[] = [];
        for (const cn of inDrawingOrder(model(c).connectors)) {
          if (rel && !relationIsA(tool, cn.relation, rel.id)) continue;
          if (a[1] === 'in' && s.kind === 'element' && cn.to === s.id)
            out.push(cn.from);
          if (a[1] === 'out' && s.kind === 'element' && cn.from === s.id)
            out.push(cn.to);
        }
        return out;
      }
      case 'el.connectors': {
        const s = subjectOf(c, a[0]);
        const rel = a[1] === null ? null : relationOf(tool, a[1]);
        return inDrawingOrder(model(c).connectors)
          .filter(
            (cn) =>
              s.kind === 'element' &&
              (cn.from === s.id || cn.to === s.id) &&
              (!rel || relationIsA(tool, cn.relation, rel.id)),
          )
          .map((cn) => cn.id);
      }

      // --- the model: attributes
      case 'attr.get': {
        const s = subjectOf(c, a[0]);
        const def = definitions(c, s).find((d) => d.key === a[1]);
        return def ? readAttribute(c, s, def) : null;
      }
      case 'attr.has': {
        const s = subjectOf(c, a[0]);
        return definitions(c, s).some((d) => d.key === a[1]);
      }
      case 'attr.keys': {
        const s = subjectOf(c, a[0]);
        return definitions(c, s)
          .filter((d) => d.type !== 'action')
          .map((d) => d.key);
      }
      case 'attr.set': {
        const s = subjectOf(c, a[0]);
        const def = definition(c, s, a[1]);
        const value = valueIn(def, json(a[2]));
        run(c, {
          type: 'setAttribute',
          target: (s.kind === 'model' ? 'model' : s.id) as ElementId,
          attr: def.id,
          value,
        });
        return null;
      }

      // --- the model: changes
      case 'm.create':
        return create(c, a[0], (a[1] ?? {}) as Record<string, unknown>);
      case 'm.connect': {
        const rel = relationOf(tool, a[0]);
        const from = subjectOf(c, a[1]);
        const to = subjectOf(c, a[2]);
        if (from.kind !== 'element' || to.kind !== 'element')
          return fail('A connector joins two objects.');
        const attrs = attrsIn(
          c,
          { kind: 'connector', id: '' as ConnectorId, relation: rel },
          a[3] ?? {},
        );
        return run(c, {
          type: 'createConnector',
          relation: rel.id as RelationId,
          from: from.id,
          to: to.id,
          ...(Object.keys(attrs).length ? { attrs } : {}),
        }) as string;
      }
      case 'm.update':
        update(c, a[0], (a[1] ?? {}) as Record<string, unknown>);
        return null;
      case 'm.delete': {
        const s = subjectOf(c, a[0]);
        if (s.kind === 'model')
          return fail('The model itself cannot be deleted by a script.');
        run(c, { type: 'delete', id: s.id });
        return null;
      }

      // --- the tool
      case 't.info':
        return { name: tool.manifest.name, version: tool.manifest.version };
      case 't.classes':
        return Object.values(tool.classes)
          .sort((x, y) => (x.key < y.key ? -1 : 1))
          .map((d) => classOut(tool, d));
      case 't.class':
        return classOut(tool, classOf(tool, a[0]));
      case 't.relations':
        return Object.values(tool.relations)
          .sort((x, y) => (x.key < y.key ? -1 : 1))
          .map((d) => relationOut(tool, d));
      case 't.relation':
        return relationOut(tool, relationOf(tool, a[0]));
      case 't.modelTypes':
        return Object.values(tool.modelTypes).map((d) => modelTypeOut(tool, d));
      case 't.modelType': {
        const found = findModelTypeByKey(tool, text(a[0], 'The model type'));
        return found
          ? modelTypeOut(tool, found)
          : fail(`This Kit has no model type "${String(a[0])}".`);
      }
      case 't.attribute': {
        const owner = text(a[0], 'The class');
        const key = text(a[1], 'The attribute');
        const cls = findClassByKey(tool, owner);
        const rel = cls ? undefined : findRelationByKey(tool, owner);
        const mt = cls || rel ? undefined : findModelTypeByKey(tool, owner);
        const defs = cls
          ? effectiveAttributes(tool, cls.id)
          : rel
            ? effectiveRelationAttributes(tool, rel.id)
            : (mt?.attributes ??
              fail(
                `This Kit has no class, relation class or model type "${owner}".`,
              ));
        const def = defs.find((d) => d.key === key);
        return def ? attributeOut(def) : null;
      }

      // --- dialogs
      case 'ui.message': {
        const kind = a[0] === 'warning' || a[0] === 'error' ? a[0] : 'info';
        c.host.message(kind, String(a[1]));
        return null;
      }
      case 'ui.confirm':
        return c.host.confirm(String(a[0]));
      case 'ui.choose': {
        if (!Array.isArray(a[1]) || a[1].some((o) => typeof o !== 'string'))
          return fail('The choices must be a list of text.');
        return c.host.choose(String(a[0]), a[1] as string[]);
      }
      case 'ui.prompt':
        if (!c.host.prompt) return fail('This app cannot ask for text.');
        return c.host.prompt(
          String(a[0]),
          typeof a[1] === 'string' ? a[1] : undefined,
        );
      case 'ui.form': {
        if (!c.host.form) return fail('This app cannot show a form.');
        const spec = a[0] as FormSpec;
        if (!spec || !Array.isArray(spec.fields) || spec.fields.length === 0)
          return fail('A form needs a list of fields.');
        for (const f of spec.fields)
          if (
            !f ||
            typeof f.key !== 'string' ||
            typeof f.label !== 'string' ||
            !['text', 'number', 'boolean', 'choice'].includes(f.type)
          )
            return fail(
              'Each form field needs a key, a label and a type: text, number, boolean or choice.',
            );
        return c.host.form({
          ...(typeof spec.title === 'string' ? { title: spec.title } : {}),
          fields: spec.fields,
        });
      }
      case 'ui.progress.start': {
        const handle = c.host.progress?.(String(a[0]));
        const id = nextProgress++;
        if (handle) progresses.set(id, handle);
        return id;
      }
      case 'ui.progress.update':
        progresses
          .get(Number(a[0]))
          ?.update(
            typeof a[1] === 'number' ? Math.min(1, Math.max(0, a[1])) : null,
            typeof a[2] === 'string' ? a[2] : undefined,
          );
        return null;
      case 'ui.progress.end':
        progresses.get(Number(a[0]))?.done();
        progresses.delete(Number(a[0]));
        return null;

      // --- files (asynchronous in the script) and web services
      case 'files.read':
        return filesOf(c)
          .read(pathOf(a[0]))
          .then((t) => cap(t, 'The file'));
      case 'files.write':
        return filesOf(c)
          .write(pathOf(a[0]), cap(text(a[1], 'The text'), 'The text'))
          .then(() => null);
      case 'files.list': {
        const folder = workspacePath(a[0]);
        if (folder === null)
          return fail('A folder must be inside the workspace.');
        return filesOf(c).list(folder);
      }
      case 'files.exists':
        return filesOf(c).exists(pathOf(a[0]));
      case 'files.open': {
        c.require('files');
        if (!c.host.openFile)
          return fail('This app cannot show an open-file dialog.');
        const accept = (a[0] as { accept?: unknown } | null)?.accept;
        return c.host
          .openFile(Array.isArray(accept) ? { accept: accept.map(String) } : {})
          .then((f) =>
            f ? { name: f.name, text: cap(f.text, 'The file') } : null,
          );
      }
      case 'files.save': {
        c.require('files');
        if (!c.host.saveFile)
          return fail('This app cannot show a save-file dialog.');
        return c.host.saveFile(
          text(a[0], 'The file name'),
          cap(text(a[1], 'The text'), 'The text'),
        );
      }
      case 'http.request': {
        const req = request(c, (a[0] ?? {}) as Record<string, unknown>);
        if (!c.http)
          return fail('This app does not give scripts access to web services.');
        return c.http.request(req).then((r) => ({
          status: r.status,
          headers: r.headers,
          text: cap(r.text, 'The answer'),
        }));
      }
      default:
        return fail(`Unknown request "${op}".`);
    }
  };
}
