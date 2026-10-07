import ts from 'typescript';

/**
 * The TypeScript language service for the script editor, as plain functions. It runs inside a Web
 * Worker in the app (script-language-worker.ts) and directly in tests. It knows three files: the
 * script, the declarations generated from the tool (the `metakit` module), and the few globals a
 * script has (the console). Nothing here touches the DOM.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface EditorDiagnostic {
  from: number;
  to: number;
  severity: DiagnosticSeverity;
  message: string;
  code: number;
}

export interface EditorCompletion {
  label: string;
  /** The kind as CodeMirror names it: function, variable, property, class, type, keyword, text. */
  type: string;
  sortText: string;
  /** Plain text such as `(property) Priority: "Low" | "Medium"`, filled in by `details`. */
  detail?: string;
}

export interface EditorCompletions {
  /** Start of the word being completed. */
  from: number;
  items: EditorCompletion[];
}

export interface EditorInfo {
  from: number;
  to: number;
  /** The signature or type, as plain text. */
  text: string;
  /** What the documentation says, as plain text. */
  docs: string;
}

export interface LanguageServer {
  setDeclarations(text: string): void;
  diagnostics(source: string): EditorDiagnostic[];
  completions(source: string, position: number): EditorCompletions | null;
  details(source: string, position: number, name: string): EditorInfo | null;
  quickInfo(source: string, position: number): EditorInfo | null;
}

const SCRIPT = '/script.ts';
const DECLARATIONS = '/metakit.d.ts';
const GLOBALS = '/globals.d.ts';
const DEFAULT_LIB = '/lib/lib.es2022.d.ts';

/** What exists inside the sandbox besides the language: the console. Timers and the like do not. */
const GLOBAL_DECLARATIONS = `
declare const console: {
  log(...values: unknown[]): void;
  info(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
  debug(...values: unknown[]): void;
};
`;

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  // Every script is a module, so top-level `await` and `import` work whether or not it imports.
  moduleDetection: ts.ModuleDetectionKind.Force,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  allowJs: false,
};

const severityOf = (c: ts.DiagnosticCategory): DiagnosticSeverity =>
  c === ts.DiagnosticCategory.Error
    ? 'error'
    : c === ts.DiagnosticCategory.Warning
      ? 'warning'
      : 'info';

const kindOf = (kind: string): string => {
  switch (kind) {
    case 'function':
    case 'method':
    case 'construct':
      return 'function';
    case 'property':
    case 'getter':
    case 'setter':
      return 'property';
    case 'class':
      return 'class';
    case 'interface':
    case 'type':
    case 'enum':
    case 'type parameter':
      return 'type';
    case 'keyword':
      return 'keyword';
    case 'string':
      return 'text';
    case 'module':
    case 'alias':
      return 'namespace';
    default:
      return 'variable';
  }
};

const plain = (parts: readonly ts.SymbolDisplayPart[] | undefined): string =>
  ts.displayPartsToString([...(parts ?? [])]);

export function createLanguageServer(
  libs: Record<string, string>,
): LanguageServer {
  const files = new Map<string, { text: string; version: number }>([
    [GLOBALS, { text: GLOBAL_DECLARATIONS, version: 1 }],
    [DECLARATIONS, { text: '', version: 0 }],
    [SCRIPT, { text: '', version: 0 }],
  ]);
  const setFile = (name: string, text: string): void => {
    const known = files.get(name);
    if (known && known.text === text) return;
    files.set(name, { text, version: (known?.version ?? 0) + 1 });
  };
  const read = (name: string): string | undefined =>
    files.get(name)?.text ?? libs[name];

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [GLOBALS, DECLARATIONS, SCRIPT],
    getScriptVersion: (name) => String(files.get(name)?.version ?? 1),
    getScriptSnapshot: (name) => {
      const text = read(name);
      return text === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => OPTIONS,
    getDefaultLibFileName: () => DEFAULT_LIB,
    fileExists: (name) => read(name) !== undefined,
    readFile: read,
    directoryExists: () => true,
    getDirectories: () => [],
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  return {
    setDeclarations: (text) => setFile(DECLARATIONS, text),

    diagnostics(source) {
      setFile(SCRIPT, source);
      return [
        ...service.getSyntacticDiagnostics(SCRIPT),
        ...service.getSemanticDiagnostics(SCRIPT),
      ].map((d) => {
        const from = d.start ?? 0;
        return {
          from,
          to: from + Math.max(d.length ?? 1, 1),
          severity: severityOf(d.category),
          message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
          code: d.code,
        };
      });
    },

    completions(source, position) {
      setFile(SCRIPT, source);
      const result = service.getCompletionsAtPosition(SCRIPT, position, {
        includeCompletionsForModuleExports: false,
        includeCompletionsWithInsertText: false,
      });
      if (!result) return null;
      // Inside quotes the whole text is the word ("object.cre"); elsewhere an identifier is.
      const inText =
        result.entries.length > 0 &&
        result.entries.every((e) => e.kind === 'string');
      const part = inText ? /[^'"`\n]/ : /[\w$]/;
      let from = position;
      while (from > 0 && part.test(source[from - 1] ?? '')) from--;
      return {
        from,
        items: result.entries.map((e) => ({
          label: e.name,
          type: kindOf(e.kind),
          sortText: e.sortText,
        })),
      };
    },

    details(source, position, name) {
      setFile(SCRIPT, source);
      const d = service.getCompletionEntryDetails(
        SCRIPT,
        position,
        name,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      if (!d) return null;
      return {
        from: position,
        to: position,
        text: plain(d.displayParts),
        docs: plain(d.documentation),
      };
    },

    quickInfo(source, position) {
      setFile(SCRIPT, source);
      const info = service.getQuickInfoAtPosition(SCRIPT, position);
      if (!info) return null;
      return {
        from: info.textSpan.start,
        to: info.textSpan.start + info.textSpan.length,
        text: plain(info.displayParts),
        docs: plain(info.documentation),
      };
    },
  };
}
