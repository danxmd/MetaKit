import type { ActionAttribute, ModelStore, Kit } from '@metakit-app/core';
import type { Behaviour } from './runtime';
import { RuleEngine } from './rules';

export interface AttachRulesOptions {
  /** The model's store; `Behaviour` does not hold it, so the caller that made it passes it again. */
  store: ModelStore;
  /** The Kit as it is now; read on every use so that Build mode edits are seen. */
  kit: () => Kit;
}

export interface AttachedRules {
  engine: RuleEngine;
  /** Reads the rules again; call it after the Kit changed. */
  reload(): void;
  /** Stops the rules and removes their commands; `behaviour.dispose()` does not do it for you. */
  dispose(): void;
}

/** Starts the rules of the Kit on a behaviour made by `createBehaviour`. */
export function attachRules(
  behaviour: Behaviour,
  options: AttachRulesOptions,
): AttachedRules {
  const engine = new RuleEngine({
    store: options.store,
    bus: behaviour.bus,
    calculator: behaviour.calculator,
    kit: options.kit,
    host: behaviour.host,
    commands: behaviour.commands,
  });
  engine.reload();
  return {
    engine,
    reload: () => engine.reload(),
    dispose: () => engine.dispose(),
  };
}

/**
 * Runs what an `action` attribute (a panel button) points to, on the selected object: a rule goes
 * to the engine, a command to the registry (then the host), a script to the host.
 */
export function runActionAttribute(
  behaviour: Behaviour,
  engine: RuleEngine,
  def: Pick<ActionAttribute, 'run'>,
  target: string | null,
): void {
  const { kind, ref } = def.run;
  if (kind === 'rule') engine.run(ref, target);
  else if (kind === 'command') {
    const entry =
      behaviour.commands.get(ref) ??
      behaviour.commands.list().find((c) => c.label === ref);
    if (entry) entry.run(target);
    else behaviour.host.runCommand(ref, target);
  } else behaviour.host.runScript(ref, target);
}
