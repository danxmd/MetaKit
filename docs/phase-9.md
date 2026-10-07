# Phase 9: AI assistant (lane A, week 18)

Phase 9 adds an optional assistant that drafts rules, scripts, shapes and classes from a plain description. It is off by default and uses the person's own API key.

**Before starting:** plan section "Behaviour", Assistant.

## 9.1 Settings and provider (`packages/assistant`)

Deliver:

- A settings page to turn the assistant on, enter and test an API key, and remove it. The key is kept only in IndexedDB and never written to the workspace, repository, logs or tests.
- A provider interface, with Claude as the first provider using Anthropic's TypeScript SDK in browser mode (`dangerouslyAllowBrowser`).
- A clear notice of what is sent: tool definitions, never models.

Done when: the key can be added, tested and removed, and a test checks that no model content leaves the browser.

## 9.2 Drafting (`packages/assistant`, `packages/ui`)

Deliver:

- A "Draft with assistant" entry in the rule, script, shape and class editors.
- Prompts that include the tool's meta-model and the target format's schema.
- Validation of every draft before showing it (schema check, formula parse, script compile); invalid drafts are retried once, then shown with the errors.
- The draft shown as a change to accept or discard; accepting applies it through commands, so it can be undone.

Done when: the rule, shape and script examples in the plan can each be drafted from a one-sentence description and pass validation.

## Out of scope

Other providers (later, behind the same interface), sending model content, chat inside the canvas.
