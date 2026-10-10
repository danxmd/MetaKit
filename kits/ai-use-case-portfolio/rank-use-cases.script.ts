// For the tool "AI use-case portfolio". The command "Rank use cases" lists the use cases from the
// highest priority score down, with their quadrant and status, and counts them per quadrant.
// Sorting and counting need a loop, which is why this is a script and not a rule.
import { commands, model, ui } from 'metakit';

const QUADRANTS = ['Quick win', 'Strategic bet', 'Fill-in', 'Deprioritise'];
const TOP = 10;

commands.register({
  id: 'rank-use-cases',
  label: 'Rank use cases',
  menu: 'Model',
  run: () => {
    const useCases = model.objects('UseCase').map((u) => ({
      name: u.attrs.Name || 'Unnamed use case',
      score: u.attrs.PriorityScore,
      quadrant: u.attrs.Quadrant,
      status: u.attrs.Status ?? 'no status',
    }));
    if (useCases.length === 0) {
      ui.message('There are no use cases in this model yet.');
      return;
    }

    // Use cases without a score go last; equal scores keep their names in order.
    useCases.sort(
      (a, b) =>
        (typeof b.score === 'number' ? b.score : -1) -
          (typeof a.score === 'number' ? a.score : -1) ||
        a.name.localeCompare(b.name),
    );

    const lines = useCases
      .slice(0, TOP)
      .map(
        (u, i) =>
          `${i + 1}. ${u.name}: ${typeof u.score === 'number' ? u.score : 'not scored'} (${u.quadrant || 'no quadrant'}, ${u.status})`,
      );
    const counts = QUADRANTS.map(
      (q) => `${q}: ${useCases.filter((u) => u.quadrant === q).length}`,
    );
    const shown =
      useCases.length > TOP
        ? `Top ${TOP} of ${useCases.length} use cases`
        : `${useCases.length} use cases`;
    ui.message(
      `${shown}, by priority score:\n${lines.join('\n')}\n\nPer quadrant: ${counts.join(', ')}.`,
    );
  },
});
