# Tasks

Starts after `ai-data-catalog` PRs 1 and 2 (copy and catalog).

## 1. PR 1: operations and plans (`feat/authoring-operations`)

- [ ] 1.1 `packages/authoring`: session with working copies, diff, the read and tool-library operations, JSON schemas.
- [ ] 1.2 Model operations, refs, auto-layout.
- [ ] 1.3 Plans: format, `runPlan`, errors by step.
- [ ] 1.4 Tests: each operation; plans that build the three new built-in tools and a model for each.
- [ ] 1.5 ADR 0011.

## 2. PR 2: built-in agent for tool libraries (`feat/agent-tools`)

- [ ] 2.1 `runAgent` tool-use loop with limits and Stop; prompts.
- [ ] 2.2 `AgentPanel`: goal, progress, review with Try it, Accept, Discard, Keep going.
- [ ] 2.3 Entry points: Tool libraries page (scratch or extend) and Build mode.
- [ ] 2.4 Tests with a scripted fake provider; e2e with the test seam's provider.
- [ ] 2.5 Docs: build a tool library with the assistant; assistant overview.

## 3. PR 3: built-in agent for models (`feat/agent-models`)

- [ ] 3.1 Model scope, per-model consent and `assertConsented`.
- [ ] 3.2 Entry points in Model mode; review; one undo step.
- [ ] 3.3 Tests and e2e (consent first, then accept, then one Undo).
- [ ] 3.4 Docs: modelling with the assistant; assistant privacy.

## 4. PR 4: paste route (`feat/agent-paste`)

- [ ] 4.1 Brief builder and plan extraction, with tests.
- [ ] 4.2 `OutsideAiDialog` in the Tool libraries page, Build mode and Model mode; shared review.
- [ ] 4.3 e2e: paste a plan, review, accept, undo.
- [ ] 4.4 Docs: working with Claude or ChatGPT from outside (paste part); the plan format.

## 5. PR 5: MCP bridge (`feat/mcp-bridge`)

- [ ] 5.1 `metakit mcp`: stdio JSON-RPC, tools, resources, read-only default, `--write`, `undo_last`, presence.
- [ ] 5.2 Tests: spawn the bridge on a temp workspace, list tools, call reads, refuse writes without `--write`, write with it, and check that a second session reads the change files.
- [ ] 5.3 Docs: setup for Claude Desktop and Claude Code; README and CLAUDE.md commands.
