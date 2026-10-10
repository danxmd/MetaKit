import { describe, expect, it } from 'vitest';
import { CANCELLABLE_EVENTS, EVENT_NAMES, type Kit } from '@metakit-app/core';
import { SAMPLE, sampleKit } from '@metakit-app/core/testing';
import { generateDeclarations } from './types-gen';

function kit(): Kit {
  const t = sampleKit();
  t.classes[SAMPLE.task]!.attributes.push(
    { id: 'att_number', key: 'Number', type: 'integer' },
    { id: 'att_due', key: 'Due', type: 'date' },
    { id: 'att_done', key: 'Done', type: 'boolean' },
    { id: 'att_owner', key: 'Owner', type: 'reference', target: {} },
    {
      id: 'att_tags',
      key: 'Tags',
      type: 'multi-choice',
      options: ['a', { value: 'b' }],
    },
    {
      id: 'att_steps',
      key: 'Steps',
      type: 'table',
      columns: [
        { id: 'c1', key: 'Step', type: 'text' },
        { id: 'c2', key: 'Hours', type: 'number' },
      ],
    },
    {
      id: 'att_btn',
      key: 'Go',
      type: 'action',
      run: { kind: 'script', ref: 'x' },
    },
  );
  return t;
}

const block = (text: string, name: string): string => {
  const start = text.indexOf(`  ${JSON.stringify(name)}: {`);
  return text.slice(start, text.indexOf('\n  };', start));
};

describe('generateDeclarations', () => {
  const text = generateDeclarations(kit());

  it('declares the metakit module', () => {
    expect(text).toMatch(/^declare module "metakit" \{/);
    for (const name of [
      'on',
      'model',
      'ui',
      'commands',
      'kit',
      'tool',
      'files',
      'http',
      'cancel',
    ])
      expect(text).toMatch(new RegExp(`export (const|function) ${name}\\b`));
  });

  it('declares "kit" and marks the old name "tool" as deprecated', () => {
    expect(text).toContain('export const kit: KitInfo;');
    expect(text).toMatch(
      /\/\*\* @deprecated Use kit\.[^*]*\*\/\n\s*export const tool: KitInfo;/,
    );
  });

  it('names the classes, relation classes and model types of the Kit', () => {
    expect(text).toContain(
      'export type ClassName = "FlowNode" | "Gateway" | "Lane" | "StartEvent" | "EndEvent" | "Task"'.replace(
        '"FlowNode" | "Gateway" | "Lane" | "StartEvent" | "EndEvent" | "Task"',
        '"EndEvent" | "FlowNode" | "Gateway" | "Lane" | "StartEvent" | "Task"',
      ),
    );
    expect(text).toContain(
      'export type ConcreteClassName = "EndEvent" | "Gateway" | "Lane" | "StartEvent" | "Task";',
    );
    expect(text).toContain('export type RelationName = "SequenceFlow";');
    expect(text).toContain('export type ModelTypeName = "Process";');
  });

  it('types each attribute of a class, with the inherited ones', () => {
    const task = block(text, 'Task');
    expect(task).toContain('"Name": string | null;');
    expect(task).toContain('"Code": string | null;');
    expect(task).toContain('"Priority": "Low" | "Medium" | "High" | null;');
    expect(task).toContain('"Effort": number | null;');
    expect(task).toContain('"Number": number | null;');
    expect(task).toContain('"Due": string | null;');
    expect(task).toContain('"Done": boolean;');
    expect(task).toContain('"Owner": string[];');
    expect(task).toContain('"Tags": ("a" | "b")[];');
    expect(task).toContain(
      '"Steps": { "Step"?: string | null; "Hours"?: number | null }[];',
    );
  });

  it('makes calculated attributes read-only and leaves buttons out', () => {
    const task = block(text, 'Task');
    expect(task).toContain(
      'readonly "Cost": string | number | boolean | null;',
    );
    expect(task).not.toContain('"Go"');
  });

  it('does not give a class the attributes of its siblings', () => {
    expect(block(text, 'Gateway')).not.toContain('"Priority"');
    expect(block(text, 'Gateway')).toContain(
      '"GatewayKind": "XOR" | "AND" | null;',
    );
    expect(block(text, 'SequenceFlow')).toContain(
      '"Condition": string | null;',
    );
  });

  it('lists the subclasses of every class', () => {
    expect(text).toContain(
      '"FlowNode": "EndEvent" | "FlowNode" | "Gateway" | "StartEvent" | "Task";',
    );
    expect(text).toContain('"Task": "Task";');
  });

  it('declares all 24 events with a payload type and the cancellable ones', () => {
    for (const e of EVENT_NAMES) {
      expect(text).toContain(`| ${JSON.stringify(e)}`);
      expect(text).toContain(`${JSON.stringify(e)}: `);
    }
    expect(text).toContain(
      `export type CancellableEvent = ${CANCELLABLE_EVENTS.map((e) => JSON.stringify(e)).join(' | ')};`,
    );
  });

  it('works for an empty Kit', () => {
    const empty = sampleKit();
    empty.classes = {};
    empty.relations = {};
    empty.modelTypes = {};
    const out = generateDeclarations(empty);
    expect(out).toContain('export type ClassName = never;');
    expect(out).toContain('export type AttributeKey = never;');
  });

  it('escapes names so that a Kit cannot inject code into the declarations', () => {
    const t = sampleKit();
    t.manifest.name = 'Evil */ declare const x: 1; /*';
    expect(generateDeclarations(t)).not.toContain('*/ declare const x');
  });
});
