// For the tool "BPMN lite". Candidate 2 of docs/phase-7-behaviour-candidates.md: the total of the
// effort of all tasks, as ADOxx process tools show it. The rule version (total-effort.rule.json)
// gives the total; this script version also breaks it down by lane. Both only read, so neither
// changes the model.
import { commands, model, ui } from 'metakit';

commands.register({
  id: 'total-effort',
  label: 'Total effort by lane',
  menu: 'Model',
  run: () => {
    const tasks = model.objects('Task');
    const byLane = new Map<string, number>();
    let total = 0;
    for (const task of tasks) {
      const effort = task.attrs.Effort ?? 0;
      const name = task.parent?.attrs.LaneName ?? 'No lane';
      byLane.set(name, (byLane.get(name) ?? 0) + effort);
      total += effort;
    }
    const lines = [...byLane].map(([lane, effort]) => `${lane}: ${effort} h`);
    ui.message(
      `Total effort: ${total} h in ${tasks.length} tasks.\n${lines.join('\n')}`,
    );
  },
});
