import { describe, expect, it } from 'vitest';
import { importFiles, importKindOf, IMPORT_ACCEPT } from './files';

const file = (name: string, content: BlobPart = 'x') =>
  new File([content], name);

describe('importKindOf', () => {
  it('tells the formats apart by the end of the name, ignoring case', () => {
    expect(importKindOf('order.mkmodel.json')).toBe('model');
    expect(importKindOf('Case.MKBUNDLE')).toBe('bundle');
    expect(importKindOf('bpmn-1.0.0.mktool')).toBe('tool');
    expect(importKindOf('notes.json')).toBeNull();
    expect(importKindOf('mkbundle')).toBeNull();
  });

  it('lists the extensions for the file chooser', () => {
    expect(IMPORT_ACCEPT).toBe('.mkmodel.json,.mkbundle,.mktool');
  });
});

describe('importFiles', () => {
  it('uses the importer for each kind and keeps the order', async () => {
    const calls: string[] = [];
    const results = await importFiles(
      [
        file('a.mktool', new Uint8Array([1, 2])),
        file('b.mkmodel.json', '{"a":1}'),
        file('c.mkbundle'),
      ],
      {
        model: async (text, name) => {
          calls.push(`model ${name} ${text}`);
          return 'm';
        },
        bundle: async (bytes, name) => {
          calls.push(`bundle ${name} ${bytes.length}`);
          return 7;
        },
        tool: async (bytes, name) => {
          calls.push(`tool ${name} ${[...bytes].join(',')}`);
          return true;
        },
      },
    );
    expect(calls).toEqual([
      'tool a.mktool 1,2',
      'model b.mkmodel.json {"a":1}',
      'bundle c.mkbundle 1',
    ]);
    expect(results).toEqual([
      { fileName: 'a.mktool', kind: 'tool', ok: true, value: true },
      { fileName: 'b.mkmodel.json', kind: 'model', ok: true, value: 'm' },
      { fileName: 'c.mkbundle', kind: 'bundle', ok: true, value: 7 },
    ]);
  });

  it('reports a failing file and an unknown file without stopping the rest', async () => {
    const results = await importFiles(
      [file('x.txt'), file('bad.mkbundle'), file('ok.mkmodel.json')],
      {
        model: async () => 'ok',
        bundle: async () => {
          throw new Error('This is not a valid zip file.');
        },
        tool: async () => null,
      },
    );
    expect(results[0]).toMatchObject({ ok: false, kind: null });
    expect((results[0] as { message: string }).message).toContain(
      'not a file MetaKit can import',
    );
    expect(results[1]).toEqual({
      fileName: 'bad.mkbundle',
      kind: 'bundle',
      ok: false,
      message: 'This is not a valid zip file.',
    });
    expect(results[2]).toMatchObject({ ok: true, value: 'ok' });
  });
});
