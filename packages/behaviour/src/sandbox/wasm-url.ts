// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the only way to pull in the `?url` declaration for every program that sees this file
/// <reference path="../env.d.ts" />
// Only imported in a browser, and only when a tool has scripts: Vite emits the WebAssembly file as
// an asset and gives its address here, so it is downloaded when the first sandbox starts.
import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url';

export { wasmUrl };
