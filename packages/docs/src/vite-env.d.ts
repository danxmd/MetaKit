// The one Vite feature the package uses, declared here so the package needs no Vite types.
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: '?raw'; import: 'default'; eager: true },
  ): Record<string, string>;
}
