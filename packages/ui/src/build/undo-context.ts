import { getContext, setContext } from 'svelte';
import { offerUndo, toasts, type UndoSource } from '../shell/feedback';

const KEY = Symbol('build-undo');

/** Called by the Build view so the editors inside it can offer Undo after a step. */
export function provideBuildUndo(source: () => UndoSource | null) {
  setContext(KEY, source);
}

/**
 * Returns a function that shows `text` with Undo for the step just made in the tool library.
 * Call it while the component starts, like any context.
 */
export function useBuildUndo(): (text: string) => void {
  const source = getContext<(() => UndoSource | null) | undefined>(KEY);
  return (text) => {
    const s = source?.();
    if (s) offerUndo(text, s);
    else toasts.show(text);
  };
}
