# Proposal

## Why

Building a tool library by hand takes a method engineer hours, and filling a model from a workshop or a document takes a modeller hours too. People want to describe their goal ("a tool to map our data platform and who owns what") and have an agent build the tool library, from scratch or by extending an existing one, and then create and edit models with it.

The assistant today (ADR 0008) drafts one rule, script, shape or class at a time and never touches models. People also already work with Claude or ChatGPT outside MetaKit and want those agents to work on their tools and models directly.

## What Changes

**One set of agent operations** (new package `packages/authoring`, no DOM, runs in Node)
- About 25 operations with JSON schemas. Agents name things by key, never by id.
  - **Reading:** tool libraries, a tool library, models, a model; the format guide; validating.
  - **Tool libraries:** create (empty or from a copy); add, change or remove classes, relation classes, attributes, model types, looks, rules and scripts; add from the class catalog.
  - **Models:** create; add objects; connect them; set attributes; delete; lay out.
- A **plan** is a list of operations, written as JSON. The built-in agent, the MCP bridge and the paste route all speak this one language.
- Every operation becomes existing tool or model commands. Nothing bypasses the command API (rule 3).

**Built-in agent** (extends the assistant: Claude, your own key)
- **Create a tool library with the assistant** on the Tool libraries page. You describe the goal and choose *Start from scratch* or *Extend* a built-in or workspace library. The agent plans, builds and checks the library.
- **Ask the assistant** in Build mode, to extend or change the open tool library.
- **Ask the assistant** in Model mode, to create or edit model content, for example "Add the six source systems from this list and connect them to the lakehouse". Before the first request for a model, a notice says that the model's content will be sent to the provider; you confirm once per model, and the browser remembers.
- The agent works on a **working copy** in a loop of operations, with validation after each step and at most 30 steps. Then it shows a **review**:
  - what will be added, changed and removed
  - problems found
  - for tool libraries, a live Try it preview

  **Accept** applies everything as one undo step per document; **Discard** throws it away.

**Outside agents: Claude, ChatGPT and others**
- **Local MCP bridge:** `metakit mcp <workspace folder>` is part of the CLI. It lets MCP clients such as Claude Desktop and Claude Code read and edit the workspace through the same operations.
  - It runs on your computer as its own sync instance, writing only its own change files (rule 6). Open browser tabs see its changes arrive like a colleague's, under the name "Agent".
  - It is **read-only unless started with `--write`**.
  - It needs no key; the outside app uses your own account.
- **Paste route**, for any chat app, including ChatGPT where it cannot reach a local program:
  - **Copy brief for an AI** puts a prompt on the clipboard. It holds your goal, the format guide and the current tool library, plus the model when you are working on one, after the same notice.
  - **Paste the AI's answer** takes the JSON plan it returns. The plan goes through the same checks and the same review as the built-in agent, then **Accept** applies it as one undo step.

**Documentation**
- New help topics:
  - building a tool library with the assistant
  - modelling with the assistant
  - working with Claude or ChatGPT from outside, with setup steps for Claude Desktop and Claude Code and the paste route
  - the plan format
- Updated topics: assistant overview and assistant privacy.

## Capabilities

### New Capabilities

- `agent-authoring`

## Impact

- **ADR 0011 changes ADR 0008:** the assistant may send model content after the per-model notice; it may build whole tool libraries and edit models. The MCP bridge is a local program, not a server (rule 1 holds).
- **No file format change:** plans are not stored.
- **No new runtime dependency:** the MCP stdio protocol (JSON-RPC 2.0 over stdin and stdout) is written by hand in the CLI.
- **Builds on `ai-data-catalog`:** "add from catalog" and "create from a copy" use its catalog and `cloneToolLibrary`, so this change starts after that one's first two PRs.
- **Delivered as five PRs:**
  1. operations and plans
  2. built-in agent for tool libraries
  3. built-in agent for models
  4. paste route
  5. MCP bridge
