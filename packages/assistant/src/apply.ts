import {
  newId,
  type BatchCommand,
  type RandomSource,
  type RuleAction,
  type ToolCommand,
  type ToolCommandOrBatch,
  type ToolLibrary,
} from '@metakit-app/core';
import { classDefFromDraft, uniqueClassKey } from './check';
import type { DraftKind } from './prompts';
import type {
  ClassDraft,
  DraftMap,
  RuleDraft,
  ScriptDraft,
  ShapeDraft,
} from './types';

/** A script name that no other script of the tool has: `Renumber tasks`, then `Renumber tasks 2`. */
function uniqueScriptName(tool: ToolLibrary, wanted: string): string {
  const used = new Set(
    Object.values(tool.scripts ?? {}).map((s) => s.name.toLowerCase()),
  );
  const base = wanted.trim() || 'Drafted script';
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++)
    if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/**
 * The tool commands that apply a draft, with new ids and a key (or name) that nothing else uses.
 * The commands are validated by the tool store like any other, so a draft that slipped through
 * the checks is refused there and changes nothing.
 */
export function draftToCommands<K extends DraftKind>(
  kind: K,
  draft: DraftMap[K],
  tool: ToolLibrary,
  random?: RandomSource,
): ToolCommand[] {
  switch (kind) {
    case 'rule':
      return [
        {
          type: 'putRule',
          rule: { id: newId('rule', random), ...(draft as RuleDraft) },
        },
      ];
    case 'script': {
      const d = draft as ScriptDraft;
      return [
        {
          type: 'putScript',
          script: {
            id: newId('script', random),
            name: uniqueScriptName(tool, d.name),
            source: d.source,
          },
        },
      ];
    }
    case 'shape':
      return [
        {
          type: 'putShape',
          def: {
            id: newId('shape', random),
            ...(draft as ShapeDraft),
          } as never,
        },
      ];
    case 'class':
      return [
        {
          type: 'putClass',
          def: classDefFromDraft(tool, draft as ClassDraft, {
            class: newId('class', random),
            attribute: () => newId('attribute', random),
          }) as never,
        },
      ];
    default:
      return [];
  }
}

/** One command, or a batch when there are several, so that accepting is a single undo step. */
export function asOneStep(commands: ToolCommand[]): ToolCommandOrBatch {
  if (commands.length === 1) return commands[0]!;
  const batch: BatchCommand<ToolCommand> = { type: 'batch', commands };
  return batch;
}

// -- plain English ----------------------------------------------------------------------------

function eventPhrase(event: string): string {
  if (event === 'command') return 'someone runs the command';
  const [noun = '', verb = ''] = event.split('.');
  if (noun === 'app')
    return verb === 'started' ? 'the app starts' : 'the app is closing';
  if (noun === 'selection') return 'the selection changes';
  if (noun === 'table')
    return verb === 'rowAdded'
      ? 'a row is added to a table'
      : 'a row is removed from a table';
  const article = /^[aeiou]/.test(noun) ? 'an' : 'a';
  // "creating" announces the action before it happens: "about to be created".
  if (verb.endsWith('ing'))
    return `${article} ${noun} is about to be ${verb.slice(0, -3)}ed`;
  return `${article} ${noun} is ${verb}`;
}

const show = (v: unknown): string =>
  typeof v === 'string' && v.trimStart().startsWith('=')
    ? `the result of ${v.trim()}`
    : JSON.stringify(v);

function actionPhrase(a: RuleAction, tool: ToolLibrary): string {
  switch (a.action) {
    case 'setAttribute':
      return `Set ${a.attribute} to ${show(a.value)}`;
    case 'createObject':
      return `Create a ${tool.classes[a.class]?.key ?? 'new'} object`;
    case 'createConnector':
      return `Create a ${tool.relations[a.relation]?.key ?? 'new'} connector`;
    case 'delete':
      return 'Delete the object';
    case 'message':
      return `Show ${a.kind === 'info' ? 'a message' : `a ${a.kind}`}: ${show(a.text)}`;
    case 'ask':
      return `Ask "${a.text}" and, on yes, ${a.then.map((x) => actionPhrase(x, tool).toLowerCase()).join(', ') || 'do nothing'}`;
    case 'choose':
      return `Ask "${a.text}" with the choices ${a.options.join(', ')} and keep the answer in ${a.attribute}`;
    case 'cancel':
      return `Cancel the action${a.reason ? `: ${a.reason}` : ''}`;
    case 'openModel':
      return `Open the model "${a.model}"`;
    case 'runCommand':
      return `Run the command "${a.command}"`;
    case 'runScript':
      return `Run the script "${a.script}"`;
  }
}

function describeAttributeDraft(a: Record<string, unknown>): string {
  const parts: string[] = [String(a.type)];
  if (Array.isArray(a.options)) parts.push(`choices ${a.options.join(', ')}`);
  if (a.required === true) parts.push('required');
  if (a.default !== undefined)
    parts.push(`starts as ${JSON.stringify(a.default)}`);
  return `${String(a.key)} (${parts.join(', ')})`;
}

function partWord(p: { type?: unknown }): string {
  return String(p.type ?? 'part');
}

/** The change a draft makes, as lines a modeller can read before accepting. */
export function describeDraftChange<K extends DraftKind>(
  kind: K,
  draft: DraftMap[K],
  tool: ToolLibrary,
): string[] {
  switch (kind) {
    case 'rule': {
      const r = draft as RuleDraft;
      const cls = r.when.class ? tool.classes[r.when.class]?.key : undefined;
      const rel = r.when.relation
        ? tool.relations[r.when.relation]?.key
        : undefined;
      const lines = [
        `Add the rule "${r.label}".`,
        `When ${eventPhrase(r.when.event)}${cls ? ` for ${cls}` : ''}${rel ? ` for ${rel}` : ''}${r.when.attribute ? ` (attribute ${r.when.attribute})` : ''}.`,
      ];
      if (r.if) lines.push(`If ${r.if.trim().replace(/^=\s*/, '')}.`);
      for (const a of r.then) lines.push(`Then: ${actionPhrase(a, tool)}.`);
      if (r.command)
        lines.push(
          `It also adds the command "${r.command.label}" (${r.command.place}).`,
        );
      return lines;
    }
    case 'script': {
      const s = draft as ScriptDraft;
      const rows = s.source.split('\n').filter((l) => l.trim() !== '').length;
      const lines = [
        `Add the script "${uniqueScriptName(tool, s.name)}" (${rows} lines).`,
      ];
      const events = [
        ...s.source.matchAll(/\bon\(\s*["']([a-z]+\.[A-Za-z]+)["']/g),
      ].map((m) => m[1]!);
      if (events.length > 0)
        lines.push(`It reacts to: ${[...new Set(events)].join(', ')}.`);
      const commands = [
        ...s.source.matchAll(/\blabel:\s*["'`]([^"'`]+)["'`]/g),
      ].map((m) => m[1]!);
      if (commands.length > 0)
        lines.push(`It adds the commands: ${commands.join(', ')}.`);
      if (/\bhttp\b/.test(s.source.replace(/["'`][^"'`]*["'`]/g, '')))
        lines.push(
          'It contacts web services: turn on that permission for the tool in the Scripts section.',
        );
      if (/\bfiles\b/.test(s.source.replace(/["'`][^"'`]*["'`]/g, '')))
        lines.push(
          'It reads or writes files: turn on that permission for the tool in the Scripts section.',
        );
      lines.push(
        'Scripts change models only through commands, so each can be undone.',
      );
      return lines;
    }
    case 'shape': {
      const s = draft as ShapeDraft;
      if (s.kind === 'relation') {
        const l = s.line ?? {};
        return [
          `Add the line shape "${s.name ?? 'New line'}".`,
          `Line: ${l.routing ?? 'straight'}${l.stroke ? `, ${String(l.stroke)}` : ''}${l.dash ? ', dashed' : ''}.`,
          ...(s.startMarker
            ? [`Start marker: ${String(s.startMarker.type)}.`]
            : []),
          ...(s.endMarker ? [`End marker: ${String(s.endMarker.type)}.`] : []),
          'Choose it for a relation class in the class editor to use it.',
        ];
      }
      const parts = s.parts ?? [];
      return [
        `Add the shape "${s.name ?? 'New shape'}", ${s.size.width} by ${s.size.height}.`,
        `It draws ${parts.length} ${parts.length === 1 ? 'part' : 'parts'}: ${parts.map(partWord).join(', ')}.`,
        'Choose it for a class in the class editor to use it.',
      ];
    }
    case 'class': {
      const c = draft as ClassDraft;
      const parent = c.extends
        ? (tool.classes[c.extends as never]?.key ??
          Object.values(tool.classes).find((x) => x.key === c.extends)?.key)
        : undefined;
      const key = uniqueClassKey(tool, c.key);
      return [
        `Add the class "${key}"${key !== c.key ? ` (the key ${c.key} is taken)` : ''}${parent ? `, which extends ${parent}` : ''}.`,
        c.attributes.length > 0
          ? `Attributes: ${c.attributes.map(describeAttributeDraft).join('; ')}.`
          : 'It has no attributes yet.',
        ...(c.constraints ?? []).map(
          (k) =>
            `Check: ${k.message} (when ${k.formula.trim().replace(/^=\s*/, '')}).`,
        ),
      ];
    }
    default:
      return [];
  }
}
