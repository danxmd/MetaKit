// The assistant's pieces for the app, behind one entry so that the app can import them without the
// whole package index (the Anthropic SDK itself is only fetched on the first draft or key test).
export { AssistantService, browserKeyValue } from './assistant-service';
export type { AssistantPort } from './assistant-service';
export { typeCheckWithClient } from './type-check';
