# ADR 0008: The optional assistant

Status: proposed (Danial to review)

## Decisions

1. **Off by default, bring your own key.** The key is kept only in IndexedDB (rule 9) and is never logged.
2. **Provider interface.** `AssistantProvider` with Claude first, through `@anthropic-ai/sdk` in browser mode (`dangerouslyAllowBrowser`), loaded lazily when the assistant is on. Approved dependency.
3. **Tool definitions only.** Prompts hold the meta-model summary, the target schema or declarations and the person's sentence. A guard and a test make sure no model content leaves the browser.
4. **Validate before showing.** Schema, formula parse, script compile and type check; one retry with the errors, then show the draft with its errors.
5. **Accept through commands.** A draft is a change the person accepts or discards; accepting is one undo step.

## Consequences

- A draft is a suggestion; the person reviews it. The assistant cannot run scripts or touch models.
- The browser makes the request, so the key is exposed to the page. That is the point of "your own key"; the settings page says so.
