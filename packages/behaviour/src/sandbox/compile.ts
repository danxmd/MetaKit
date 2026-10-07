/** One problem found while compiling a script, with a 1-based position in the source. */
export interface ScriptDiagnostic {
  message: string;
  line: number;
  column: number;
}

export type CompileResult = { js: string } | { errors: ScriptDiagnostic[] };

/**
 * TypeScript to JavaScript, on save. Sucrase only strips types, so it is fast and does not check
 * them (the editor's language service does). Imports become `require("metakit")` calls, which the
 * sandbox answers; modern syntax is left alone because QuickJS runs it, which also keeps the line
 * numbers of the source and of error messages the same.
 *
 * The compiler is loaded on first use, so an app without scripts never downloads it.
 */
export async function compileScript(source: string): Promise<CompileResult> {
  const { transform } = await import('sucrase');
  try {
    const { code } = transform(source, {
      transforms: ['typescript', 'imports'],
      disableESTransforms: true,
      production: true,
    });
    return { js: code };
  } catch (error) {
    return { errors: [diagnosticOf(error)] };
  }
}

function diagnosticOf(error: unknown): ScriptDiagnostic {
  const e = error as {
    message?: unknown;
    loc?: { line?: number; column?: number };
  };
  const text = typeof e.message === 'string' ? e.message : String(error);
  // Sucrase writes the position into the message: "Unexpected token (3:5)".
  const found = /\((\d+):(\d+)\)\s*$/.exec(text);
  const line = e.loc?.line ?? (found ? Number(found[1]) : 1);
  // Sucrase counts columns from 0.
  const column = (e.loc?.column ?? (found ? Number(found[2]) : 0)) + 1;
  return {
    message: text.replace(/\s*\(\d+:\d+\)\s*$/, ''),
    line,
    column,
  };
}
