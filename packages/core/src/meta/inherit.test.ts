import { describe, expect, it } from 'vitest';
import { sampleKit, SAMPLE, clone } from '../testing/sample-kit';
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
import type { Kit } from './types';

const kit = sampleKit();

describe('inheritance', () => {
  it('lists inherited attributes before own ones', () => {
    expect(effectiveAttributes(kit, SAMPLE.task).map((a) => a.key)).toEqual([
      'Name',
      'Code',
      'Priority',
      'Effort',
      'Cost',
    ]);
    expect(effectiveAttributes(kit, SAMPLE.lane).map((a) => a.key)).toEqual([
      'LaneName',
    ]);
  });

  it('knows what a class is a kind of', () => {
    expect(isA(kit, SAMPLE.task, SAMPLE.task)).toBe(true);
    expect(isA(kit, SAMPLE.task, SAMPLE.flowNode)).toBe(true);
    expect(isA(kit, SAMPLE.task, SAMPLE.gateway)).toBe(false);
    expect(isA(kit, SAMPLE.flowNode, SAMPLE.task)).toBe(false);
    expect(isA(kit, 'cls_unknown', SAMPLE.task)).toBe(false);
  });

  it('supports three levels', () => {
    const deep = clone(kit);
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
    expect(allowsEnd(kit, SAMPLE.flow, 'from', SAMPLE.task)).toBe(true);
    expect(allowsEnd(kit, SAMPLE.flow, 'to', SAMPLE.gateway)).toBe(true);
    expect(allowsEnd(kit, SAMPLE.flow, 'from', SAMPLE.lane)).toBe(false);
  });

  it('inherits the ends and attributes of a parent relation', () => {
    const t = clone(kit);
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
    const t = clone(kit);
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
    const mt = kit.modelTypes[SAMPLE.process]!;
    expect(modelTypeAllowsClass(kit, mt, SAMPLE.task)).toBe(true);
    const narrow = { ...mt, classes: [SAMPLE.flowNode] };
    expect(modelTypeAllowsClass(kit, narrow, SAMPLE.task)).toBe(true);
    expect(modelTypeAllowsClass(kit, narrow, SAMPLE.lane)).toBe(false);
  });

  it('explains loops and missing parents', () => {
    const t: Kit = clone(kit);
    t.classes[SAMPLE.flowNode]!.extends = SAMPLE.task;
    expect(() => classChain(t, SAMPLE.task)).toThrow(InheritanceError);
    expect(() => classChain(t, SAMPLE.task)).toThrow(
      /extend each other in a loop/,
    );
    const u: Kit = clone(kit);
    u.classes[SAMPLE.task]!.extends = 'cls_gone';
    expect(() => classChain(u, SAMPLE.task)).toThrow(
      /"Task" extends cls_gone, which does not exist/,
    );
    expect(isA(t, SAMPLE.task, SAMPLE.flowNode)).toBe(false);
  });

  it('finds classes by key', () => {
    expect(findClassByKey(kit, 'Gateway')?.id).toBe(SAMPLE.gateway);
    expect(findClassByKey(kit, 'Nope')).toBeUndefined();
  });
});
