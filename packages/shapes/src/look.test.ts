import { describe, expect, it } from 'vitest';
import type { NodeLook, ShapeId, ToolLibrary } from '@metakit-app/core';
import { validateToolLibrary } from '@metakit-app/core';
import type { Scope, Value } from '@metakit-app/formula';
import { compileNode } from './compile';
import { compileRelation } from './relation';
import {
  LOOK_BASES,
  LOOK_ICONS,
  colourProp,
  defaultNodeLook,
  defaultRelationLook,
  lookAttributeKeys,
  lookDrivers,
  nodeShapeFromLook,
  readableOn,
  relationShapeFromLook,
  renameLookKey,
} from './look';

const scopeOf = (values: Record<string, Value>): Scope => ({
  get: (n) => (Object.hasOwn(values, n) ? values[n] : undefined),
});
const ID = 'shp_x' as ShapeId;

describe('every base form', () => {
  it.each(LOOK_BASES.map((b) => b.id))(
    '%s draws a body and the title',
    (base) => {
      const look = defaultNodeLook('node', base);
      const shape = nodeShapeFromLook(look, ID, 'Test');
      const { width, height } = look.size;
      const out = compileNode(shape, {
        w: width,
        h: height,
        scope: scopeOf({
          $label: 'Hello',
          $fill: '#fff',
          $fields: [] as never,
        }),
      });
      expect(out.messages).toEqual([]);
      expect(
        out.ops.some(
          (o) => o.op === 'rect' || o.op === 'ellipse' || o.op === 'polygon',
        ),
      ).toBe(true);
      const text = out.ops.filter((o) => o.op === 'text');
      expect(
        text.flatMap((o) =>
          o.op === 'text' ? o.lines.map((l) => l.text) : [],
        ),
      ).toContain('Hello');
      expect(shape.look).toEqual(look);
    },
  );

  it('keeps the shape valid in a tool library', () => {
    const shapes = Object.fromEntries(
      LOOK_BASES.map((b, i) => [
        `shp_${i}`,
        nodeShapeFromLook(
          defaultNodeLook('node', b.id),
          `shp_${i}` as ShapeId,
          b.label,
        ),
      ]),
    );
    const tool = {
      formatVersion: 5,
      manifest: {
        id: 'tool_t',
        name: 'T',
        version: '1.0.0',
        languages: ['en'],
      },
      settings: {},
      classes: {},
      relations: {},
      modelTypes: {},
      shapes,
      panels: {},
      rules: {},
      scripts: {},
    } as unknown as ToolLibrary;
    expect(
      validateToolLibrary(tool).filter((i) => i.path.startsWith('shapes')),
    ).toEqual([]);
  });
});

describe('colours that depend on data', () => {
  const look: NodeLook = {
    ...defaultNodeLook(),
    fill: {
      by: 'Status',
      values: { Done: '#d3f9d8', Failed: '#ffe3e3' },
      fallback: '#f1f3f5',
    },
  };
  const fillOf = (status: string) => {
    const out = compileNode(nodeShapeFromLook(look, ID), {
      w: 150,
      h: 70,
      scope: scopeOf({ $label: 'T', Status: status }),
    });
    const body = out.ops.find((o) => o.op === 'rect');
    return body?.op === 'rect' ? body.style.fill : null;
  };

  it('picks the colour of the value and the fallback for the rest', () => {
    expect(fillOf('Done')).toBe('#d3f9d8');
    expect(fillOf('Failed')).toBe('#ffe3e3');
    expect(fillOf('Planned')).toBe('#f1f3f5');
  });

  it('reads the attribute and tells the preview which values to show', () => {
    expect(lookAttributeKeys(look)).toEqual(['Status']);
    expect(lookDrivers(look)).toEqual([
      { attribute: 'Status', values: ['Done', 'Failed'] },
    ]);
  });

  it('writes a fixed colour as it is and handles yes/no attributes', () => {
    expect(colourProp('#123456')).toBe('#123456');
    expect(
      colourProp({ by: 'Active', values: { true: '#0f0' }, fallback: '#ccc' }),
    ).toContain('Active == true');
  });
});

describe('text, icon and badge', () => {
  it('shows an attribute as the title and fixed or attribute text as the subtitle', () => {
    const look: NodeLook = {
      ...defaultNodeLook(),
      title: { attribute: 'Name' },
      subtitle: { attribute: 'Status' },
    };
    const out = compileNode(nodeShapeFromLook(look, ID), {
      w: 150,
      h: 70,
      scope: scopeOf({ Name: 'Write spec', Status: 'Done' }),
    });
    const lines = out.ops.flatMap((o) =>
      o.op === 'text' ? o.lines.map((l) => l.text) : [],
    );
    expect(lines).toEqual(['Write spec', 'Done']);
  });

  it('draws an icon and a badge that appears only for its value', () => {
    const look: NodeLook = {
      ...defaultNodeLook(),
      icon: { name: 'bot' },
      badge: {
        attribute: 'Priority',
        equals: 'High',
        text: 'High',
        colour: '#e03131',
      },
    };
    const shape = nodeShapeFromLook(look, ID);
    const draw = (priority: string) =>
      compileNode(shape, {
        w: 150,
        h: 70,
        scope: scopeOf({ $label: 'T', Priority: priority }),
      }).ops;
    expect(draw('Low').some((o) => o.op === 'path')).toBe(true);
    const badgeRects = (ops: ReturnType<typeof draw>) =>
      ops.filter((o) => o.op === 'rect' && o.style.fill === '#e03131').length;
    expect(badgeRects(draw('High'))).toBe(1);
    expect(badgeRects(draw('Low'))).toBe(0);
    expect(Object.keys(LOOK_ICONS)).toContain('bot');
  });

  it('lists attributes inside a header box', () => {
    const look: NodeLook = {
      ...defaultNodeLook('node', 'header-box'),
      fields: ['Name', 'Type'],
    };
    const out = compileNode(nodeShapeFromLook(look, ID), {
      w: 170,
      h: 110,
      scope: scopeOf({ $label: 'Customer', Name: 'Anna', Type: 'text' }),
    });
    const lines = out.ops.flatMap((o) =>
      o.op === 'text' ? o.lines.map((l) => l.text) : [],
    );
    expect(lines).toEqual(expect.arrayContaining(['Name: Anna', 'Type: text']));
  });

  it('chooses readable text on light and dark fills', () => {
    expect(readableOn('#ffffff')).toBe('#1b1f27');
    expect(readableOn('#1c2a6b')).toBe('#ffffff');
    expect(readableOn({ by: 'x', values: {}, fallback: '#000000' })).toBe(
      '#ffffff',
    );
  });
});

describe('relation looks', () => {
  it('draws a dashed line with ends and a label', () => {
    const look = {
      ...defaultRelationLook(),
      style: 'dashed' as const,
      start: 'circle' as const,
      end: 'triangle' as const,
      label: { attribute: 'Condition' },
    };
    const shape = relationShapeFromLook(look, ID, 'Flow');
    expect(shape.line.dash).toEqual([7, 4]);
    expect(shape.startMarker?.type).toBe('circle');
    expect(shape.endMarker?.type).toBe('triangle');
    const out = compileRelation(shape, scopeOf({ Condition: 'approved' }));
    expect(out.messages).toEqual([]);
    expect(shape.look).toEqual(look);
  });

  it('has no marker for "none"', () => {
    const shape = relationShapeFromLook(
      { ...defaultRelationLook(), end: 'none' },
      ID,
    );
    expect(shape.endMarker).toBeUndefined();
  });
});

describe('renaming an attribute', () => {
  it('updates every use in the look, and the shape is drawn the same', () => {
    const look: NodeLook = {
      ...defaultNodeLook(),
      title: { attribute: 'Name' },
      fill: { by: 'Status', values: { Done: '#0f0' }, fallback: '#ccc' },
      badge: {
        attribute: 'Status',
        equals: 'Done',
        text: 'ok',
        colour: '#090',
      },
    };
    const renamed = renameLookKey(look, 'Status', 'State');
    expect(lookAttributeKeys(renamed).sort()).toEqual(['Name', 'State']);
    const draw = (l: NodeLook, key: string) =>
      compileNode(nodeShapeFromLook(l, ID), {
        w: 150,
        h: 70,
        scope: scopeOf({ $label: 'T', Name: 'N', [key]: 'Done' }),
      }).ops;
    expect(draw(renamed, 'State')).toEqual(draw(look, 'Status'));
  });
});
