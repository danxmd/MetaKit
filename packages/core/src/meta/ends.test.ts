import { describe, expect, it } from 'vitest';
import type { ClassId, RelationId } from '../ids';
import { createEmptyKit } from './create';
import {
  concreteEndClasses,
  connectsSentence,
  describeRelationEnds,
  includedSubclasses,
  orList,
  relationEndClasses,
  withArticle,
} from './ends';
import type { ClassDef, ModelTypeDef, RelationDef, Kit } from './types';

const cls = (
  key: string,
  extra: Partial<ClassDef> = {},
  label = key,
): ClassDef => ({
  id: `cls_${key.toLowerCase()}` as ClassId,
  key,
  kind: 'node',
  labels: { en: label },
  attributes: [],
  ...extra,
});
const rel = (
  key: string,
  from: string[],
  to: string[],
  extra: Partial<RelationDef> = {},
): RelationDef => ({
  id: `rel_${key.toLowerCase()}` as RelationId,
  key,
  labels: { en: key },
  from: from.map((k) => `cls_${k.toLowerCase()}` as ClassId),
  to: to.map((k) => `cls_${k.toLowerCase()}` as ClassId),
  attributes: [],
  ...extra,
});

/** Actor (abstract) > Agent, Human; Task > UserTask; Gate; Event (abstract, nothing concrete). */
function kit(): Kit {
  const k = createEmptyKit({ name: 'Ends', languages: ['en', 'de'] });
  for (const c of [
    cls('Actor', { abstract: true }),
    cls('Agent', { extends: 'cls_actor' as ClassId }),
    cls('Human', { extends: 'cls_actor' as ClassId }, 'Person'),
    cls('Task', { labels: { en: 'Task', de: 'Aufgabe' } }),
    cls('UserTask', { extends: 'cls_task' as ClassId }, 'User task'),
    cls('Gate'),
    cls('Event', { abstract: true }),
  ])
    k.classes[c.id] = c;
  for (const r of [
    rel('Performs', ['Actor'], ['Task']),
    rel('Flow', ['Task', 'Gate', 'UserTask'], ['Task', 'Gate']),
    rel('Approves', [], [], { extends: 'rel_performs' as RelationId }),
    rel('Broken', [], ['Event']),
  ])
    k.relations[r.id] = r;
  return k;
}

const modelType = (classes: string[]): ModelTypeDef => ({
  id: 'mt_one' as never,
  key: 'One',
  labels: { en: 'One' },
  classes: classes.map((c) => `cls_${c.toLowerCase()}` as ClassId),
  relations: [],
  views: [],
  cardinalities: [],
  attributes: [],
});

const keys = (list: ClassDef[]) => list.map((c) => c.key);

describe('relation ends', () => {
  it('replaces an abstract class by its concrete subclasses', () => {
    const k = kit();
    expect(keys(concreteEndClasses(k, ['cls_actor' as ClassId]))).toEqual([
      'Agent',
      'Human',
    ]);
  });

  it('lists a concrete class once, not its subclasses too', () => {
    const k = kit();
    const ends = relationEndClasses(k, 'rel_flow' as RelationId);
    expect(keys(ends.from)).toEqual(['Gate', 'Task']);
    expect(keys(ends.to)).toEqual(['Gate', 'Task']);
  });

  it('uses the inherited ends', () => {
    const k = kit();
    expect(
      describeRelationEnds(k, k.relations['rel_approves' as RelationId]!),
    ).toEqual({
      from: ['Agent', 'Person'],
      to: ['Task'],
      phrase: 'an Agent or a Person to a Task',
      sentence: 'Connects an Agent or a Person to a Task.',
    });
  });

  it('leaves out what the model type does not allow, keeping allowed subclasses', () => {
    const k = kit();
    const only = modelType(['Agent', 'UserTask']);
    const ends = describeRelationEnds(
      k,
      k.relations['rel_performs' as RelationId]!,
      { modelType: only },
    );
    expect(ends.from).toEqual(['Agent']);
    expect(ends.to).toEqual(['User task']);
    expect(ends.sentence).toBe('Connects an Agent to a User task.');
  });

  it('says so when no class is left at an end', () => {
    const k = kit();
    expect(
      describeRelationEnds(k, k.relations['rel_broken' as RelationId]!)
        .sentence,
    ).toBe('Connects any object to nothing in this model type.');
  });

  it('uses the labels of the language', () => {
    const k = kit();
    expect(
      describeRelationEnds(k, k.relations['rel_performs' as RelationId]!, {
        language: 'de',
      }).to,
    ).toEqual(['Aufgabe']);
  });

  it('names what a ticked class brings in', () => {
    const k = kit();
    expect(keys(includedSubclasses(k, 'cls_actor' as ClassId))).toEqual([
      'Agent',
      'Human',
    ]);
    expect(keys(includedSubclasses(k, 'cls_task' as ClassId))).toEqual([
      'UserTask',
    ]);
    expect(includedSubclasses(k, 'cls_gate' as ClassId)).toEqual([]);
  });
});

describe('wording', () => {
  it('puts a or an before a word', () => {
    expect(withArticle('Task')).toBe('a Task');
    expect(withArticle('Agent')).toBe('an Agent');
    expect(withArticle('Event')).toBe('an Event');
    expect(withArticle('User story')).toBe('a User story');
    expect(withArticle('Hour')).toBe('an Hour');
    expect(withArticle('SLA')).toBe('an SLA');
    expect(withArticle('KPI')).toBe('a KPI');
  });

  it('joins names with commas and a final or', () => {
    expect(orList([])).toBe('');
    expect(orList(['Task'])).toBe('Task');
    expect(orList(['Agent', 'Human'])).toBe('Agent or Human');
    expect(orList(['Task', 'Gate', 'Event'], true)).toBe(
      'a Task, a Gate or an Event',
    );
  });

  it('says what connects to what', () => {
    expect(connectsSentence(['Task', 'Gate'], ['Task'])).toBe(
      'Connects a Task or a Gate to a Task.',
    );
    expect(
      connectsSentence([], ['Task'], { from: true, word: 'any class' }),
    ).toBe('Connects any class to a Task.');
  });
});
