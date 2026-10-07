import type { CommandPlace } from '@metakit-app/core';

/** A command a person can start from the model menu, the toolbar or the context menu. */
export interface CommandEntry {
  id: string;
  label: string;
  place: CommandPlace;
  /** Where it comes from, for the menu: a rule of the tool library or a script. */
  source: 'rule' | 'script';
  /** Runs the command on the selected object, or on nothing. */
  run(target: string | null): void;
}

/** The commands of the open model, from rules and scripts; the UI lists them by place. */
export class CommandRegistry {
  private readonly entries = new Map<string, CommandEntry>();
  private readonly listeners = new Set<() => void>();

  register(entry: CommandEntry): () => void {
    this.entries.set(entry.id, entry);
    this.changed();
    return () => {
      if (this.entries.get(entry.id) === entry) {
        this.entries.delete(entry.id);
        this.changed();
      }
    };
  }

  /** Forgets every command that came from `source`; used when rules or scripts are reloaded. */
  clear(source: CommandEntry['source']): void {
    for (const [id, e] of this.entries)
      if (e.source === source) this.entries.delete(id);
    this.changed();
  }

  list(place?: CommandPlace): CommandEntry[] {
    return [...this.entries.values()]
      .filter((e) => place === undefined || e.place === place)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  get(id: string): CommandEntry | undefined {
    return this.entries.get(id);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }
}
