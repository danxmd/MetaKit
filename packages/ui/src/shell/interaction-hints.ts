import type { ClassDef, RelationDef, ToolLibrary } from '@metakit-app/core';
import { describeEnds } from './suggestions';

/**
 * The hint line (interaction hints): one plain sentence for what the person is doing now. Pure, so
 * it is tested without a browser; the view only shows the text.
 */

export type HintState =
  | { kind: 'idle'; selected: number }
  | { kind: 'place'; class: ClassDef }
  | { kind: 'connect'; relation: RelationDef; picked: boolean }
  | { kind: 'palette-relation'; relation: RelationDef }
  | { kind: 'palette-class'; class: ClassDef }
  | { kind: 'connector'; relation: RelationDef; from: string; to: string }
  | { kind: 'refused'; reason: string };

export function hintFor(tool: ToolLibrary, state: HintState): string {
  switch (state.kind) {
    case 'idle':
      return state.selected === 0
        ? 'Choose a concept on the left and click on the canvas to place it. Drag from a concept to connect it.'
        : state.selected === 1
          ? 'Edit the attributes on the right. Drag the handles to resize. Delete removes it.'
          : `${state.selected} selected. Drag to move them together, or use Arrange to align them.`;
    case 'place':
      return `Click on the canvas to place a ${state.class.key}. Press Escape to stop.`;
    case 'connect':
      return state.picked
        ? `Now click the concept where the ${state.relation.key} should end. ${describeEnds(tool, state.relation)}`
        : `Click the concept where the ${state.relation.key} should start. ${describeEnds(tool, state.relation)}`;
    case 'palette-relation':
      return describeEnds(tool, state.relation);
    case 'palette-class': {
      const uses = Object.values(tool.relations).filter(
        (r) =>
          (!r.abstract &&
            (r.from.length === 0 ||
              r.from.some(
                (c) => c === state.class.id || tool.classes[c]?.abstract,
              ))) ||
          r.to.some((c) => c === state.class.id),
      );
      return uses.length === 0
        ? `${state.class.key}: click on the canvas to place it.`
        : `${state.class.key} can be connected with ${uses
            .map((r) => r.key)
            .sort()
            .join(', ')}.`;
    }
    case 'connector':
      return `${state.relation.key}: ${state.from} to ${state.to}. ${describeEnds(tool, state.relation)}`;
    case 'refused':
      return state.reason;
  }
}
