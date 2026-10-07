# Design

- Classes: `Actor` (abstract) with `Agent` and `Human`; `Task`; `Artifact`; `Gate`; `Stage` (swimlane container).
- Relations: `Performs` (Actor to Task, with a role), `HandsOverTo` (Task or Gate to Task or Gate, with a condition and a handoff type), `Consumes` and `Produces` (Task and Artifact), `Approves` (Gate to Artifact), `DelegatesTo` (Actor to Actor).
- Model types: `Pipeline` (all classes, Stage contains tasks, gates and artifacts) and `ArtifactLineage` (tasks and artifacts with consumes and produces only).
- Notation: agents are blue rounded boxes with a bot marker, humans orange boxes with a person marker; the edge colour of an agent shows autonomy (green suggest, amber with approval, red autonomous); artifacts are document shapes whose fill follows the status; gates are hexagons.
- Behaviour: computed cost per task, constraints (a done task needs actual effort; an approved artifact needs a version), rules as commands (Mark ready, Hand to human, Mark done, Total effort and cost), and a script "Check pipeline".
- The check script reports: tasks nobody performs; artifacts nobody produces unless marked as provided input; hand-overs that need a human but whose target has no human performer; artifacts made by an autonomous agent that another task consumes without a gate that approves them; loops in the hand-overs.
