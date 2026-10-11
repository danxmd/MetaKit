import { getContext, setContext, type Snippet } from 'svelte';

/**
 * What the open model or Kit shows in the top bar (ui-coherence): its name for the last crumb,
 * and its save status and people. The view owns both, so the top bar never imports model code,
 * and the canvas does not re-render when the status changes.
 */
export interface DocumentBar {
  /** The name as the view knows it now; it follows renames made by others. */
  name: string;
  /** Save or sync status and the people in the document. */
  status: Snippet;
}

/** Shows a view's bar; the returned function takes it away again. */
export type ShowDocumentBar = (bar: DocumentBar) => () => void;

const KEY = Symbol('document-bar');

/** Called by the app, which passes what the views show on to the top bar. */
export function provideDocumentBar(show: ShowDocumentBar) {
  setContext(KEY, show);
}

/** Called by a view while it starts; outside the app (a test harness) nothing is shown. */
export function useDocumentBar(): ShowDocumentBar {
  return getContext<ShowDocumentBar | undefined>(KEY) ?? (() => () => {});
}
