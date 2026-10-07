import type { ClassDef } from '@metakit-app/core';

const FILLS = [
  '#eef4ff',
  '#fff4e6',
  '#ebfbee',
  '#f3f0ff',
  '#fff0f6',
  '#e3fafc',
] as const;

/** A stable pastel fill per class, so classes can be told apart without any shape setup. */
export function fillFor(cls: ClassDef): string {
  let h = 0;
  for (let i = 0; i < cls.key.length; i++)
    h = (h * 31 + cls.key.charCodeAt(i)) >>> 0;
  return FILLS[h % FILLS.length]!;
}

export const STROKE = '#364fc7';
export const CONNECTOR_COLOR = '#6b7a90';
export const SELECT_COLOR = '#e8590c';
export const TEXT_COLOR = '#212529';
