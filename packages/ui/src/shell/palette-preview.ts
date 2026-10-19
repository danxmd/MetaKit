import {
  classChain,
  relationChain,
  describeRelationEnds,
  effectiveAttributes,
  effectiveRelationAttributes,
  type AttributeDef,
  type ClassDef,
  type ModelTypeDef,
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
  /** Relations only: the concrete classes allowed at each end, by label. */
  ends: { from: string[]; to: string[] } | null;
  /** Relations only: "Connects an Agent or a Human to a Task." */
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

/**
 * The card for a relation class: its attributes and which classes it joins, named as the concrete
 * classes a modeller can place (and only those of the model type, when it is given).
 */
export function previewOfRelation(
  kit: Kit,
  rel: RelationDef,
  language = 'en',
  modelType?: ModelTypeDef,
): PreviewInfo {
  let defs: AttributeDef[] = rel.attributes;
  try {
    defs = effectiveRelationAttributes(kit, rel.id);
  } catch {
    // See previewOfClass.
  }
  const ends = describeRelationEnds(kit, rel, {
    language,
    ...(modelType ? { modelType } : {}),
  });
  return {
    kind: 'relation',
    kindLabel: 'Relation',
    title: labelOf(rel, language),
    key: rel.key,
    help:
      helpOf(rel.help, language) ??
      inheritedHelp(() => relationChain(kit, rel.id), language),
    ...attributesOf(defs, language),
    ends: { from: ends.from, to: ends.to },
    sentence: ends.sentence,
  };
}
