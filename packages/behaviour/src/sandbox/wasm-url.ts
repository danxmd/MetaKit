// Only imported in a browser, and only when a tool has scripts: Vite emits the WebAssembly file as
// an asset and gives its address here, so it is downloaded when the first sandbox starts.
import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url';

export { wasmUrl };
