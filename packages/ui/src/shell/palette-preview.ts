import {
  classChain,
  relationChain,
  effectiveAttributes,
  effectiveEnds,
  effectiveRelationAttributes,
  type AttributeDef,
  type ClassDef,
  type RelationDef,
  type Kit,
} from '@metakit-app/core';
import { labelOf } from './palette';

export type PreviewKind = 'object' | 'container' | 'relation';

export interface PreviewAttribute {
  key: string;
  label: string;
  /** The type in plain words, for example "text" or "yes / no". */
  type: string;
  required: boolean;
}

/** What the preview card says about a class or a relation class. */
export interface PreviewInfo {
  kind: PreviewKind;
  /** "Object", "Container", "Swimlane" or "Relation". */
  kindLabel: string;
  title: string;
  key: string;
  help: string | null;
  /** The first attributes; `moreAttributes` counts the rest. */
  attributes: PreviewAttribute[];
  moreAttributes: number;
  /** Relations only: the classes allowed at each end, by label. */
  ends: { from: string[]; to: string[] } | null;
  /** Relations only: "Performs: from Actor to Task". */
  sentence: string | null;
}

/** How many attributes the card lists before saying "and N more". */
export const PREVIEW_ATTRIBUTE_LIMIT = 8;

const TYPE_WORDS: Record<AttributeDef['type'], string> = {
  text: 'text',
  integer: 'whole number',
  number: 'number',
  boolean: 'yes / no',
  date: 'date',
  'date-time': 'date and time',
  duration: 'duration',
  choice: 'choice',
  'multi-choice': 'several choices',
  formula: 'calculated',
  table: 'table',
  reference: 'reference',
  action: 'button',
  link: 'link',
};

export const typeWord = (type: AttributeDef['type']): string =>
  TYPE_WORDS[type] ?? type;

function attributesOf(
  defs: AttributeDef[],
  language: string,
): Pick<PreviewInfo, 'attributes' | 'moreAttributes'> {
  const all = defs.map((a) => ({
    key: a.key,
    label: labelOf(a, language),
    type: typeWord(a.type),
    required: a.required === true,
  }));
  return {
    attributes: all.slice(0, PREVIEW_ATTRIBUTE_LIMIT),
    moreAttributes: Math.max(0, all.length - PREVIEW_ATTRIBUTE_LIMIT),
  };
}

function helpOf(
  help: Record<string, string> | undefined,
  language: string,
): string | null {
  const text = (help?.[language] ?? help?.en ?? '').trim();
  return text === '' ? null : text;
}

/** The help of the class, or of the nearest ancestor that has any. */
function inheritedHelp(
  chain: () => { help?: Record<string, string> | undefined }[],
  language: string,
): string | null {
  try {
    for (const def of chain().reverse()) {
      const text = helpOf(def.help, language);
      if (text) return text;
    }
  } catch {
    // A broken chain is reported in Build mode.
  }
  return null;
}

/** The card for a class in the palette. Attributes include the inherited ones. */
export function previewOfClass(
  kit: Kit,
  cls: ClassDef,
  language = 'en',
): PreviewInfo {
  let defs: AttributeDef[] = cls.attributes;
  try {
    defs = effectiveAttributes(kit, cls.id);
  } catch {
    // A broken inheritance chain is reported in Build mode; the class's own attributes will do here.
  }
  return {
    kind: cls.kind === 'node' ? 'object' : 'container',
    kindLabel:
      cls.kind === 'swimlane'
        ? 'Swimlane'
        : cls.kind === 'container'
          ? 'Container'
          : 'Object',
    title: labelOf(cls, language),
    key: cls.key,
    help:
      helpOf(cls.help, language) ??
      inheritedHelp(() => classChain(kit, cls.id), language),
    ...attributesOf(defs, language),
    ends: null,
    sentence: null,
  };
}

/** The card for a relation class: its attributes and which classes it joins. */
export function previewOfRelation(
  kit: Kit,
  rel: RelationDef,
  language = 'en',
): PreviewInfo {
  let defs: AttributeDef[] = rel.attributes;
  let ends = { from: rel.from, to: rel.to };
  try {
    defs = effectiveRelationAttributes(kit, rel.id);
    ends = effectiveEnds(kit, rel.id);
  } catch {
    // See previewOfClass.
  }
  const names = (ids: string[]) =>
    ids.map((id) => {
      const c = kit.classes[id as keyof typeof kit.classes];
      return c ? labelOf(c, language) : id;
    });
  const from = names(ends.from);
  const to = names(ends.to);
  const list = (items: string[]) =>
    items.length === 0 ? 'any object' : items.join(' or ');
  const title = labelOf(rel, language);
  return {
    kind: 'relation',
    kindLabel: 'Relation',
    title,
    key: rel.key,
    help:
      helpOf(rel.help, language) ??
      inheritedHelp(() => relationChain(kit, rel.id), language),
    ...attributesOf(defs, language),
    ends: { from, to },
    sentence: `${title}: from ${list(from)} to ${list(to)}`,
  };
}
