import {
  effectiveAttributes,
  effectiveRelationAttributes,
  type ConnectorId,
  type ElementId,
  type Model,
  type Kit,
} from '@metakit-app/core';
import type { Clash } from '@metakit-app/sync';

export interface ClashNotice {
  id: number;
  text: string;
}

/**
 * A clash in plain English: who won, what was changed at the same time, and on which object.
 * Only the field's name and the object's name are shown, never paths or ids.
 */
export function describeClash(
  kit: Kit,
  model: Model,
  clash: Clash,
  who: string,
  language = 'en',
): string {
  const [root, id, ...rest] = clash.path;
  let field: string =
    rest.length > 0
      ? rest[rest.length - 1]!
      : (clash.path[clash.path.length - 1] ?? 'a value');
  let on = '';
  try {
    if (root === 'manifest' && id === 'name') field = 'the model name';
    else if (root === 'manifest') field = `the model's ${id ?? 'details'}`;
    else if (root === 'elements' && id) {
      const element = model.elements[id as ElementId];
      if (rest[0] === 'attrs' && rest[1] && element) {
        const attr = effectiveAttributes(kit, element.class).find(
          (a) => a.id === rest[1],
        );
        if (attr)
          field = attr.labels?.[language] ?? attr.labels?.['en'] ?? attr.key;
      } else if (rest[0] === 'x' || rest[0] === 'y') field = 'the position';
      else if (rest[0] === 'w' || rest[0] === 'h') field = 'the size';
      if (element) {
        const name = nameOf(kit, element.class, element.attrs);
        if (name) on = ` of "${name}"`;
      }
    } else if (root === 'connectors' && id) {
      const connector = model.connectors[id as ConnectorId];
      if (rest[0] === 'attrs' && rest[1] && connector) {
        const attr = effectiveRelationAttributes(kit, connector.relation).find(
          (a) => a.id === rest[1],
        );
        if (attr)
          field = attr.labels?.[language] ?? attr.labels?.['en'] ?? attr.key;
      }
    }
  } catch {
    // A broken class chain still gets a notice, with the plainest wording.
  }
  return `${who} changed ${field}${on} at the same time as you. ${who}'s value was kept.`;
}

function nameOf(
  kit: Kit,
  classId: string,
  attrs: Record<string, unknown>,
): string | null {
  const defs = effectiveAttributes(kit, classId as never);
  for (const d of defs) {
    const v = attrs[d.id];
    if (d.type === 'text' && typeof v === 'string' && v !== '') return v;
  }
  return null;
}
