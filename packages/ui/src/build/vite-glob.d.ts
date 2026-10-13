// The lazy form of Vite's glob import, declared here so the package needs no Vite types. Each
// matched file becomes its own chunk, loaded when its function is called.
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: '?raw'; import: 'default' },
  ): Record<string, () => Promise<string>>;
}
