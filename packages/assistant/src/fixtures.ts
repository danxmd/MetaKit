import type { ToolLibrary } from '@metakit-app/core';
import { SAMPLE, sampleTool } from '@metakit-app/core/testing';

/** A text that must never leave the browser; tests plant it in models. */
export const MARKER = 'ZX9-SECRET-MARKER';

/** The sample tool with the attributes of the plan's examples on Task. */
export function planTool(): ToolLibrary {
  const tool = sampleTool();
  tool.classes[SAMPLE.task]!.attributes.push(
    { id: 'att_owner', key: 'Owner', type: 'text' },
    { id: 'att_status', key: 'Status', type: 'text' },
    { id: 'att_number', key: 'Number', type: 'integer' },
  );
  return tool;
}

/** The rule of the plan, as a reply of the drafting model. */
export const RULE_REPLY = `Here is the rule.
\`\`\`json
{
  "label": "High-priority tasks need an owner",
  "when": { "event": "attribute.changed", "class": "Task", "attribute": "Priority" },
  "if": "Priority == 'High' && Owner == null",
  "then": [
    { "action": "setAttribute", "attribute": "Status", "value": "Needs owner" },
    { "action": "message", "kind": "warning", "text": "= 'Task \\"' + Name + '\\" is high priority but has no owner.'" }
  ]
}
\`\`\``;

export const SCRIPT_REPLY = `\`\`\`ts
// Name: Renumber tasks
import { on, model, ui, commands } from "metakit";

function renumberTasks(): void {
  const tasks = model.objects("Task").sort((a, b) => a.y - b.y || a.x - b.x);
  tasks.forEach((task, index) => {
    task.attrs.Number = index + 1;
  });
}

on("object.created", { class: "Task" }, () => renumberTasks());
on("object.moved", { class: "Task" }, () => renumberTasks());

commands.register({
  id: "renumber-tasks",
  label: "Renumber tasks",
  menu: "Model",
  run: () => {
    renumberTasks();
    ui.message(\`Renumbered \${model.objects("Task").length} tasks.\`);
  },
});
\`\`\``;

export const SHAPE_REPLY = `\`\`\`json
{
  "kind": "node",
  "name": "Blue task box",
  "size": { "width": 140, "height": 70, "resizable": true, "minWidth": 60, "minHeight": 36 },
  "outline": "rect",
  "parts": [
    { "type": "rect", "x": 0, "y": 0, "width": "100%", "height": "100%", "radius": 10, "fill": "#d0ebff", "stroke": "#1971c2", "strokeWidth": 1.5 },
    { "type": "text", "x": 8, "y": 4, "width": "100% - 16", "height": "100% - 8", "text": "= Name", "wrap": true, "fit": "shrink", "align": "center", "valign": "middle" }
  ]
}
\`\`\``;

export const CLASS_REPLY = `\`\`\`json
{
  "key": "Task",
  "kind": "node",
  "labels": { "en": "Task" },
  "attributes": [
    { "key": "Name", "type": "text", "labels": { "en": "Name" }, "required": true },
    { "key": "Priority", "type": "choice", "labels": { "en": "Priority" }, "options": ["Low", "Medium", "High"], "default": "Medium" },
    { "key": "Owner", "type": "text", "labels": { "en": "Owner" } }
  ]
}
\`\`\``;
