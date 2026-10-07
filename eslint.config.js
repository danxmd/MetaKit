import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', 'docs/', 'openspec/', '.claude/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    files: ['apps/web/**/*.{ts,svelte}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['**/*.{js,ts}'],
    ignores: ['apps/web/**', 'spikes/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['spikes/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Packages must stay free of DOM and UI code (architecture rule 5).
    files: ['packages/**/*.ts'],
    languageOptions: { globals: { ...globals.es2021 } },
  },
);
