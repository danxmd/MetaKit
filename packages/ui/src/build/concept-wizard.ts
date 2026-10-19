import {
  keyProblem,
  newId,
  validateKit,
  createKitStore,
  type AttributeDef,
  type ClassDef,
  type ClassId,
  type Kit,
  type KitCommand,
  type LookBase,
  type MarkerType,
  type ModelTypeId,
  type RelationDef,
  type RelationId,
} from '@metakit-app/core';
import {
  defaultNodeLook,
  defaultRelationLook,
  nodeShapeFromLook,
  relationShapeFromLook,
} from '@metakit-app/shapes';
import { labelIn } from './attributes';
import { shapeNameFor } from './appearance-model';

/**
 * The step-by-step wizard for a new class or relation class (issue #48): what it asks, what it
 * checks at each step, and the one batch of Kit commands it ends with. No DOM, so it is tested on
 * its own; `ConceptWizard.svelte` only shows it. Build mode and the model view run the same batch
 * (ADR 0014), so a class made here is the same as one made in Build mode.
 */

export type ConceptKind = 'class' | 'relation';

export type WizardStep =
  'basics' | 'look' | 'connects' | 'attributes' | 'where';

export const STEPS: Record<ConceptKind, readonly WizardStep[]> = {
  class: ['basics', 'look', 'attributes', 'where'],
  relation: ['basics', 'connects', 'attributes', 'where'],
};

export const STEP_TITLES: Record<WizardStep, string> = {
  basics: 'Name',
  look: 'Look',
  connects: 'Connects',
  attributes: 'Attributes',
  where: 'Where and check',
};

/** The attribute types the wizard offers; Build mode has the rest. */
export type WizardAttributeType =
  'text' | 'long' | 'integer' | 'number' | 'boolean' | 'date' | 'choice';

export const WIZARD_ATTRIBUTE_TYPES: readonly {
  type: WizardAttributeType;
  label: string;
}[] = [
  { type: 'text', label: 'Text' },
  { type: 'long', label: 'Long text' },
  { type: 'integer', label: 'Whole number' },
  { type: 'number', label: 'Number' },
  { type: 'boolean', label: 'Yes or no' },
  { type: 'date', label: 'Date' },
  { type: 'choice', label: 'Choice from a list' },
];

export interface WizardAttribute {
  label: string;
  type: WizardAttributeType;
  /** For a choice: one option per line. */
  options: string;
  required: boolean;
}

/** The forms the wizard offers for a class; Build mode's appearance editor has every option. */
export const WIZARD_BASES: readonly { base: LookBase; label: string }[] = [
  { base: 'rounded', label: 'Rounded box' },
  { base: 'box', label: 'Box' },
  { base: 'pill', label: 'Pill' },
  { base: 'circle', label: 'Circle' },
  { base: 'diamond', label: 'Diamond' },
  { base: 'hexagon', label: 'Hexagon' },
  { base: 'document', label: 'Document' },
  { base: 'person', label: 'Person' },
  { base: 'header-box', label: 'Box with fields' },
];

export interface WizardDraft {
  kind: ConceptKind;
  label: string;
  /** The key used in formulas; made from the label until the person changes it. */
  key: string;
  keyEdited: boolean;
  help: string;
  // A class.
  classKind: ClassDef['kind'];
  parent: ClassId | '';
  abstract: boolean;
  base: LookBase;
  fill: string;
  border: string;
  // A relation class.
  from: ClassId[];
  to: ClassId[];
  lineStyle: 'solid' | 'dashed' | 'dotted';
  end: MarkerType;
  colour: string;
  // Both.
  attributes: WizardAttribute[];
  modelTypes: ModelTypeId[];
}

/** "Assigned to" becomes `AssignedTo`; a key that is taken gets 2, 3... */
export function keyFromLabel(label: string, taken: Iterable<string>): string {
  const words = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let key = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join('');
  if (key === '') key = 'Item';
  if (!/^[A-Za-z_]/.test(key)) key = `_${key}`;
  const used = new Set(taken);
  if (!used.has(key)) return key;
  for (let i = 2; ; i++) if (!used.has(`${key}${i}`)) return `${key}${i}`;
}

const classKeys = (kit: Kit) => Object.values(kit.classes).map((c) => c.key);
const relationKeys = (kit: Kit) =>
  Object.values(kit.relations).map((r) => r.key);
const takenKeys = (kit: Kit, kind: ConceptKind) =>
  kind === 'class' ? classKeys(kit) : relationKeys(kit);

/**
 * A new draft. In the model view the current model type is ticked; in Build mode every model
 * type is, because a new class is usually meant for all of them.
 */
export function emptyDraft(
  kit: Kit,
  kind: ConceptKind,
  options: { modelType?: ModelTypeId } = {},
): WizardDraft {
  const look = defaultNodeLook('node');
  const line = defaultRelationLook();
  const modelTypes = options.modelType
    ? [options.modelType]
    : (Object.keys(kit.modelTypes) as ModelTypeId[]);
  return {
    kind,
    label: '',
    key: '',
    keyEdited: false,
    help: '',
    classKind: 'node',
    parent: '',
    abstract: false,
    base: look.base,
    fill: look.fill as string,
    border: look.border as string,
    from: [],
    to: [],
    lineStyle: line.style,
    end: line.end,
    colour: line.colour as string,
    attributes:
      kind === 'class'
        ? [{ label: 'Name', type: 'text', options: '', required: true }]
        : [],
    modelTypes,
  };
}

/** The draft with a new label; the key follows the label until it was changed by hand. */
export function withLabel(
  kit: Kit,
  draft: WizardDraft,
  label: string,
): WizardDraft {
  return draft.keyEdited
    ? { ...draft, label }
    : {
        ...draft,
        label,
        key:
          label.trim() === ''
            ? ''
            : keyFromLabel(label, takenKeys(kit, draft.kind)),
      };
}

/** A draft of the other kind keeps the name, the description and the attributes. */
export function withKind(
  kit: Kit,
  draft: WizardDraft,
  kind: ConceptKind,
): WizardDraft {
  if (kind === draft.kind) return draft;
  const next = {
    ...emptyDraft(kit, kind),
    modelTypes: draft.modelTypes,
    help: draft.help,
  };
  return withLabel(
    kit,
    { ...next, keyEdited: draft.keyEdited, key: draft.key },
    draft.label,
  );
}

/** Attribute keys, as the class would have them. */
export function attributeKeys(draft: WizardDraft): string[] {
  const taken: string[] = [];
  for (const a of draft.attributes) taken.push(keyFromLabel(a.label, taken));
  return taken;
}

const optionsOf = (a: WizardAttribute) =>
  a.options
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);

/** What stops the person going on from this step, in plain English. Empty when nothing does. */
export function stepProblems(
  kit: Kit,
  draft: WizardDraft,
  step: WizardStep,
): string[] {
  const problems: string[] = [];
  const noun = draft.kind === 'class' ? 'class' : 'relation class';
  if (step === 'basics') {
    if (draft.label.trim() === '') problems.push(`Give the ${noun} a name.`);
    const keyIssue = draft.key === '' ? null : keyProblem(draft.key);
    if (draft.label.trim() !== '' && draft.key === '')
      problems.push('Give it a key.');
    if (keyIssue) problems.push(keyIssue);
    else if (draft.key !== '' && takenKeys(kit, draft.kind).includes(draft.key))
      problems.push(
        `Another ${noun} already has the key "${draft.key}". Choose another key.`,
      );
  }
  if (step === 'connects') {
    if (draft.from.length === 0)
      problems.push('Tick at least one class where a connection may start.');
    if (draft.to.length === 0)
      problems.push('Tick at least one class where a connection may end.');
  }
  if (step === 'attributes') {
    const keys = attributeKeys(draft);
    draft.attributes.forEach((a, i) => {
      const n = i + 1;
      if (a.label.trim() === '') problems.push(`Attribute ${n} has no name.`);
      if (a.type === 'choice' && optionsOf(a).length < 2)
        problems.push(
          `"${a.label || `Attribute ${n}`}" is a choice: write at least two options, one per line.`,
        );
      if (keyProblem(keys[i]!))
        problems.push(`"${a.label}": ${keyProblem(keys[i]!)}`);
    });
    // A parent's attributes are inherited, so a child cannot have one with the same key.
    if (draft.kind === 'class' && draft.parent) {
      const inherited = new Set(inheritedKeys(kit, draft.parent));
      for (const [i, key] of keys.entries())
        if (inherited.has(key))
          problems.push(
            `"${draft.attributes[i]!.label}" is already inherited from ${labelOfClass(kit, draft.parent)}. Leave it out or give it another name.`,
          );
    }
  }
  if (step === 'where') problems.push(...finalProblems(kit, draft));
  return problems;
}

/** Every attribute key a class has through its parents. */
function inheritedKeys(kit: Kit, id: ClassId): string[] {
  const keys: string[] = [];
  for (
    let c = kit.classes[id];
    c;
    c = c.extends ? kit.classes[c.extends] : undefined
  )
    keys.push(...c.attributes.map((a) => a.key));
  return keys;
}

export function labelOfClass(kit: Kit, id: string, language = 'en'): string {
  const c = kit.classes[id as ClassId];
  return c ? labelIn(c.labels, language, c.key) : id;
}

/** Problems of the earlier steps, and anything the whole Kit check finds in the result. */
function finalProblems(kit: Kit, draft: WizardDraft): string[] {
  const earlier: WizardStep[] = STEPS[draft.kind].filter((s) => s !== 'where');
  const problems = earlier.flatMap((s) => stepProblems(kit, draft, s));
  if (problems.length > 0) return problems;
  const { commands } = wizardCommands(kit, draft);
  // Only problems the new class brings count: a Kit that already had some is not blocked.
  const before = new Set(validateKit(kit).map((i) => `${i.path} ${i.message}`));
  try {
    // A JSON copy: the Kit the views hold may be a reactive proxy, which structuredClone refuses.
    const store = createKitStore(JSON.parse(JSON.stringify(kit)) as Kit);
    store.execute({ type: 'batch', commands });
    return validateKit(store.state)
      .filter((i) => !before.has(`${i.path} ${i.message}`))
      .map((i) => i.message);
  } catch (error) {
    return [(error as Error).message];
  }
}

function attributeDef(
  a: WizardAttribute,
  key: string,
  language: string,
): AttributeDef {
  const base = {
    id: newId('attribute'),
    key,
    labels: { [language]: a.label.trim() },
    ...(a.required ? { required: true } : {}),
  };
  switch (a.type) {
    case 'long':
      return { ...base, type: 'text', multiline: true };
    case 'choice':
      return { ...base, type: 'choice', options: optionsOf(a) };
    default:
      return { ...base, type: a.type } as AttributeDef;
  }
}

/**
 * The batch that makes the class or relation class: its shape, the definition, and the model
 * types it is added to. One batch, so it is one undo step.
 */
export function wizardCommands(
  kit: Kit,
  draft: WizardDraft,
  language = kit.manifest.languages[0] ?? 'en',
): { commands: KitCommand[]; id: ClassId | RelationId } {
  const labels = { [language]: draft.label.trim() };
  const help = draft.help.trim()
    ? { help: { [language]: draft.help.trim() } }
    : {};
  const keys = attributeKeys(draft);
  const attributes = draft.attributes.map((a, i) =>
    attributeDef(a, keys[i]!, language),
  );
  const commands: KitCommand[] = [];
  let id: ClassId | RelationId;
  if (draft.kind === 'class') {
    const classId = newId('class');
    id = classId;
    const look = {
      ...defaultNodeLook(
        draft.classKind,
        draft.classKind === 'node' ? draft.base : undefined,
      ),
    };
    if (draft.classKind === 'node') {
      look.fill = draft.fill;
      look.border = draft.border;
    }
    // A class with a Name shows it as its title, as the built-in Kits do.
    const hasName =
      keys.includes('Name') ||
      inheritedKeys(kit, draft.parent as ClassId).includes('Name');
    if (hasName) look.title = { attribute: 'Name', bold: true };
    if (look.base === 'header-box') {
      const fields = keys.filter((k) => k !== 'Name').slice(0, 3);
      if (fields.length > 0) look.fields = fields;
    }
    const shape = nodeShapeFromLook(
      look,
      newId('shape'),
      shapeNameFor(draft.key),
    );
    const def: ClassDef = {
      id: classId,
      key: draft.key,
      kind: draft.classKind,
      labels,
      ...help,
      attributes,
      shape: shape.id,
      ...(draft.parent ? { extends: draft.parent } : {}),
      ...(draft.abstract ? { abstract: true } : {}),
    };
    commands.push({ type: 'putShape', def: shape }, { type: 'putClass', def });
  } else {
    const relationId = newId('relation');
    id = relationId;
    const shape = relationShapeFromLook(
      {
        ...defaultRelationLook(),
        style: draft.lineStyle,
        end: draft.end,
        colour: draft.colour,
      },
      newId('shape'),
      shapeNameFor(draft.key),
    );
    const def: RelationDef = {
      id: relationId,
      key: draft.key,
      labels,
      ...help,
      from: [...draft.from],
      to: [...draft.to],
      attributes,
      shape: shape.id,
    };
    commands.push(
      { type: 'putShape', def: shape },
      { type: 'putRelation', def },
    );
  }
  // An abstract class is never placed, so model types do not list it.
  if (!(draft.kind === 'class' && draft.abstract))
    for (const mtId of draft.modelTypes) {
      const mt = kit.modelTypes[mtId];
      if (!mt) continue;
      commands.push({
        type: 'putModelType',
        def:
          draft.kind === 'class'
            ? { ...mt, classes: [...mt.classes, id as ClassId] }
            : { ...mt, relations: [...mt.relations, id as RelationId] },
      });
    }
  return { commands, id };
}

/** The lines of the last step: what will be made, in plain English. */
export function summary(
  kit: Kit,
  draft: WizardDraft,
  language = 'en',
): string[] {
  const lines: string[] = [];
  const keys = attributeKeys(draft);
  const name = draft.label.trim() || '(no name)';
  const list = (ids: string[]) =>
    ids.map((id) => labelOfClass(kit, id, language)).join(', ') || 'nothing';
  if (draft.kind === 'class') {
    const kindText =
      draft.classKind === 'container'
        ? 'a container'
        : draft.classKind === 'swimlane'
          ? 'a swimlane'
          : 'an object';
    lines.push(`A class "${name}" (key ${draft.key}), drawn as ${kindText}.`);
    if (draft.parent)
      lines.push(
        `It is a kind of ${labelOfClass(kit, draft.parent, language)} and inherits its attributes.`,
      );
    if (draft.abstract)
      lines.push(
        'It is abstract: only for other classes to extend, never placed.',
      );
  } else {
    lines.push(`A relation class "${name}" (key ${draft.key}).`);
    lines.push(`It connects ${list(draft.from)} to ${list(draft.to)}.`);
  }
  lines.push(
    draft.attributes.length === 0
      ? 'No attributes.'
      : `Attributes: ${draft.attributes.map((a, i) => `${a.label} (${keys[i]})`).join(', ')}.`,
  );
  if (!(draft.kind === 'class' && draft.abstract)) {
    const types = draft.modelTypes
      .map((id) => kit.modelTypes[id])
      .filter((t) => t !== undefined)
      .map((t) => labelIn(t.labels, language, t.key));
    lines.push(
      types.length === 0
        ? 'No model type allows it yet: tick one above, or add it later in Build mode.'
        : `Model types that allow it: ${types.join(', ')}.`,
    );
  }
  return lines;
}

/** Classes that can be a parent or a relation end, sorted by label. */
export function classChoices(
  kit: Kit,
  language = 'en',
): { id: ClassId; label: string; abstract: boolean }[] {
  return Object.values(kit.classes)
    .map((c) => ({
      id: c.id,
      label: labelIn(c.labels, language, c.key),
      abstract: c.abstract === true,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
