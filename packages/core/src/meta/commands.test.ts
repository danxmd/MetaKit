import { describe, expect, it } from 'vitest';
import { sampleTool, SAMPLE, clone } from '../testing/sample-tool';
import { CommandError } from '../store/tx';
import { createToolStore } from './commands';
import { validateToolLibrary } from './guards';
import type { ClassDef, ModelTypeDef } from './types';

const make = () => createToolStore(sampleTool());

describe('tool library commands', () => {
  it('update the manifest and settings', () => {
    const store = make();
    store.execute({
      type: 'updateManifest',
      name: 'Renamed',
      version: '1.1.0',
      languages: ['en'],
    });
    store.execute({
      type: 'updateSettings',
      grid: { size: 20, snap: false },
      numbering: { enabled: true, prefix: 'T-' },
    });
    expect(store.state.manifest).toMatchObject({
      name: 'Renamed',
      version: '1.1.0',
      languages: ['en'],
      id: SAMPLE.tool,
    });
    expect(store.state.settings.grid).toEqual({
      size: 20,
      snap: false,
      visible: true,
    });
    expect(store.state.settings.numbering).toEqual({
      enabled: true,
      prefix: 'T-',
      start: 1,
    });
  });

  it('add, replace and remove classes, relation classes and model types, with undo', () => {
    const store = make();
    const before = store.state;
    const doc: ClassDef = {
      id: 'cls_doc',
      key: 'Document',
      kind: 'node',
      labels: { en: 'Document' },
      attributes: [],
    };
    store.execute({ type: 'putClass', def: doc });
    store.execute({ type: 'putClass', def: { ...doc, labels: { en: 'Doc' } } });
    expect(store.state.classes.cls_doc!.labels.en).toBe('Doc');
    store.execute({ type: 'removeClass', id: 'cls_doc' });
    expect(store.state.classes.cls_doc).toBeUndefined();
    store.undo();
    store.undo();
    store.undo();
    expect(store.state).toEqual(before);
  });

  it('keep a library valid when the commands are used in a sensible order', () => {
    const store = make();
    const mt = clone(store.state.modelTypes[SAMPLE.process]!) as ModelTypeDef;
    store.execute({
      type: 'batch',
      commands: [
        {
          type: 'putClass',
          def: {
            id: 'cls_note',
            key: 'Note',
            kind: 'node',
            labels: { en: 'Note' },
            attributes: [],
          },
        },
        {
          type: 'putModelType',
          def: { ...mt, classes: [...mt.classes, 'cls_note'] },
        },
      ],
    });
    expect(validateToolLibrary(store.state)).toEqual([]);
  });

  it('refuse to remove a class that is still used, and say who uses it', () => {
    const store = make();
    expect(() =>
      store.execute({ type: 'removeClass', id: SAMPLE.flowNode }),
    ).toThrow(CommandError);
    expect(() =>
      store.execute({ type: 'removeClass', id: SAMPLE.flowNode }),
    ).toThrow(/class "Task" extends it/);
    expect(() =>
      store.execute({ type: 'removeClass', id: SAMPLE.flowNode }),
    ).toThrow(/relation class "SequenceFlow" allows it at FROM/);
    expect(() =>
      store.execute({ type: 'removeClass', id: SAMPLE.start }),
    ).toThrow(/model type "Process" allows it.*view "FlowOnly".*cardinality/);
    expect(store.state.classes[SAMPLE.flowNode]).toBeDefined();
  });

  it('refuse to remove a relation class that is still used', () => {
    const store = make();
    expect(() =>
      store.execute({ type: 'removeRelation', id: SAMPLE.flow }),
    ).toThrow(/model type "Process" allows it/);
    store.execute({ type: 'removeModelType', id: SAMPLE.process });
    store.execute({ type: 'removeRelation', id: SAMPLE.flow });
    expect(store.state.relations).toEqual({});
  });

  it('refuse unknown ids and definitions with a wrong id', () => {
    const store = make();
    expect(() =>
      store.execute({ type: 'removeClass', id: 'cls_ghost' }),
    ).toThrow(/does not exist/);
    expect(() =>
      store.execute({ type: 'removeModelType', id: 'mt_ghost' }),
    ).toThrow(/does not exist/);
    expect(() =>
      store.execute({
        type: 'putClass',
        def: {
          id: 'x',
          key: 'X',
          kind: 'node',
          labels: {},
          attributes: [],
        } as never,
      }),
    ).toThrow(/needs an id of the right kind/);
    expect(() =>
      store.execute({ type: 'putClass', def: null as never }),
    ).toThrow(/needs an id/);
    expect(() => store.execute({ type: 'nope' } as never)).toThrow(
      /Unknown command/,
    );
  });

  it('run before and after hooks like any document', () => {
    const store = make();
    store.before('removeModelType', () => ({
      cancel: 'Model types are locked.',
    }));
    expect(
      store.execute({ type: 'removeModelType', id: SAMPLE.process }),
    ).toMatchObject({ ok: false, reason: 'Model types are locked.' });
  });
});
