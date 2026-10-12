// For the Kit "BPMN lite". Candidate 1 of docs/phase-7-behaviour-candidates.md: BPMN tools
// check, before a model is saved, that a gateway that splits the flow says which way each flow
// goes. MetaKit has no save step, so the check is a command in the Model menu.
import { commands, model, ui } from 'metakit';

commands.register({
  id: 'check-gateways',
  label: 'Check gateways',
  menu: 'Model',
  run: () => {
    const problems: string[] = [];
    for (const gateway of model.objects('Gateway')) {
      const name = gateway.attrs.Name ?? 'A gateway without a name';
      const leaving = gateway
        .connectors('SequenceFlow')
        .filter((flow) => flow.from.id === gateway.id);
      if (leaving.length === 0)
        problems.push(`${name}: nothing follows this gateway.`);
      // An exclusive gateway picks one way, so every way out needs a condition.
      if (gateway.attrs.GatewayKind === 'XOR' && leaving.length > 1) {
        for (const flow of leaving) {
          if (!flow.attrs.Condition)
            problems.push(
              `${name}: the flow to "${flow.to.attrs.Name ?? '?'}" has no condition.`,
            );
        }
      }
    }
    if (problems.length === 0) ui.message('All gateways are fine.');
    else ui.message(problems.join('\n'), 'warning');
  },
});
