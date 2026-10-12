// For the Kit "Agent pipeline". The command "Check pipeline" looks for the things that make a
// pipeline of agents and humans unreliable: work nobody owns, artifacts from nowhere, hand-overs
// to a human who is not there, output of an autonomous agent that nobody approves, and loops.
import { commands, model, ui } from 'metakit';

const nameOf = (o: { attrs: { Name?: string | null } }, fallback: string) =>
  o.attrs.Name || fallback;

commands.register({
  id: 'check-pipeline',
  label: 'Check pipeline',
  menu: 'Model',
  run: () => {
    const problems: string[] = [];
    const tasks = model.objects('Task');

    // 1. Every task has someone who performs it.
    const performersOf = (task: (typeof tasks)[number]) =>
      task.incoming('Performs');
    for (const task of tasks) {
      if (performersOf(task).length === 0)
        problems.push(`Task "${nameOf(task, 'unnamed')}": nobody performs it.`);
    }

    // 2. Every artifact comes from a task, unless it is provided from outside.
    for (const artifact of model.objects('Artifact')) {
      if (
        artifact.attrs.Origin !== 'Provided' &&
        artifact.incoming('Produces').length === 0
      )
        problems.push(
          `Artifact "${nameOf(artifact, 'unnamed')}": no task produces it. Mark it as provided if it comes from outside.`,
        );
    }

    // 3. A hand-over that needs a human leads to a task that a human performs.
    for (const link of model.connectors('HandsOverTo')) {
      if (link.attrs.Handoff !== 'Needs human') continue;
      const target = link.to;
      const humans = target
        .incoming('Performs')
        .filter((a) => a.attrs.Team !== undefined);
      if (target.incoming('Performs').length > 0 && humans.length === 0)
        problems.push(
          `"${nameOf(link.from, 'unnamed')}" hands over to "${nameOf(target, 'unnamed')}" and needs a human, but only agents perform it.`,
        );
    }

    // 4. What an autonomous agent makes is approved by a gate before another task uses it.
    for (const task of tasks) {
      const autonomous = performersOf(task).some(
        (a) => a.attrs.Autonomy === 'Autonomous',
      );
      if (!autonomous) continue;
      for (const artifact of task.outgoing('Produces')) {
        const used = artifact.outgoing('Feeds').length > 0;
        const approved = artifact.incoming('Approves').length > 0;
        if (used && !approved)
          problems.push(
            `Artifact "${nameOf(artifact, 'unnamed')}" is made by an autonomous agent and used by another task, but no gate approves it.`,
          );
      }
    }

    // 5. Hand-overs must not loop back on themselves.
    const next = new Map<string, string[]>();
    for (const link of model.connectors('HandsOverTo'))
      next.set(link.from.id, [...(next.get(link.from.id) ?? []), link.to.id]);
    const state = new Map<string, 'open' | 'done'>();
    const names = new Map<string, string>();
    for (const o of [...tasks, ...model.objects('Gate')])
      names.set(o.id, nameOf(o, 'unnamed'));
    const looped = new Set<string>();
    const visit = (id: string, path: string[]) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'open') {
        const cycle = path.slice(path.indexOf(id)).concat(id);
        const key = [...cycle].sort().join('|');
        if (!looped.has(key)) {
          looped.add(key);
          problems.push(
            `Loop in the hand-overs: ${cycle.map((c) => names.get(c) ?? c).join(' → ')}.`,
          );
        }
        return;
      }
      state.set(id, 'open');
      for (const n of next.get(id) ?? []) visit(n, [...path, id]);
      state.set(id, 'done');
    };
    for (const id of next.keys()) visit(id, []);

    if (problems.length === 0) ui.message('The pipeline looks sound.');
    else ui.message(problems.join('\n'), 'warning');
  },
});
