// For the tool "Data and AI architecture". The command "Show lineage" lists everything upstream
// and downstream of the selected object, grouped by how many steps away it is. It follows
// "Flows to", and also counts the datasets a model trains on and what a model or service serves,
// so the lineage of a dataset reaches the consumers of the model built from it.
import { commands, model, tool, ui } from 'metakit';

type Item = ReturnType<typeof model.objects>[number];

const describe = (o: Item) =>
  `${o.attrs.Name || 'unnamed'} (${tool.class(o.class).labels['en'] ?? o.class})`;

const downstreamOf = (o: Item): Item[] => [
  ...o.outgoing('FlowsTo'),
  ...o.incoming('TrainsOn'),
  ...o.outgoing('Serves'),
];
const upstreamOf = (o: Item): Item[] => [
  ...o.incoming('FlowsTo'),
  ...o.outgoing('TrainsOn'),
  ...o.incoming('Serves'),
];

/** Breadth first: the first list holds the objects one step away, the next two steps, and so on. */
function walk(start: Item, step: (o: Item) => Item[]): Item[][] {
  const seen = new Set<string>([start.id]);
  const levels: Item[][] = [];
  let frontier = [start];
  while (frontier.length > 0) {
    const level: Item[] = [];
    for (const o of frontier)
      for (const n of step(o)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        level.push(n);
      }
    if (level.length > 0) levels.push(level);
    frontier = level;
  }
  return levels;
}

const total = (levels: Item[][]) =>
  levels.reduce((sum, level) => sum + level.length, 0);
const steps = (n: number) => (n === 1 ? '1 step' : `${n} steps`);

commands.register({
  id: 'show-lineage',
  label: 'Show lineage',
  menu: 'Model',
  context: true,
  run: (target) => {
    const picked = target ?? model.selection()[0] ?? null;
    if (picked === null) {
      ui.message('Select an object first to see its lineage.');
      return;
    }
    if ('relation' in picked) {
      ui.message('Select an object, not a connector, to see its lineage.');
      return;
    }
    const up = walk(picked, upstreamOf);
    const down = walk(picked, downstreamOf);
    const lines = [`Lineage of ${describe(picked)}:`];
    if (up.length === 0) lines.push('Upstream: nothing flows into it.');
    else {
      lines.push(`Upstream, in flow order (${total(up)}):`);
      // Flow order starts at the far end, so the furthest level comes first.
      for (let i = up.length - 1; i >= 0; i--)
        lines.push(
          `  ${steps(i + 1)} back: ${up[i]!.map(describe).join(', ')}`,
        );
    }
    if (down.length === 0) lines.push('Downstream: it flows nowhere.');
    else {
      lines.push(`Downstream, in flow order (${total(down)}):`);
      down.forEach((level, i) =>
        lines.push(`  ${steps(i + 1)} on: ${level.map(describe).join(', ')}`),
      );
    }
    ui.message(lines.join('\n'));
  },
});
