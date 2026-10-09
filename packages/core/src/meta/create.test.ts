import { describe, expect, it } from 'vitest';
import { sampleTool } from '../testing/sample-tool';
import { cloneToolLibrary, createEmptyTool } from './create';
import { validateToolLibrary } from './guards';
import { TOOL_FORMAT_VERSION } from './types';

const bpmn = sampleTool;

describe('cloneToolLibrary', () => {
  it('makes a new tool library that keeps all content and says where it came from', () => {
    const source = bpmn();
    const copy = cloneToolLibrary(source, 'Our processes');
    expect(copy.manifest.id).not.toBe(source.manifest.id);
    expect(copy.manifest.id).toMatch(/^tool_/);
    expect(copy.manifest.name).toBe('Our processes');
    expect(copy.manifest.version).toBe('1.0.0');
    expect(copy.manifest.basedOn).toEqual({
      id: source.manifest.id,
      name: source.manifest.name,
      version: source.manifest.version,
    });
    expect(copy.manifest.languages).toEqual(source.manifest.languages);
    expect(copy.formatVersion).toBe(TOOL_FORMAT_VERSION);
    for (const part of [
      'classes',
      'relations',
      'modelTypes',
      'shapes',
      'panels',
      'rules',
      'scripts',
      'settings',
    ] as const)
      expect(copy[part]).toEqual(source[part]);
    expect(validateToolLibrary(copy)).toEqual([]);
  });

  it('does not share anything with the original', () => {
    const source = bpmn();
    const before = JSON.stringify(source);
    const copy = cloneToolLibrary(source, 'Copy');
    const someClass = Object.values(copy.classes)[0]!;
    someClass.key = 'Changed';
    expect(JSON.stringify(source)).toBe(before);
  });

  it('records the direct original when a copy is copied again', () => {
    const first = cloneToolLibrary(createEmptyTool({ name: 'A' }), 'B');
    const second = cloneToolLibrary(first, 'C');
    expect(second.manifest.basedOn).toEqual({
      id: first.manifest.id,
      name: 'B',
      version: '1.0.0',
    });
  });
});

describe('manifest.basedOn', () => {
  const withOrigin = (basedOn: unknown) => {
    const tool = createEmptyTool({ name: 'T' }) as unknown as {
      manifest: Record<string, unknown>;
    };
    tool.manifest['basedOn'] = basedOn;
    return tool;
  };

  it('is optional and accepted when well formed', () => {
    expect(validateToolLibrary(createEmptyTool({ name: 'T' }))).toEqual([]);
    expect(
      validateToolLibrary(
        withOrigin({ id: 'tool_x', name: 'X', version: '1.2.0' }),
      ),
    ).toEqual([]);
  });

  it('reports a malformed origin', () => {
    const issues = validateToolLibrary(
      withOrigin({ id: 'nope', name: 3, extra: true }),
    );
    const paths = issues.map((i) => i.path);
    expect(paths).toContain('manifest.basedOn.id');
    expect(paths).toContain('manifest.basedOn.name');
    expect(paths).toContain('manifest.basedOn.version');
    expect(paths.some((p) => p.startsWith('manifest.basedOn'))).toBe(true);
  });
});
