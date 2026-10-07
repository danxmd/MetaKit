import type { TypeCheck } from '@metakit-app/assistant';
import type { LanguageClient } from '../components/build/scripts/script-language-client';
import type {
  EditorDiagnostic,
  LanguageServer,
} from '../components/build/scripts/script-language';

/** "line 6: ..." for each error the language service found; warnings and hints are left out. */
export function diagnosticLines(
  source: string,
  diagnostics: readonly EditorDiagnostic[],
): string[] {
  return diagnostics
    .filter((d) => d.severity === 'error')
    .map((d) => {
      const line = source.slice(0, d.from).split('\n').length;
      return `line ${line}: ${d.message}`;
    });
}

/** A type check on a language service that runs in this thread (tests, Node). */
export function typeCheckWithServer(server: LanguageServer): TypeCheck {
  return async (source, declarations) => {
    server.setDeclarations(declarations);
    return diagnosticLines(source, server.diagnostics(source));
  };
}

/**
 * A type check on the language worker the script editor uses. A client is made for the check and
 * closed afterwards, so the worker is loaded only when a script is drafted.
 */
export function typeCheckWithClient(
  create: () => LanguageClient | Promise<LanguageClient>,
): TypeCheck {
  return async (source, declarations) => {
    const client = await create();
    try {
      await client.declarations(declarations);
      return diagnosticLines(source, await client.diagnostics(source));
    } finally {
      client.dispose();
    }
  };
}
