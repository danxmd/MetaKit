// Vite turns a `?url` import into the address of the built file.
declare module '@jitl/quickjs-wasmfile-release-sync/wasm?url' {
  const url: string;
  export default url;
}
