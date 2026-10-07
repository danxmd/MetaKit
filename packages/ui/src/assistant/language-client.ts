// Starts the TypeScript language worker that the script editor also uses, for the assistant's
// type check of drafted scripts. Imported with import() so the worker is not downloaded at start.
export { startLanguageClient } from '../components/build/scripts/start-worker';
