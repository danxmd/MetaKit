import type { ConnectorId, ElementId } from '../ids';
import type { Json } from '../json';
import {
  effectiveAttributes,
  effectiveRelationAttributes,
  isA,
} from '../meta/inherit';
import type { AttributeDef, Kit } from '../meta/types';
import type { ModelCommand } from '../model/commands';
import type { ModelStore } from '../model/commands';
import type { Model } from '../model/types';
import type { Patch } from '../store/tx';
import { EventBus, type EventPayload } from './bus';

export interface BridgeOptions {
  /** The Kit the model follows; read on every event so that edits to it are seen. */
  kit: () => Kit;
}

function attrDefs(kit: Kit, model: Model, target: string): AttributeDef[] {
  try {
    if (target === 'model')
      return kit.modelTypes[model.manifest.modelType]?.attributes ?? [];
    const el = model.elements[target as ElementId];
    if (el) return effectiveAttributes(kit, el.class);
    const cn = model.connectors[target as ConnectorId];
    if (cn) return effectiveRelationAttributes(kit, cn.relation);
  } catch {
    // A broken class chain has no attributes to report.
  }
  return [];
}

const rowCount = (v: Json | undefined): number =>
  Array.isArray(v) ? v.length : 0;

/**
 * Turns the commands of a model store into events: object, connector, attribute and table events,
 * before (which can cancel) and after. The store calls its handlers only for commands run here,
 * never for changes merged from other instances, so nothing fires twice (ADR 0005).
 * Returns the function that detaches the bridge.
 */
export function attachEvents(
  store: ModelStore,
  bus: EventBus,
  options: BridgeOptions,
): () => void {
  const stops: (() => void)[] = [];
  const target = (m: Model, id: string) => ({
    ...(m.elements[id as ElementId]
      ? { class: m.elements[id as ElementId]!.class }
      : {}),
    ...(m.connectors[id as ConnectorId]
      ? { relation: m.connectors[id as ConnectorId]!.relation }
      : {}),
  });
  const base = (
    event: EventPayload['event'],
    t: string | null,
    user: string,
    extra: Partial<EventPayload> = {},
  ): EventPayload => ({
    event,
    target: t,
    user,
    ...extra,
  });
  const cancelOf = (r: ReturnType<EventBus['emit']>) =>
    r.cancelled ? { cancel: r.reason } : undefined;
  const created = (
    patches: readonly Patch[],
    root: 'elements' | 'connectors',
  ): string | undefined =>
    patches.find(
      (p) =>
        p.path.length === 2 && p.path[0] === root && p.before === undefined,
    )?.path[1];

  stops.push(
    store.before('createElement', ({ command, user, state }) => {
      const c = command as Extract<ModelCommand, { type: 'createElement' }>;
      return cancelOf(
        bus.emit(
          base('object.creating', null, user, {
            class: c.class,
            new: { x: c.x, y: c.y },
          }),
          state,
        ),
      );
    }),
    store.after('createElement', ({ patches, state, user }) => {
      const id = created(patches, 'elements');
      if (id)
        bus.emit(
          base('object.created', id, user, target(state as Model, id)),
          state,
        );
    }),
    store.before('createConnector', ({ command, user, state }) => {
      const c = command as Extract<ModelCommand, { type: 'createConnector' }>;
      return cancelOf(
        bus.emit(
          base('connector.creating', null, user, {
            relation: c.relation,
            from: c.from,
            to: c.to,
          }),
          state,
        ),
      );
    }),
    store.after('createConnector', ({ command, patches, state, user }) => {
      const id = created(patches, 'connectors');
      const c = command as Extract<ModelCommand, { type: 'createConnector' }>;
      if (id)
        bus.emit(
          base('connector.created', id, user, {
            relation: c.relation,
            from: c.from,
            to: c.to,
          }),
          state,
        );
    }),
    store.before('delete', ({ command, state, user }) => {
      const id = (command as Extract<ModelCommand, { type: 'delete' }>).id;
      const m = state as Model;
      // Only objects have delete events; deleting a connector is a plain change.
      if (!m.elements[id as ElementId]) return undefined;
      return cancelOf(
        bus.emit(base('object.deleting', id, user, target(m, id)), state),
      );
    }),
    store.after('delete', ({ command, patches, user, state }) => {
      const id = (command as Extract<ModelCommand, { type: 'delete' }>).id;
      const gone = patches.find(
        (p) =>
          p.path.length === 2 && p.path[0] === 'elements' && p.path[1] === id,
      );
      if (!gone) return;
      const was = gone.before as { class?: string } | undefined;
      bus.emit(
        base(
          'object.deleted',
          id,
          user,
          was?.class ? { class: was.class as never } : {},
        ),
        state,
      );
    }),
    store.after('move', ({ command, patches, state, user }) => {
      const id = (command as Extract<ModelCommand, { type: 'move' }>).id;
      const x = patches.find((p) => p.path[1] === id && p.path[2] === 'x');
      const y = patches.find((p) => p.path[1] === id && p.path[2] === 'y');
      if (!x && !y) return;
      const m = state as Model;
      const e = m.elements[id];
      bus.emit(
        base('object.moved', id, user, {
          ...target(m, id),
          old: {
            x: (x?.before as number | undefined) ?? e?.x ?? 0,
            y: (y?.before as number | undefined) ?? e?.y ?? 0,
          },
          new: { x: e?.x ?? 0, y: e?.y ?? 0 },
        }),
        state,
      );
    }),
    store.after('resize', ({ command, patches, state, user }) => {
      const id = (command as Extract<ModelCommand, { type: 'resize' }>).id;
      const w = patches.find((p) => p.path[1] === id && p.path[2] === 'w');
      const h = patches.find((p) => p.path[1] === id && p.path[2] === 'h');
      if (!w && !h) return;
      const m = state as Model;
      const e = m.elements[id];
      bus.emit(
        base('object.resized', id, user, {
          ...target(m, id),
          old: {
            w: (w?.before as number | undefined) ?? e?.w ?? 0,
            h: (h?.before as number | undefined) ?? e?.h ?? 0,
          },
          new: { w: e?.w ?? 0, h: e?.h ?? 0 },
        }),
        state,
      );
    }),
    store.after('reconnect', ({ command, patches, state, user }) => {
      const c = command as Extract<ModelCommand, { type: 'reconnect' }>;
      const m = state as Model;
      for (const end of ['from', 'to'] as const) {
        const p = patches.find((q) => q.path[1] === c.id && q.path[2] === end);
        if (!p) continue;
        bus.emit(
          base('connector.reconnected', c.id, user, {
            ...target(m, c.id),
            end,
            old: (p.before as string | undefined) ?? null,
            new: (p.after as string | undefined) ?? null,
          }),
          state,
        );
      }
    }),
    store.before('setAttribute', ({ command, state, user }) => {
      const c = command as Extract<ModelCommand, { type: 'setAttribute' }>;
      const m = state as Model;
      const def = attrDefs(options.kit(), m, c.target).find(
        (a) => a.id === c.attr,
      );
      const data =
        c.target === 'model'
          ? m.attrs
          : (
              m.elements[c.target as ElementId] ??
              m.connectors[c.target as ConnectorId]
            )?.attrs;
      return cancelOf(
        bus.emit(
          base('attribute.changing', c.target, user, {
            ...target(m, c.target),
            attribute: def?.key ?? c.attr,
            old: data?.[c.attr] ?? null,
            new: c.value,
          }),
          state,
        ),
      );
    }),
    store.after('setAttribute', ({ command, patches, state, user }) => {
      const c = command as Extract<ModelCommand, { type: 'setAttribute' }>;
      const m = state as Model;
      const p = patches.find((q) => q.path.at(-1) === c.attr);
      if (!p) return;
      const kit = options.kit();
      const defs = attrDefs(kit, m, c.target);
      const def = defs.find((a) => a.id === c.attr);
      const payload = {
        ...target(m, c.target),
        attribute: def?.key ?? c.attr,
        old: (p.before as Json | undefined) ?? null,
        new: (p.after as Json | undefined) ?? null,
      };
      bus.emit(base('attribute.changed', c.target, user, payload), state);
      if (def?.type === 'table') {
        const before = rowCount(p.before);
        const after = rowCount(p.after);
        for (let row = before; row < after; row++)
          bus.emit(
            base('table.rowAdded', c.target, user, { ...payload, row }),
            state,
          );
        for (let row = after; row < before; row++)
          bus.emit(
            base('table.rowRemoved', c.target, user, { ...payload, row }),
            state,
          );
      }
      // A rename is a change of the attribute that gives the object its label: the first text attribute.
      if (
        def &&
        def.type === 'text' &&
        defs.find((a) => a.type === 'text')?.id === def.id &&
        c.target !== 'model' &&
        m.elements[c.target as ElementId]
      )
        bus.emit(base('object.renamed', c.target, user, payload), state);
    }),
  );
  void isA;
  return () => stops.forEach((s) => s());
}
