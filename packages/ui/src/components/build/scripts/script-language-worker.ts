// Runs in a Web Worker: the TypeScript language service for the script editor. It starts only when
// a script editor opens, so the compiler and the library declarations are never in the main page.
import { createLanguageServer } from './script-language';
import { TS_LIBS } from './ts-libs';
import type {
  LanguageRequest,
  LanguageResponse,
} from './script-language-client';

const server = createLanguageServer(TS_LIBS);

interface WorkerScope {
  onmessage: ((event: { data: LanguageRequest }) => void) | null;
  postMessage(message: LanguageResponse): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = ({ data }) => {
  try {
    let result: unknown = null;
    switch (data.op) {
      case 'declarations':
        server.setDeclarations(data.text);
        break;
      case 'diagnostics':
        result = server.diagnostics(data.source);
        break;
      case 'completions':
        result = server.completions(data.source, data.position);
        break;
      case 'details':
        result = server.details(data.source, data.position, data.name);
        break;
      case 'quickInfo':
        result = server.quickInfo(data.source, data.position);
        break;
    }
    scope.postMessage({ id: data.id, result });
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
