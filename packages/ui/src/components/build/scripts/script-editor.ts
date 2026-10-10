import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  startCompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import {
  bracketMatching,
  defaultHighlightStyle,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import {
  forceLinting,
  lintGutter,
  linter,
  type Diagnostic,
} from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  hoverTooltip,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import type { LanguageClient } from './script-language-client';

export interface ScriptEditorOptions {
  parent: HTMLElement;
  source: string;
  client: LanguageClient;
  /** Called after every edit, with the whole text. */
  onChange(source: string): void;
}

export interface ScriptEditorHandle {
  readonly view: EditorView;
  /** The text now in the editor. */
  text(): string;
  /** Replaces the whole text, for a change that came from outside (an undo of the Kit). */
  setText(text: string): void;
  /** Asks the language service to look at the text again, for example after the declarations changed. */
  recheck(): void;
  /** Opens the completion list, as Ctrl+Space does. */
  complete(): void;
  focus(): void;
  destroy(): void;
}

/**
 * The default highlight style has light-mode colours only. The same colours are mixed with the
 * theme's lift colour (--syn-keep / --syn-lift, set where the editor is mounted) so they stay
 * readable in dark mode.
 */
const themedHighlight = HighlightStyle.define(
  defaultHighlightStyle.specs.map((spec) =>
    typeof spec.color === 'string'
      ? {
          ...spec,
          color: `color-mix(in srgb, ${spec.color} var(--syn-keep, 100%), var(--syn-lift, #fff))`,
        }
      : spec,
  ),
);

const lineOf = (text: string, info: string): HTMLElement => {
  const box = document.createElement('div');
  box.className = 'cm-ts-info';
  const code = document.createElement('div');
  code.className = 'cm-ts-info-code';
  code.textContent = text;
  box.append(code);
  if (info) {
    const docs = document.createElement('div');
    docs.className = 'cm-ts-info-docs';
    docs.textContent = info;
    box.append(docs);
  }
  return box;
};

/**
 * A CodeMirror 6 editor for TypeScript scripts, with errors, completions and hover text from the
 * language service in the worker. Everything here is lazy: the Svelte component imports this
 * module only when an editor opens.
 */
export function createScriptEditor(
  options: ScriptEditorOptions,
): ScriptEditorHandle {
  const { client } = options;

  async function complete(
    context: CompletionContext,
  ): Promise<CompletionResult | null> {
    const before = context.state.sliceDoc(
      Math.max(0, context.pos - 1),
      context.pos,
    );
    // Without a request from the person, complete only where typing suggests it.
    if (!context.explicit && !/[\w$.'"-]/.test(before)) return null;
    const source = context.state.doc.toString();
    const found = await client.completions(source, context.pos);
    if (!found || found.items.length === 0 || context.aborted) return null;
    return {
      from: found.from,
      validFor: /^[^'"`\s]*$/,
      options: found.items.map((item, rank) => ({
        label: item.label,
        type: item.type,
        // The compiler's own order: locals before globals, then alphabetical.
        boost: -rank / found.items.length,
        info: async () => {
          const d = await client.details(source, context.pos, item.label);
          return d && (d.text || d.docs) ? lineOf(d.text, d.docs) : null;
        },
      })),
    };
  }

  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.source,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        syntaxHighlighting(themedHighlight),
        javascript({ typescript: true }),
        lintGutter(),
        linter(
          async (v): Promise<Diagnostic[]> => {
            const found = await client.diagnostics(v.state.doc.toString());
            const length = v.state.doc.length;
            return found.map((d) => ({
              from: Math.min(d.from, length),
              to: Math.min(Math.max(d.to, d.from), length),
              severity: d.severity,
              message: d.message,
              source: `TS${d.code}`,
              ...(d.deprecated ? { markClass: 'cm-deprecated' } : {}),
            }));
          },
          { delay: 300 },
        ),
        autocompletion({ override: [complete] }),
        hoverTooltip(
          async (v, pos) => {
            const info = await client.quickInfo(v.state.doc.toString(), pos);
            if (!info || !info.text) return null;
            return {
              pos: info.from,
              end: info.to,
              above: true,
              create: () => ({ dom: lineOf(info.text, info.docs) }),
            };
          },
          { hideOnChange: true },
        ),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onChange(update.state.doc.toString());
        }),
        EditorView.contentAttributes.of({
          'aria-label': 'Script source',
          spellcheck: 'false',
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '0.88rem',
            backgroundColor: 'var(--surface)',
            color: 'var(--text)',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--surface-2)',
            color: 'var(--text-faint)',
            border: 'none',
            borderRight: '1px solid var(--line)',
          },
          '.cm-activeLine': { backgroundColor: 'var(--hover-bg)' },
          '.cm-activeLineGutter': { backgroundColor: 'var(--surface-3)' },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
            { backgroundColor: 'var(--accent-soft)' },
          '.cm-cursor': { borderLeftColor: 'var(--text)' },
          '.cm-tooltip': {
            backgroundColor: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-s)',
          },
          '.cm-tooltip-autocomplete ul li[aria-selected]': {
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--text)',
          },
          '.cm-scroller': { fontFamily: 'var(--font-mono)' },
          '.cm-content': { minHeight: '12rem' },
          '.cm-ts-info': { maxWidth: '36rem', padding: '0.25rem 0.4rem' },
          '.cm-ts-info-code': {
            fontFamily: 'ui-monospace, Consolas, monospace',
            whiteSpace: 'pre-wrap',
          },
          '.cm-ts-info-docs': { marginTop: '0.25rem', opacity: '0.8' },
          '.cm-deprecated': { textDecoration: 'line-through' },
        }),
      ],
    }),
  });

  return {
    view,
    text: () => view.state.doc.toString(),
    setText: (text) =>
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      }),
    recheck: () => forceLinting(view),
    complete: () => void startCompletion(view),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
