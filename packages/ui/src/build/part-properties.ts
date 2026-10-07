import type { PartType } from '@metakit-app/core';

export type PropertyKind =
  'number' | 'dim' | 'text' | 'colour' | 'bool' | 'choice' | 'formula';

export interface PropertySpec {
  /** Path of the property in the part, such as `fill` or `font.size`. */
  prop: string;
  label: string;
  kind: PropertyKind;
  /** Whether the *fx* switch is offered; some properties can only hold a fixed value. */
  fx: boolean;
  /** The value shown when the property is not set, and used when *fx* is switched off. */
  fallback: unknown;
  choices?: { value: string; label: string }[];
  /** A colour property that can use the "Colour by attribute" helper. */
  helper?: 'colour';
  min?: number;
  max?: number;
  step?: number;
  /** The heading it is listed under. */
  section: 'Position and size' | 'Look' | 'Text' | 'Image' | 'Behaviour';
}

const dim = (
  prop: string,
  label: string,
  fallback: number | string,
): PropertySpec => ({
  prop,
  label,
  kind: 'dim',
  fx: true,
  fallback,
  section: 'Position and size',
});

const POSITION: PropertySpec[] = [
  dim('x', 'X', 0),
  dim('y', 'Y', 0),
  dim('width', 'Width', '100%'),
  dim('height', 'Height', '100%'),
];

const colour = (
  prop: string,
  label: string,
  fallback: string,
  section: PropertySpec['section'] = 'Look',
): PropertySpec => ({
  prop,
  label,
  kind: 'colour',
  fx: true,
  fallback,
  helper: 'colour',
  section,
});

const LOOK_STROKE: PropertySpec[] = [
  colour('stroke', 'Line colour', '#364FC7'),
  {
    prop: 'strokeWidth',
    label: 'Line width',
    kind: 'number',
    fx: true,
    fallback: 1,
    min: 0,
    step: 0.5,
    section: 'Look',
  },
];

const OPACITY: PropertySpec = {
  prop: 'opacity',
  label: 'Opacity',
  kind: 'number',
  fx: true,
  fallback: 1,
  min: 0,
  max: 1,
  step: 0.1,
  section: 'Look',
};

const ROTATE: PropertySpec = {
  prop: 'transform.rotate',
  label: 'Rotation (degrees)',
  kind: 'number',
  fx: true,
  fallback: 0,
  step: 1,
  section: 'Look',
};

const BEHAVIOUR: PropertySpec[] = [
  {
    prop: 'visible',
    label: 'Visible',
    kind: 'bool',
    fx: true,
    fallback: true,
    section: 'Behaviour',
  },
  {
    prop: 'tooltip',
    label: 'Tooltip',
    kind: 'text',
    fx: true,
    fallback: '',
    section: 'Behaviour',
  },
  {
    prop: 'onClick',
    label: 'When clicked',
    kind: 'formula',
    fx: true,
    fallback: '= open(Owner)',
    section: 'Behaviour',
  },
];

const choice = (
  prop: string,
  label: string,
  values: string[],
  fallback: string,
  fx: boolean,
  section: PropertySpec['section'] = 'Text',
): PropertySpec => ({
  prop,
  label,
  kind: 'choice',
  fx,
  fallback,
  choices: values.map((value) => ({
    value,
    label: value[0]!.toUpperCase() + value.slice(1),
  })),
  section,
});

const FILL: PropertySpec = colour('fill', 'Fill colour', '#E7F5FF');

/** The properties the editor offers for each part type, in the order of the panel. */
export function propertiesFor(type: PartType): PropertySpec[] {
  switch (type) {
    case 'rect':
      return [
        ...POSITION,
        FILL,
        ...LOOK_STROKE,
        {
          prop: 'radius',
          label: 'Corner radius',
          kind: 'number',
          fx: true,
          fallback: 0,
          min: 0,
          section: 'Look',
        },
        OPACITY,
        ROTATE,
        ...BEHAVIOUR,
      ];
    case 'ellipse':
    case 'polygon':
      return [...POSITION, FILL, ...LOOK_STROKE, OPACITY, ROTATE, ...BEHAVIOUR];
    case 'path':
      return [
        ...POSITION,
        {
          prop: 'd',
          label: 'Path data',
          kind: 'text',
          fx: false,
          fallback: '',
          section: 'Look',
        },
        FILL,
        ...LOOK_STROKE,
        OPACITY,
        ROTATE,
        ...BEHAVIOUR,
      ];
    case 'text':
      return [
        ...POSITION,
        {
          prop: 'text',
          label: 'Text',
          kind: 'text',
          fx: true,
          fallback: 'Text',
          section: 'Text',
        },
        colour('font.color', 'Text colour', '#212529', 'Text'),
        {
          prop: 'font.size',
          label: 'Font size',
          kind: 'number',
          fx: true,
          fallback: 12,
          min: 1,
          section: 'Text',
        },
        choice(
          'font.weight',
          'Font weight',
          ['normal', 'bold'],
          'normal',
          true,
        ),
        choice(
          'font.style',
          'Font style',
          ['normal', 'italic'],
          'normal',
          true,
        ),
        choice('align', 'Align', ['left', 'center', 'right'], 'left', false),
        choice(
          'valign',
          'Vertical align',
          ['top', 'middle', 'bottom'],
          'top',
          false,
        ),
        {
          prop: 'wrap',
          label: 'Wrap lines',
          kind: 'bool',
          fx: false,
          fallback: true,
          section: 'Text',
        },
        choice(
          'fit',
          'When too long',
          ['none', 'shrink', 'clip'],
          'none',
          false,
        ),
        OPACITY,
        ROTATE,
        ...BEHAVIOUR,
      ];
    case 'image':
      return [
        ...POSITION,
        {
          prop: 'src',
          label: 'Image source',
          kind: 'text',
          fx: true,
          fallback: '',
          section: 'Image',
        },
        choice(
          'fit',
          'Fit',
          ['contain', 'cover', 'stretch'],
          'contain',
          false,
          'Image',
        ),
        OPACITY,
        ROTATE,
        ...BEHAVIOUR,
      ];
    case 'group':
      return [...POSITION, OPACITY, ...BEHAVIOUR];
    case 'use':
      return [...POSITION, ...BEHAVIOUR];
  }
}
