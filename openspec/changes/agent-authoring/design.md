# Design

## `packages/authoring`

This is a new package that depends only on `core`, `formula`, `shapes` and `storage` types. It has no DOM and runs in the browser, in a worker and in Node.

**Session**
- A session is a working copy of one or more documents: in-memory tool and model stores that are copies of the real ones, plus the workspace listing.
- `execute(op)` runs one operation against the copies and returns `{ ok, result | error, issues }`.
- Each document's changes are collected as one batch.
- `diff()` describes what was added, changed and removed per document, for the review.

**Operations.** Names are snake_case for agent tools; each has a JSON schema and a one-line description.

| Group | Operations |
| --- | --- |
| Read | `list_tool_libraries`, `read_tool_library` (summary or full), `list_models`, `read_model`, `format_guide`, `validate` |
| Tool library | `create_tool_library` (`from?`), `put_class`, `put_relation_class`, `remove_class`, `remove_relation_class`, `put_attribute`, `remove_attribute`, `set_look`, `put_model_type`, `put_rule`, `put_script`, `add_from_catalog` |
| Model | `create_model`, `add_objects`, `connect`, `set_attributes`, `remove`, `move`, `auto_layout` |

**How operations take their inputs**
- Classes and attributes are named by key.
- `set_look` takes the simple look fields: base, fill, icon, title, fields, colour by.
- Objects in one plan get a `ref` such as `"src1"` that later steps use. Existing objects are named by their label or by an id that `read_model` returned.
- Positions are optional. Objects without one are placed by `auto_layout`, which uses the ELK code that `applyLayout` uses in the browser and Node.

**Plans**
- A plan is `{ format: "metakit-plan", version: 1, goal, steps: [{ op, args }] }`.
- `runPlan(session, plan)` executes the steps in order and stops at the first failure, keeping the earlier steps.

**Translation to commands**
- Each operation maps to existing commands: `putClass`, `putAttribute`, `putShape`, `putRelation`, `putModelType`, `putRule` and `putScript` for tool libraries; the model commands for models; `applyLayout` for layout.
- `create_tool_library` with `from` uses `cloneToolLibrary` from `ai-data-catalog`. `add_from_catalog` uses `catalogCommands`.

**Tests (Node)**
- Every operation, and its errors.
- A plan that builds each of the three new built-in tools from scratch and validates the result.
- A model plan for each, then `validateModel`.

## Built-in agent

`packages/assistant` gets `runAgent({ provider, session, goal, scope, onStep, signal })`.

**The loop**
- It uses Claude's tool use. The operations are the tools, plus `finish(summary)`.
- Each tool result returns the outcome and any new validation issues.
- It stops at `finish`, at 30 steps, at a cost or token limit shown to the person, or on **Stop**.

**Prompts**
- The system prompt holds the format guide, the catalog topics, and a summary of the tool library.
- In Model mode it also holds the model, after the notice.

**Privacy**
- `assertNoModelContent` stays for the existing drafts.
- A new `assertConsented(modelId)` guards every request that carries model content. Consent is kept per model in IndexedDB.

**UI** (`components/assistant/AgentPanel.svelte`, a side panel that opens from the entry points)
- **Entry points:**
  - On the Tool libraries page, **Create with assistant**: a goal box, plus Start from (*From scratch* or *Extend …*).
  - In Build mode, **Ask the assistant** in the bar.
  - In Model mode, **Ask the assistant** in the Edit menu and on the toolbar.
- **Progress:** each step is a line, such as "Added class Data contract", with a live count and **Stop**.
- **Review:**
  - grouped lists of added, changed and removed items
  - the problems, with a link to each
  - for tool libraries, **Try it**, which opens the existing preview on the working copy
  - **Accept**, **Discard**, and **Keep going…** to send a follow-up instruction on the same working copy

  Accepting runs one batch per document on the real stores. A new tool library is created first.

## MCP bridge

`apps/cli/src/mcp.ts` provides `metakit mcp <folder> [--write] [--name Agent]`.

**Protocol**
- MCP over stdio: JSON-RPC 2.0, one message per line.
- Handled methods:
  - `initialize`, `notifications/initialized`, `ping`
  - `tools/list`: the operations and their schemas
  - `tools/call`
  - `resources/list` and `resources/read`: the format guide, plus each tool library and model as JSON
- Logs go to stderr only.

**How it works on the folder**
- It opens the workspace with `NodeFsAdapter` as its own instance. The instance id is stored under `_state/`, not reused across folders, like a browser tab's.
- It takes part in presence under the given name, so people see "Agent" in the people list.
- Each write call is one batch per document, written as its own change file.

**Safety**
- Without `--write`, writing operations fail with a clear message.
- Each write result tells the agent how to take it back: an `undo_last` operation reverts the bridge's own last step through the store's undo for its instance.
- The README and help topic warn that model content can contain instructions from other people (prompt injection). They recommend `--write` only for workspaces you trust.

**Setup steps** (help topic)
- **Claude Desktop:** a `claude_desktop_config.json` entry `{ "command": "npx", "args": ["metakit", "mcp", "<folder>", "--write"] }`. Locally the path is `node apps/cli/dist/bin.js` until the CLI is published.
- **Claude Code:** `claude mcp add metakit -- node <path>/bin.js mcp <folder>`.
- **ChatGPT:** use the bridge if your ChatGPT app can start local MCP servers; otherwise use the paste route.

## Paste route

`components/assistant/OutsideAiDialog.svelte` has two steps.

**1. Copy brief for an AI**
- A goal box and **Copy**. The clipboard gets a Markdown prompt:
  - the role
  - the goal
  - the plan format with its JSON schema and one worked example
  - the operations and their arguments
  - the current tool library summary, plus the model after the notice
  - "Answer with one JSON code block"

**2. Paste the AI's answer**
- A text box. MetaKit extracts the first JSON block, checks the plan's schema, runs it on a working copy, and opens the same review as the built-in agent.
- Errors name the step.
- **Copy the errors for the AI** puts a follow-up prompt on the clipboard, so a second round is easy.

## ADR 0011

ADR 0011 records four things:
- The assistant may now send model content after a per-model notice, and may build whole tool libraries. This replaces decision 3 and "cannot touch models" in ADR 0008.
- Plans and operations are the single agent interface.
- The MCP bridge is a local program started by the person, so rule 1 (no server) holds.
- The bridge writes as its own instance (rule 6), and secrets are not involved (rule 9).

## Risks

- **Agent mistakes at scale:** mitigated by the working copy, validation in the loop, the review and one-step undo. The MCP bridge is read-only by default.
- **Cost:** the step limit and the token count are shown before and during a run.
- **Prompt injection through model content:** the review step for the built-in agent and the paste route; documented for MCP.
- **ChatGPT support for local MCP servers varies by app and plan.** The paste route works everywhere.
