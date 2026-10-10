import { generateDeclarations } from '@metakit-app/behaviour';
import {
  CANCELLABLE_EVENTS,
  EVENT_NAMES,
  RULE_ACTION_TYPES,
  effectiveAttributes,
  effectiveRelationAttributes,
  optionValue,
  type AttributeDef,
  type Kit,
} from '@metakit-app/core';
import { FUNCTION_NAMES } from '@metakit-app/formula';
import type { ChatMessage, CompletionRequest } from './provider';

export type DraftKind = 'rule' | 'script' | 'shape' | 'class';
export const DRAFT_KINDS: readonly DraftKind[] = [
  'rule',
  'script',
  'shape',
  'class',
];

export const MAX_SENTENCE_CHARS = 2000;

const MAX_LISTED = 80;

function describeAttribute(a: AttributeDef): string {
  let type: string = a.type;
  if (a.type === 'choice' || a.type === 'multi-choice')
    type += `: ${a.options.map(optionValue).join(' | ')}`;
  if (a.type === 'formula') type += ` = ${a.formula}`;
  return `${a.key} (${type}${a.required ? ', required' : ''})`;
}

function listed<T>(items: T[], line: (item: T) => string): string[] {
  const lines = items.slice(0, MAX_LISTED).map(line);
  if (items.length > MAX_LISTED)
    lines.push(`- ... and ${items.length - MAX_LISTED} more`);
  return lines;
}

/**
 * A compact text of the meta-model: what a person would read to know what the Kit can model.
 * It is built from the Kit only; no model is ever passed in (ADR 0008).
 */
export function summariseKit(kit: Kit): string {
  const out: string[] = [
    `Kit: "${kit.manifest.name}". Languages: ${kit.manifest.languages.join(', ')}.`,
  ];
  const classes = Object.values(kit.classes).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  out.push('', 'Classes (id, key, kind, attributes including inherited ones):');
  if (classes.length === 0) out.push('- none yet');
  out.push(
    ...listed(classes, (c) => {
      let attrs: AttributeDef[];
      try {
        attrs = effectiveAttributes(kit, c.id);
      } catch {
        attrs = c.attributes;
      }
      const parent = c.extends ? kit.classes[c.extends] : undefined;
      return `- ${c.key} [${c.id}] ${c.kind}${c.abstract ? ', abstract' : ''}${parent ? `, extends ${parent.key}` : ''}: ${attrs.map(describeAttribute).join('; ') || 'no attributes'}`;
    }),
  );

  const relations = Object.values(kit.relations).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  out.push('', 'Relation classes (id, key, from, to, attributes):');
  if (relations.length === 0) out.push('- none yet');
  const keyOf = (id: string) => kit.classes[id as never]?.key ?? id;
  out.push(
    ...listed(relations, (r) => {
      let attrs: AttributeDef[];
      try {
        attrs = effectiveRelationAttributes(kit, r.id);
      } catch {
        attrs = r.attributes;
      }
      return `- ${r.key} [${r.id}] from ${r.from.map(keyOf).join(', ') || 'any'} to ${r.to.map(keyOf).join(', ') || 'any'}: ${attrs.map(describeAttribute).join('; ') || 'no attributes'}`;
    }),
  );

  const modelTypes = Object.values(kit.modelTypes);
  if (modelTypes.length > 0) {
    out.push('', 'Model types:');
    out.push(
      ...listed(
        modelTypes,
        (m) => `- ${m.key}: ${m.classes.map(keyOf).join(', ') || 'no classes'}`,
      ),
    );
  }

  const rules = Object.values(kit.rules ?? {});
  if (rules.length > 0) {
    out.push('', 'Existing rules:');
    out.push(
      ...listed(
        rules,
        (r) =>
          `- "${r.label}" (${r.when.event}${r.when.class ? ` on ${keyOf(r.when.class)}` : ''})`,
      ),
    );
  }
  const shapes = Object.values(kit.shapes ?? {});
  if (shapes.length > 0) {
    out.push('', 'Existing shapes (id, kind, name):');
    out.push(
      ...listed(shapes, (s) => `- [${s.id}] ${s.kind} "${s.name ?? ''}"`),
    );
  }
  const scripts = Object.values(kit.scripts ?? {});
  if (scripts.length > 0) {
    out.push('', 'Existing scripts:');
    out.push(...listed(scripts, (s) => `- "${s.name}"`));
  }
  return out.join('\n');
}

// -- format descriptions ---------------------------------------------------------------------

const FORMULAS = `Formulas are text that starts with "=". They read the attributes of the object by key, for example
"= Priority == 'High' && Owner == null". Text is written in single quotes; null means empty.
Operators: + - * / == != < <= > >= && || ! and  a ? b : c. Functions: ${[...FUNCTION_NAMES].join(', ')}.
objects("Task") lists the objects of a class by its key; incoming("Flow") and outgoing("Flow") list connected
objects; parent and self are available; relation classes also have from and to.`;

const RULE_SCHEMA = `A rule is one JSON object (no id; the app adds it):
{
  "label": "plain text name of the rule",
  "when": {
    "event": one of "command" or ${EVENT_NAMES.map((e) => `"${e}"`).join(', ')},
    "class": optional, the id of a class from the list above (rules then apply to its subclasses too),
    "attribute": optional, an attribute key (only for attribute.* and table.* events),
    "relation": optional, the id of a relation class (only for connector events)
  },
  "if": optional formula starting with "=", the rule runs only when it is true,
  "then": [ actions, in order ],
  "command": only when event is "command": { "label": "menu text", "place": "model" | "toolbar" | "context" }
}
Events that can be cancelled by a "cancel" action: ${CANCELLABLE_EVENTS.join(', ')}.
Action types (field "action"): ${RULE_ACTION_TYPES.join(', ')}.
  { "action": "setAttribute", "attribute": "<attribute key>", "value": <fixed value or "= formula">, "target": optional "self" }
  { "action": "createObject", "class": "<class id>", "attributes": { "<key>": <value or "= formula"> }, "offset": { "x": 0, "y": 0 } }
  { "action": "createConnector", "relation": "<relation class id>", "from": optional, "to": optional }
  { "action": "delete", "target": optional }
  { "action": "message", "kind": "info" | "warning" | "error", "text": "text or \\"= formula\\"" }
  { "action": "ask", "text": "question", "then": [actions], "else": [actions] }
  { "action": "choose", "text": "question", "options": ["a", "b"], "attribute": "<attribute key>" }
  { "action": "cancel", "reason": "text" }
  { "action": "openModel", "model": "name" }   { "action": "runCommand", "command": "id" }   { "action": "runScript", "script": "name" }
In formulas inside rules, $old, $new, $event and $attribute are also available.
${FORMULAS}`;

export const RULE_EXAMPLE = `{
  "label": "High-priority tasks need an owner",
  "when": { "event": "attribute.changed", "class": "<id of Task from the list>", "attribute": "Priority" },
  "if": "= Priority == 'High' && Owner == null",
  "then": [
    { "action": "message", "kind": "warning", "text": "= 'Task \\"' + Name + '\\" is high priority but has no owner.'" }
  ]
}`;

const SHAPE_SCHEMA = `A shape is one JSON object (no id; the app adds it). For a class:
{
  "kind": "node",
  "name": "readable name",
  "size": { "width": 140, "height": 70, "resizable": true, "minWidth": 60, "minHeight": 36 },
  "outline": optional "rect" | "ellipse" | "auto" | { "type": "polygon", "points": [[x, y], ...] },
  "let": optional { "name": "= formula", ... },
  "parts": [ parts, drawn in order ],
  "variants": optional [ { "when": "= formula", "parts": [parts] } ]
}
For a relation class:
{
  "kind": "relation", "name": "readable name",
  "line": { "stroke": "#364fc7", "strokeWidth": 1.5, "dash": [6, 4], "routing": "straight" | "orthogonal" | "curved", "corners": 0 },
  "startMarker": { "type": "none" | "arrow" | "open-arrow" | "triangle" | "diamond" | "circle" | "cross" | "bar", "fill": "#fff", "size": 10 },
  "endMarker": { same fields },
  "labels": [ { "at": "start" | "middle" | "end", "text": "= formula or text", "offset": { "x": 0, "y": -8 } } ]
}
Parts all have optional x, y, width, height (pixels, or text like "50%" or "100% - 16"), fill, stroke, strokeWidth, opacity,
font { family, size, weight, style, color }, visible, tooltip, onClick, shadow { color, blur, x, y }, transform, dash.
Part types and their own fields:
  { "type": "rect", "radius": 10 }   { "type": "ellipse" }   { "type": "polygon", "points": [[x, y], ...] (at least 3) }
  { "type": "path", "d": "SVG path", "viewBox": [0, 0, 24, 24] }
  { "type": "text", "text": "= Name", "wrap": true, "fit": "none" | "shrink" | "clip", "align": "left" | "center" | "right", "valign": "top" | "middle" | "bottom" }
  { "type": "group", "parts": [parts], "layout": { "kind": "stack", "direction": "column" | "row", "gap": 4 } }
Any property can be a formula: text starting with "=" that reads attribute keys (for example "= Name") and these names:
$label (the object's name), $class, $width, $height, $fill (the colour for the object), $fields (lines of "Label: value").
Colours are CSS colours such as "#1971c2" or "royalblue". ${FORMULAS}`;

const SHAPE_EXAMPLE = `{
  "kind": "node",
  "name": "Task box",
  "size": { "width": 140, "height": 70, "resizable": true, "minWidth": 60, "minHeight": 36 },
  "outline": "rect",
  "parts": [
    { "type": "rect", "x": 0, "y": 0, "width": "100%", "height": "100%", "radius": 10, "fill": "#d0ebff", "stroke": "#1971c2", "strokeWidth": 1.5 },
    { "type": "text", "x": 8, "y": 4, "width": "100% - 16", "height": "100% - 8", "text": "= Name", "wrap": true, "fit": "shrink", "align": "center", "valign": "middle" }
  ]
}`;

const CLASS_SCHEMA = `A class is one JSON object (no ids; the app adds them):
{
  "key": "Task"  (letters, digits and underscores; starts with a letter; unique among classes),
  "kind": "node" | "container" | "swimlane",
  "labels": { "<language code>": "Task" },
  "extends": optional, the key of an existing class to inherit its attributes from,
  "abstract": optional true,
  "attributes": [ { "key": "Name", "type": "<type>", "labels": { "en": "Name" }, "required": optional true, ... type fields } ],
  "constraints": optional [ { "id": "short-id", "formula": "= formula that is true when the object is fine", "message": "text", "severity": "error" | "warning" } ]
}
Attribute types and their extra fields:
  text (multiline, maxLength, pattern, default)   integer / number (min, max, default; number also decimals, unit)
  boolean (default)   date / date-time / duration (default as ISO 8601 text)
  choice (options: ["Low", "Medium", "High"], default)   multi-choice (options, min, max, default as a list)
  formula (formula: "= Effort * 2", result: "text" | "number" | "boolean" | "date")   link (default)
Attribute keys are unique, also against inherited ones. Do not repeat attributes the parent class already has.
${FORMULAS}`;

const CLASS_EXAMPLE = `{
  "key": "Task",
  "kind": "node",
  "labels": { "en": "Task" },
  "attributes": [
    { "key": "Name", "type": "text", "labels": { "en": "Name" }, "required": true },
    { "key": "Priority", "type": "choice", "labels": { "en": "Priority" }, "options": ["Low", "Medium", "High"], "default": "Medium" },
    { "key": "Owner", "type": "text", "labels": { "en": "Owner" } }
  ]
}`;

/** The plan's script, used as the example of the style wanted. */
export const SCRIPT_EXAMPLE = `// Name: Renumber tasks
import { on, model, ui, commands } from "metakit";

function renumberTasks(): void {
  const tasks = model.objects("Task").sort((a, b) => a.y - b.y || a.x - b.x);
  tasks.forEach((task, index) => {
    task.attrs.Number = index + 1;
  });
}

on("object.created", { class: "Task" }, () => renumberTasks());
on("object.moved", { class: "Task" }, () => renumberTasks());

commands.register({
  id: "renumber-tasks",
  label: "Renumber tasks",
  menu: "Model",
  run: () => {
    renumberTasks();
    ui.message(\`Renumbered \${model.objects("Task").length} tasks.\`);
  },
});`;

const SYSTEM_BASE = `You help a method engineer build a Kit (a modelling tool) in MetaKit. You draft one part of the Kit from a plain description.
You only know the Kit definition below. You never see anyone's models and you must not invent model data.
Use only class, relation class and attribute names that exist in the Kit definition, unless the description asks for new ones.`;

export function systemPrompt(
  kit: Kit,
  kind: DraftKind,
  language?: string,
): string {
  const lang =
    language && kit.manifest.languages.includes(language)
      ? `Write labels and messages in the language "${language}".`
      : `Write labels and messages in the language "${kit.manifest.languages[0] ?? 'en'}".`;
  const parts: string[] = [
    SYSTEM_BASE,
    lang,
    '',
    'KIT DEFINITION',
    summariseKit(kit),
    '',
  ];
  switch (kind) {
    case 'rule':
      parts.push(
        'TARGET: a no-code rule (When / If / Then).',
        RULE_SCHEMA,
        'Example of the style wanted:',
        RULE_EXAMPLE,
        '',
        'Reply with the rule as one JSON object in a ```json code block, and nothing else.',
      );
      break;
    case 'shape':
      parts.push(
        'TARGET: a shape that draws a class or a relation class.',
        SHAPE_SCHEMA,
        'Example of the style wanted:',
        SHAPE_EXAMPLE,
        '',
        'Reply with the shape as one JSON object in a ```json code block, and nothing else.',
      );
      break;
    case 'class':
      parts.push(
        'TARGET: a new class with its attributes.',
        CLASS_SCHEMA,
        'Example of the style wanted:',
        CLASS_EXAMPLE,
        '',
        'Reply with the class as one JSON object in a ```json code block, and nothing else.',
      );
      break;
    case 'script':
      parts.push(
        'TARGET: a TypeScript script. It runs in a sandbox with no browser, no fetch and no timers.',
        'It can only import from "metakit" and can change models only through that module (assign task.attrs.X = value, model.create, and so on).',
        'The first line must be a comment "// Name: <short name of the script>". Register menu commands with commands.register and react to events with on(...).',
        'The declarations of the "metakit" module for this Kit:',
        '```ts',
        generateDeclarations({ ...kit, scripts: {}, rules: {} }),
        '```',
        'Example of the style wanted:',
        '```ts',
        SCRIPT_EXAMPLE,
        '```',
        '',
        'Reply with the complete script in one ```ts code block, and nothing else.',
      );
      break;
  }
  return parts.join('\n');
}

export function userPrompt(kind: DraftKind, sentence: string): string {
  return `Draft this ${kind}: ${sentence.trim()}`;
}

export function buildRequest(
  kit: Kit,
  kind: DraftKind,
  sentence: string,
  language?: string,
): CompletionRequest {
  return {
    system: systemPrompt(kit, kind, language),
    messages: [{ role: 'user', content: userPrompt(kind, sentence) }],
    maxTokens: kind === 'script' ? 6000 : 4096,
  };
}

/** The follow-up that asks for a corrected draft, listing what was wrong. */
export function retryMessages(
  first: CompletionRequest,
  reply: string,
  errors: string[],
  kind: DraftKind,
): ChatMessage[] {
  return [
    ...first.messages,
    { role: 'assistant', content: reply },
    {
      role: 'user',
      content: `The ${kind} has these problems:\n${errors.map((e) => `- ${e}`).join('\n')}\nFix them and reply again with the complete corrected ${kind} in the same format, and nothing else.`,
    },
  ];
}
