import { describe, expect, it } from 'vitest';
import { sampleTool, SAMPLE, clone } from '../testing/sample-tool';
import {
  allowsEnd,
  classChain,
  effectiveAttributes,
  effectiveEnds,
  effectiveRelationAttributes,
  findClassByKey,
  InheritanceError,
  isA,
  modelTypeAllowsClass,
  relationIsA,
  subclasses,
} from './inherit';
import type { ToolLibrary } from './types';

const tool = sampleTool();

describe('inheritance', () => {
  it('lists inherited attributes before own ones', () => {
    expect(effectiveAttributes(tool, SAMPLE.task).map((a) => a.key)).toEqual([
      'Name',
      'Code',
      'Priority',
      'Effort',
      'Cost',
    ]);
    expect(effectiveAttributes(tool, SAMPLE.lane).map((a) => a.key)).toEqual([
      'LaneName',
    ]);
  });

  it('knows what a class is a kind of', () => {
    expect(isA(tool, SAMPLE.task, SAMPLE.task)).toBe(true);
    expect(isA(tool, SAMPLE.task, SAMPLE.flowNode)).toBe(true);
    expect(isA(tool, SAMPLE.task, SAMPLE.gateway)).toBe(false);
    expect(isA(tool, SAMPLE.flowNode, SAMPLE.task)).toBe(false);
    expect(isA(tool, 'cls_unknown', SAMPLE.task)).toBe(false);
  });

  it('supports three levels', () => {
    const deep = clone(tool);
    deep.classes.cls_special = {
      id: 'cls_special',
      key: 'Special',
      kind: 'node',
      labels: { en: 'S' },
      extends: SAMPLE.task,
      attributes: [{ id: 'att_sp', key: 'Special', type: 'boolean' }],
    };
    expect(classChain(deep, 'cls_special').map((c) => c.key)).toEqual([
      'FlowNode',
      'Task',
      'Special',
    ]);
    expect(effectiveAttributes(deep, 'cls_special').map((a) => a.key)).toEqual([
      'Name',
      'Code',
      'Priority',
      'Effort',
      'Cost',
      'Special',
    ]);
    expect(isA(deep, 'cls_special', SAMPLE.flowNode)).toBe(true);
    expect(subclasses(deep, SAMPLE.flowNode).map((c) => c.key)).toEqual([
      'EndEvent',
      'Gateway',
      'Special',
      'StartEvent',
      'Task',
    ]);
  });

  it('lets abstract classes in a relation end stand for their subclasses', () => {
    expect(allowsEnd(tool, SAMPLE.flow, 'from', SAMPLE.task)).toBe(true);
    expect(allowsEnd(tool, SAMPLE.flow, 'to', SAMPLE.gateway)).toBe(true);
    expect(allowsEnd(tool, SAMPLE.flow, 'from', SAMPLE.lane)).toBe(false);
  });

  it('inherits the ends and attributes of a parent relation', () => {
    const t = clone(tool);
    t.relations.rel_cond = {
      id: 'rel_cond',
      key: 'ConditionalFlow',
      labels: { en: 'C' },
      extends: SAMPLE.flow,
      from: [],
      to: [],
      attributes: [{ id: 'att_guard', key: 'Guard', type: 'text' }],
    };
    expect(effectiveEnds(t, 'rel_cond')).toEqual({
      from: [SAMPLE.flowNode],
      to: [SAMPLE.flowNode],
    });
    expect(
      effectiveRelationAttributes(t, 'rel_cond').map((a) => a.key),
    ).toEqual(['Condition', 'Guard']);
    expect(relationIsA(t, 'rel_cond', SAMPLE.flow)).toBe(true);
    expect(relationIsA(t, SAMPLE.flow, 'rel_cond')).toBe(false);
  });

  it('prefers the nearest relation with its own ends', () => {
    const t = clone(tool);
    t.relations.rel_narrow = {
      id: 'rel_narrow',
      key: 'Narrow',
      labels: { en: 'N' },
      extends: SAMPLE.flow,
      from: [SAMPLE.start],
      to: [],
      attributes: [],
    };
    expect(effectiveEnds(t, 'rel_narrow')).toEqual({
      from: [SAMPLE.start],
      to: [SAMPLE.flowNode],
    });
  });

  it('allows a class in a model type when it or an ancestor is listed', () => {
    const mt = tool.modelTypes[SAMPLE.process]!;
    expect(modelTypeAllowsClass(tool, mt, SAMPLE.task)).toBe(true);
    const narrow = { ...mt, classes: [SAMPLE.flowNode] };
    expect(modelTypeAllowsClass(tool, narrow, SAMPLE.task)).toBe(true);
    expect(modelTypeAllowsClass(tool, narrow, SAMPLE.lane)).toBe(false);
  });

  it('explains loops and missing parents', () => {
    const t: ToolLibrary = clone(tool);
    t.classes[SAMPLE.flowNode]!.extends = SAMPLE.task;
    expect(() => classChain(t, SAMPLE.task)).toThrow(InheritanceError);
    expect(() => classChain(t, SAMPLE.task)).toThrow(
      /extend each other in a loop/,
    );
    const u: ToolLibrary = clone(tool);
    u.classes[SAMPLE.task]!.extends = 'cls_gone';
    expect(() => classChain(u, SAMPLE.task)).toThrow(
      /"Task" extends cls_gone, which does not exist/,
    );
    expect(isA(t, SAMPLE.task, SAMPLE.flowNode)).toBe(false);
  });

  it('finds classes by key', () => {
    expect(findClassByKey(tool, 'Gateway')?.id).toBe(SAMPLE.gateway);
    expect(findClassByKey(tool, 'Nope')).toBeUndefined();
  });
});
