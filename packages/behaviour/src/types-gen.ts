import {
  CANCELLABLE_EVENTS,
  EVENT_NAMES,
  effectiveAttributes,
  effectiveRelationAttributes,
  isA,
  optionValue,
  type AttributeDef,
  type ToolLibrary,
} from '@metakit-app/core';

const EVENT_LIST = EVENT_NAMES.map((e) => `    | ${JSON.stringify(e)}`).join(
  '\n',
);
const CANCELLABLE_LIST = CANCELLABLE_EVENTS.map((e) => JSON.stringify(e)).join(
  ' | ',
);
const str = (s: string): string => JSON.stringify(s);
const union = (items: string[]): string =>
  items.length === 0 ? 'never' : items.map(str).join(' | ');

/** A TypeScript type for the value of one attribute, as a script sees it. */
function typeOf(def: AttributeDef): string {
  switch (def.type) {
    case 'text':
    case 'date':
    case 'date-time':
    case 'duration':
    case 'link':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'choice':
      return def.options.length === 0
        ? 'string'
        : union(def.options.map(optionValue));
    case 'multi-choice':
      return def.options.length === 0
        ? 'string[]'
        : `(${union(def.options.map(optionValue))})[]`;
    case 'formula':
      return def.result === 'number'
        ? 'number'
        : def.result === 'boolean'
          ? 'boolean'
          : def.result === 'text' || def.result === 'date'
            ? 'string'
            : 'string | number | boolean';
    case 'table': {
      const cols = def.columns.map((c) => {
        const t =
          c.type === 'integer' || c.type === 'number'
            ? 'number'
            : c.type === 'boolean'
              ? 'boolean'
              : c.type === 'choice' && (c.options?.length ?? 0) > 0
                ? union((c.options ?? []).map(optionValue))
                : 'string';
        return `${str(c.key)}?: ${t} | null`;
      });
      return `{ ${cols.join('; ')} }[]`;
    }
    case 'reference':
      return 'string[]';
    case 'action':
      return 'never';
  }
}

/** The members of an attribute map: calculated attributes are read-only, buttons are left out. */
function members(defs: AttributeDef[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const def of defs) {
    if (def.type === 'action' || seen.has(def.key)) continue;
    seen.add(def.key);
    const readonly = def.type === 'formula' ? 'readonly ' : '';
    const nullable =
      def.type === 'boolean' ||
      def.type === 'table' ||
      def.type === 'multi-choice' ||
      def.type === 'reference'
        ? ''
        : ' | null';
    lines.push(`    ${readonly}${str(def.key)}: ${typeOf(def)}${nullable};`);
  }
  return lines.join('\n');
}

const sorted = <T extends { key: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.key < b.key ? -1 : 1));

/**
 * The TypeScript declaration of the `metakit` module for one tool library: its class, relation
 * class and attribute names, the type of every attribute value (so that `task.attrs.Priority` is
 * `"Low" | "Medium" | "High" | null`), and the 24 events with the payload and filter each takes.
 * The editor's language service reads it; nothing here runs in a script.
 */
export function generateDeclarations(tool: ToolLibrary): string {
  const classes = sorted(Object.values(tool.classes));
  const relations = sorted(Object.values(tool.relations));
  const modelTypes = sorted(Object.values(tool.modelTypes));

  const classAttrs: string[] = [];
  const family: string[] = [];
  for (const cls of classes) {
    let defs: AttributeDef[] = [];
    try {
      defs = effectiveAttributes(tool, cls.id);
    } catch {
      // A broken class chain still gets a name, with no attributes.
    }
    classAttrs.push(`  ${str(cls.key)}: {\n${members(defs)}\n  };`);
    const kin = classes
      .filter((c) => isA(tool, c.id, cls.id))
      .map((c) => c.key);
    family.push(`  ${str(cls.key)}: ${union(kin)};`);
  }
  const relationAttrs = relations.map((r) => {
    let defs: AttributeDef[] = [];
    try {
      defs = effectiveRelationAttributes(tool, r.id);
    } catch {
      // As above.
    }
    return `  ${str(r.key)}: {\n${members(defs)}\n  };`;
  });
  const modelType = modelTypes[0];
  const attributeKeys = [
    ...new Set(
      [
        ...classes.flatMap((c) => c.attributes),
        ...relations.flatMap((r) => r.attributes),
        ...modelTypes.flatMap((m) => m.attributes),
      ].map((a) => a.key),
    ),
  ].sort();

  return `declare module "metakit" {
  /** Every class of the tool "${tool.manifest.name.replace(/\*\//g, '')}". */
  export type ClassName = ${union(classes.map((c) => c.key))};
  /** The classes you can create objects of. */
  export type ConcreteClassName = ${union(classes.filter((c) => !c.abstract).map((c) => c.key))};
  export type RelationName = ${union(relations.map((r) => r.key))};
  export type ModelTypeName = ${union(modelTypes.map((m) => m.key))};
  export type AttributeKey = ${union(attributeKeys)};

  /** The values of the attributes of each class, with the ones it inherits. An empty value is null. */
  export interface ClassAttributes {
${classAttrs.join('\n')}
  }
  export interface RelationAttributes {
${relationAttrs.join('\n')}
  }
  /** A class and the classes that extend it: \`objects("FlowNode")\` also finds a Task. */
  export interface ClassFamily {
${family.join('\n')}
  }
  export interface ModelAttributes {
${modelType ? members(modelType.attributes) : ''}
  }

  type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;
  type KeysOfUnion<T> = T extends unknown ? keyof T : never;
  type ValueOfUnion<T, K extends PropertyKey> = T extends unknown ? (K extends keyof T ? T[K] : never) : never;
  /**
   * The attributes of one class, exactly. For several classes at once (an object whose class is
   * not known yet) every attribute of any of them, each optional: check \`class\` to narrow it.
   */
  export type AttrsOf<C extends ClassName> = [C] extends [never]
    ? never
    : IsUnion<C> extends true
      ? { [K in KeysOfUnion<ClassAttributes[C]>]?: ValueOfUnion<ClassAttributes[C], K> }
      : ClassAttributes[C];
  export type RelationAttrsOf<R extends RelationName> = [R] extends [never]
    ? never
    : IsUnion<R> extends true
      ? { [K in KeysOfUnion<RelationAttributes[R]>]?: ValueOfUnion<RelationAttributes[R], K> }
      : RelationAttributes[R];

  export interface ModelObject<C extends ClassName = ClassName> {
    readonly id: string;
    /** The class of the object, for example "Task". */
    readonly class: ClassFamily[C];
    x: number;
    y: number;
    w: number;
    h: number;
    /** Read an attribute, or set it with \`task.attrs.Priority = "High"\`. */
    readonly attrs: AttrsOf<C>;
    readonly parent: ModelObject | null;
    children(): ModelObject[];
    incoming(relation?: RelationName): ModelObject[];
    outgoing(relation?: RelationName): ModelObject[];
    connectors(relation?: RelationName): Connector[];
    update(patch: {
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      parent?: ModelObject | string | null;
      attrs?: Partial<{ -readonly [K in keyof AttrsOf<C>]: AttrsOf<C>[K] }>;
    }): void;
    delete(): void;
  }

  export interface Connector<R extends RelationName = RelationName> {
    readonly id: string;
    readonly relation: R;
    readonly from: ModelObject;
    readonly to: ModelObject;
    readonly attrs: RelationAttrsOf<R>;
    update(patch: {
      attrs?: Partial<{ -readonly [K in keyof RelationAttrsOf<R>]: RelationAttrsOf<R>[K] }>;
    }): void;
    delete(): void;
  }

  export const model: {
    /** The objects of a class and its subclasses, or all objects. */
    objects<C extends ClassName = ClassName>(cls?: C): ModelObject<C>[];
    object(id: string): ModelObject | null;
    connectors<R extends RelationName = RelationName>(relation?: R): Connector<R>[];
    /** The objects (and connectors) that are selected now. */
    selection(): (ModelObject | Connector)[];
    create<C extends ConcreteClassName>(
      cls: C,
      options?: {
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        parent?: ModelObject | string;
        attrs?: Partial<{ -readonly [K in keyof ClassAttributes[C]]: ClassAttributes[C][K] }>;
      },
    ): ModelObject<C>;
    connect<R extends RelationName>(
      relation: R,
      from: ModelObject | string,
      to: ModelObject | string,
      attrs?: Partial<{ -readonly [K in keyof RelationAttributes[R]]: RelationAttributes[R][K] }>,
    ): Connector<R>;
    update(target: ModelObject | Connector | string, patch: { x?: number; y?: number; w?: number; h?: number; attrs?: Record<string, unknown> }): void;
    delete(target: ModelObject | Connector | string): void;
    /** The attributes of the model itself. */
    readonly attrs: ModelAttributes;
  };

  export interface AttributeInfo {
    id: string;
    key: string;
    type: string;
    labels?: Record<string, string>;
    options?: string[];
    required?: boolean;
    [more: string]: unknown;
  }
  export interface ClassInfo {
    key: string;
    kind: "node" | "container" | "swimlane";
    labels: Record<string, string>;
    extends: string | null;
    abstract: boolean;
    /** Including the attributes inherited from parent classes. */
    attributes: AttributeInfo[];
  }
  export interface RelationInfo {
    key: string;
    labels: Record<string, string>;
    extends: string | null;
    abstract: boolean;
    from: string[];
    to: string[];
    attributes: AttributeInfo[];
  }
  export interface ModelTypeInfo {
    key: string;
    labels: Record<string, string>;
    classes: string[];
    relations: string[];
    views: { key: string; labels: Record<string, string>; classes: string[]; relations: string[] }[];
    attributes: AttributeInfo[];
  }

  /** The meta-model of the tool: read-only. */
  export const tool: {
    readonly name: string;
    readonly version: string;
    classes(): ClassInfo[];
    class(key: ClassName): ClassInfo;
    relations(): RelationInfo[];
    relation(key: RelationName): RelationInfo;
    modelTypes(): ModelTypeInfo[];
    modelType(key: ModelTypeName): ModelTypeInfo;
    attribute(owner: ClassName | RelationName | ModelTypeName, key: AttributeKey): AttributeInfo | null;
  };

  export interface FormField {
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "choice";
    options?: string[];
    default?: string | number | boolean | null;
    required?: boolean;
    multiline?: boolean;
  }
  export interface Progress {
    /** \`fraction\` is 0 to 1. */
    update(fraction: number | null, text?: string): void;
  }
  export const ui: {
    message(text: string, kind?: "info" | "warning" | "error"): void;
    warn(text: string): void;
    error(text: string): void;
    confirm(text: string): boolean;
    prompt(text: string, initial?: string): string | null;
    choose<T extends string>(text: string, options: readonly T[]): T | null;
    /** Shows a form; null when the person cancels. */
    form(fields: FormField[], title?: string): Record<string, string | number | boolean | null> | null;
    progress<T>(label: string, work: (progress: Progress) => T): T;
  };

  /** Needs the "files" permission of the tool. Paths are inside the workspace folder. */
  export const files: {
    read(path: string): Promise<string>;
    write(path: string, text: string): Promise<void>;
    list(folder?: string): Promise<string[]>;
    exists(path: string): Promise<boolean>;
    /** The "open file" dialog; null when the person cancels. */
    open(options?: { accept?: string[] }): Promise<{ name: string; text: string } | null>;
    /** The "save as" dialog; false when the person cancels. */
    save(name: string, text: string): Promise<boolean>;
  };

  export interface HttpResponse {
    readonly status: number;
    readonly ok: boolean;
    readonly headers: Record<string, string>;
    text(): string;
    json(): unknown;
  }
  export interface HttpOptions {
    headers?: Record<string, string>;
  }
  /** Needs the "network" permission of the tool. Only web services that accept requests from web pages answer. */
  export const http: {
    get(url: string, options?: HttpOptions): Promise<HttpResponse>;
    post(url: string, body?: unknown, options?: HttpOptions): Promise<HttpResponse>;
    put(url: string, body?: unknown, options?: HttpOptions): Promise<HttpResponse>;
    delete(url: string, options?: HttpOptions): Promise<HttpResponse>;
    /** Gets an address and reads the answer as JSON; fails when the status is not a success. */
    json<T = unknown>(url: string, options?: HttpOptions): Promise<T>;
  };

  export const commands: {
    register(command: {
      /** Letters, digits, dots and dashes. */
      id: string;
      label: string;
      /** Puts the command in the model menu; the text names the menu. */
      menu?: string | boolean;
      toolbar?: boolean;
      context?: boolean;
      run: (target: ModelObject | Connector | null) => void | Promise<void>;
    }): void;
  };

  export type EventName =
${EVENT_LIST};

  /** What every event tells a handler. */
  export interface EventBase<E extends EventName> {
    readonly event: E;
    /** The id of the object or connector, or null. */
    readonly target: string | null;
    readonly user: string;
  }
  export interface ObjectEvent<E extends EventName> extends EventBase<E> {
    readonly class?: ClassName;
    /** The object, unless it was deleted. */
    readonly object: ModelObject | null;
  }
  export interface ConnectorEvent<E extends EventName> extends EventBase<E> {
    readonly relation?: RelationName;
    readonly from?: string;
    readonly to?: string;
    readonly connector: Connector | null;
  }
  export interface AttributeEvent<E extends EventName> extends EventBase<E> {
    readonly class?: ClassName;
    readonly relation?: RelationName;
    readonly attribute: AttributeKey;
    readonly old: unknown;
    readonly new: unknown;
    /** For table events: the index of the row. */
    readonly row?: number;
    readonly object?: ModelObject | null;
    readonly connector?: Connector | null;
  }

  export interface EventPayloads {
    "app.started": EventBase<"app.started">;
    "app.closing": EventBase<"app.closing">;
    "model.creating": EventBase<"model.creating">;
    "model.created": EventBase<"model.created">;
    "model.opened": EventBase<"model.opened">;
    "model.deleting": EventBase<"model.deleting">;
    "model.deleted": EventBase<"model.deleted">;
    "object.creating": ObjectEvent<"object.creating"> & { readonly new: { x: number; y: number } };
    "object.created": ObjectEvent<"object.created">;
    "object.deleting": ObjectEvent<"object.deleting">;
    "object.deleted": ObjectEvent<"object.deleted">;
    "object.moved": ObjectEvent<"object.moved"> & { readonly old: { x: number; y: number }; readonly new: { x: number; y: number } };
    "object.resized": ObjectEvent<"object.resized"> & { readonly old: { w: number; h: number }; readonly new: { w: number; h: number } };
    "object.renamed": AttributeEvent<"object.renamed">;
    "connector.creating": ConnectorEvent<"connector.creating">;
    "connector.created": ConnectorEvent<"connector.created">;
    "connector.reconnected": ConnectorEvent<"connector.reconnected"> & { readonly end: "from" | "to"; readonly old: string | null; readonly new: string | null };
    "attribute.changing": AttributeEvent<"attribute.changing">;
    "attribute.changed": AttributeEvent<"attribute.changed">;
    "table.rowAdded": AttributeEvent<"table.rowAdded">;
    "table.rowRemoved": AttributeEvent<"table.rowRemoved">;
    "view.changing": EventBase<"view.changing"> & { readonly view: string | null };
    "view.changed": EventBase<"view.changed"> & { readonly view: string | null };
    "selection.changed": EventBase<"selection.changed"> & { readonly selection: string[] };
  }

  /** Which events can be limited to a class, an attribute or a relation class. */
  export interface EventFilters {
    "object.creating": { class?: ClassName };
    "object.created": { class?: ClassName };
    "object.deleting": { class?: ClassName };
    "object.deleted": { class?: ClassName };
    "object.moved": { class?: ClassName };
    "object.resized": { class?: ClassName };
    "object.renamed": { class?: ClassName };
    "connector.creating": { relation?: RelationName };
    "connector.created": { relation?: RelationName };
    "connector.reconnected": { relation?: RelationName };
    "attribute.changing": { class?: ClassName; relation?: RelationName; attribute?: AttributeKey };
    "attribute.changed": { class?: ClassName; relation?: RelationName; attribute?: AttributeKey };
    "table.rowAdded": { class?: ClassName; relation?: RelationName; attribute?: AttributeKey };
    "table.rowRemoved": { class?: ClassName; relation?: RelationName; attribute?: AttributeKey };
  }

  /** What a handler of an event that can be cancelled may return. */
  export type CancelResult = void | false | { cancel: string };
  export type CancellableEvent = ${CANCELLABLE_LIST};
  export type HandlerResult<E extends EventName> = E extends CancellableEvent ? CancelResult : void | Promise<void>;

  export function on<E extends EventName>(
    event: E,
    handler: (payload: EventPayloads[E]) => HandlerResult<E>,
  ): void;
  export function on<E extends keyof EventFilters>(
    event: E,
    filter: EventFilters[E],
    handler: (payload: EventPayloads[E]) => HandlerResult<E>,
  ): void;

  /** Stops the action that a "before" event announces: \`return cancel("Reason")\`. */
  export function cancel(reason?: string): { cancel: string };
}
`;
}
