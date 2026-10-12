# Design

- **Content** lives in `packages/docs/content/<category>/<topic-id>.md`. Front matter: `id`, `title`, `category`, `summary`, `keywords: [a, b]`, `contexts: [build.classes]`, `order`. Topic ids are unique across categories.
- **Contexts** are the page ids the app reports (list in `packages/docs/src/contexts.ts`): `start`, `models`, `kits`, `model`, `build.classes`, `build.relations`, `build.modelTypes`, `build.shapes`, `build.rules`, `build.scripts`, `build.settings`, `build.appearance`, `build.panel-layout`, `build.shape-editor`, `docs`, `settings.git`, `settings.assistant`, `settings.profile`, `dialog.*`, `git.*`. A test fails when a context has no topic.
- **Markdown subset**: headings (`##`, `###`), paragraphs, bullet and numbered lists, tables, code fences, block quotes (used for Tip / Note / Warning), bold, italic, inline code, external links, `[[topic]]` links. No raw HTML.
- **Keyword links**: each topic lists keywords; in another topic's text the first mention of a keyword outside code and headings becomes a link. `[[...]]` links are explicit and always kept.
- **Loader**: `import.meta.glob` at build time, so the content is part of the static app; the Docs code and content load lazily when the side bar or the Documentation area opens.
- **UI**: `DocsPanel` (side bar) and `DocsPage` (full area) share a `DocsReader` component. The current context is set by the views through a small `docsContext` store.
- **Checks**: unit tests in `packages/docs` fail on broken links, duplicate ids or keywords pointing at nothing, topics without summary, and contexts without topic.
