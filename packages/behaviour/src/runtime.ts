import {
  attachEvents,
  EventBus,
  isA,
  ModelCalculator,
  type Model,
  type ModelStore,
  type Kit,
} from '@metakit-app/core';
import { CommandRegistry } from './commands';
import type { BehaviourHost } from './host';

export interface BehaviourOptions {
  store: ModelStore;
  /** The Kit as it is now; read again on every use so that Build mode edits are seen. */
  kit: () => Kit;
  host: BehaviourHost;
}

/**
 * Everything that makes a model open in the app behave: the calculator for formulas, the event
 * bus fed by the store, and the commands from rules and scripts. Rules and scripts add themselves
 * here (phase 5.4 and 7). Detach it when the model closes.
 */
export interface Behaviour {
  calculator: ModelCalculator;
  bus: EventBus;
  commands: CommandRegistry;
  host: BehaviourHost;
  /** Called with a new Kit after Build mode changed it. */
  setKit(kit: Kit): void;
  dispose(): void;
}

export function createBehaviour(options: BehaviourOptions): Behaviour {
  const { store } = options;
  const getModel = () => store.state as Model;
  const calculator = new ModelCalculator(options.kit(), getModel);
  const stopCalc = calculator.attach(store);
  const bus = new EventBus({
    isA: (cls, ancestor) => isA(options.kit(), cls, ancestor),
  });
  const stopEvents = attachEvents(store, bus, { kit: options.kit });
  const commands = new CommandRegistry();
  const disposers: (() => void)[] = [stopCalc, stopEvents];
  return {
    calculator,
    bus,
    commands,
    host: options.host,
    setKit: (kit) => calculator.setKit(kit),
    dispose: () => disposers.splice(0).forEach((d) => d()),
  };
}
