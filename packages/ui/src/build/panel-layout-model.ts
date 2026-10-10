import {
  isFormula,
  type ClassId,
  type RelationId,
  type AttributeDef,
  type PanelAttributeItem,
  type PanelControl,
  type PanelGroupItem,
  type PanelItem,
  type PanelLayout,
  type PanelTab,
} from '@metakit-app/core';
import { controlsFor } from '../panel/layout';

/**
 * Where something sits in the layout: `[tab]` is a tab, `[tab, item]` an item of the tab and
 * `[tab, group, item]` an item inside a group. A group is an item of its tab, so `[tab, group]`
 * names the group itself.
 */
export type LayoutPath = readonly number[];

export type ConditionName = 'visible' | 'readOnly' | 'required';

/** A layout with one tab "General" holding every attribute in order, grouped by attribute group. */
export function defaultLayout(
  classId: ClassId | RelationId,
  defs: readonly AttributeDef[],
): PanelLayout {
  const items: PanelItem[] = [];
  const groups = new Map<string, PanelGroupItem>();
  for (const def of defs) {
    const item: PanelAttributeItem = { attribute: def.key };
    if (def.group === undefined) {
      items.push(item);
      continue;
    }
    let group = groups.get(def.group);
    if (!group) {
      group = { group: def.group, items: [] };
      groups.set(def.group, group);
      items.push(group);
    }
    group.items.push(item);
  }
  return { class: classId, tabs: [{ label: 'General', items }] };
}

const isGroup = (item: PanelItem): item is PanelGroupItem => 'group' in item;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * The layout being edited in Build mode: a draft with undo and redo. It is plain data and
 * operations, so the editor component only draws it; saving goes through the Kit commands.
 */
export class PanelLayoutModel {
  private draft: PanelLayout;
  private undoStack: PanelLayout[] = [];
  private redoStack: PanelLayout[] = [];
  private readonly listeners = new Set<(layout: PanelLayout) => void>();

  constructor(
    layout: PanelLayout,
    private readonly attributes: readonly AttributeDef[],
  ) {
    this.draft = clone(layout);
  }

  /** Replaces the draft with an outside change (for example from another collaborator) and clears the history. */
  reset(layout: PanelLayout): void {
    this.draft = clone(layout);
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }

  /** Calls `listener` with a copy of the layout after every change, undo and redo. Returns a function that stops it. */
  onChange(listener: (layout: PanelLayout) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  toLayout(): PanelLayout {
    return clone(this.draft);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(this.draft);
    this.draft = previous;
    this.emit();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.draft);
    this.draft = next;
    this.emit();
    return true;
  }

  // Reading ----------------------------------------------------------------------------------

  /** The keys of the class's attributes that no tab or group places yet, in the class's order. */
  unplaced(): string[] {
    const placed = new Set<string>();
    const walk = (items: readonly PanelItem[]) => {
      for (const item of items) {
        if (isGroup(item)) walk(item.items);
        else placed.add(item.attribute);
      }
    };
    for (const tab of this.draft.tabs) walk(tab.items);
    return this.attributes.map((a) => a.key).filter((k) => !placed.has(k));
  }

  /** The item at a path (a tab for a one-step path). */
  get(path: LayoutPath): PanelTab | PanelItem {
    return this.resolve(this.draft, path);
  }

  // Tabs -------------------------------------------------------------------------------------

  addTab(label = 'New tab'): number {
    this.edit((l) => l.tabs.push({ label, items: [] }));
    return this.draft.tabs.length - 1;
  }

  renameTab(index: number, label: string): void {
    this.edit((l) => (this.tab(l, index).label = this.name(label, 'tab')));
  }

  removeTab(index: number): void {
    this.edit((l) => {
      this.tab(l, index);
      l.tabs.splice(index, 1);
    });
  }

  moveTab(from: number, to: number): void {
    this.edit((l) => {
      this.tab(l, from);
      if (!Number.isInteger(to) || to < 0 || to >= l.tabs.length)
        throw new Error(`There is no place ${to} among the tabs.`);
      const [tab] = l.tabs.splice(from, 1);
      l.tabs.splice(to, 0, tab!);
    });
  }

  // Groups -----------------------------------------------------------------------------------

  /** Adds an empty group at the end of a tab and returns its path. */
  addGroup(tabIndex: number, name: string): LayoutPath {
    let at = -1;
    this.edit((l) => {
      const tab = this.tab(l, tabIndex);
      tab.items.push({ group: this.name(name, 'group'), items: [] });
      at = tab.items.length - 1;
    });
    return [tabIndex, at];
  }

  renameGroup(path: LayoutPath, name: string): void {
    this.edit((l) => {
      this.group(l, path).group = this.name(name, 'group');
    });
  }

  /** Removes the group but keeps its attributes, which take its place in the tab. */
  removeGroup(path: LayoutPath): void {
    this.edit((l) => {
      const group = this.group(l, path);
      const tab = this.tab(l, path[0]!);
      tab.items.splice(path[1]!, 1, ...group.items);
    });
  }

  // Items ------------------------------------------------------------------------------------

  /**
   * Moves the item at `from` so that it ends up at `to` (a path as it is after the move). A path
   * whose parent is a group puts the item in that group. Groups cannot sit inside groups.
   */
  moveItem(from: LayoutPath, to: LayoutPath): void {
    this.edit((l) => {
      const source = this.parentList(l, from);
      const item = source[from.at(-1)!];
      if (!item) throw new Error('There is nothing to move there.');
      if (to.length < 2 || to.length > 3)
        throw new Error('That is not a place in the layout.');
      if (isGroup(item) && to.length === 3)
        throw new Error('A group cannot be placed inside another group.');
      // Taking the item out first makes `to` mean the final position.
      source.splice(from.at(-1)!, 1);
      let target: PanelItem[];
      if (to.length === 2) target = this.tab(l, to[0]!).items;
      else {
        const parent = this.tab(l, to[0]!).items[to[1]!];
        if (!parent || !isGroup(parent))
          throw new Error('That place is not inside a group.');
        target = parent.items;
      }
      const index = to.at(-1)!;
      if (!Number.isInteger(index) || index < 0 || index > target.length)
        throw new Error('That is not a place in the layout.');
      target.splice(index, 0, item);
    });
  }

  /** One step up within its tab or group. False when it is already first. */
  moveUp(path: LayoutPath): boolean {
    const index = path.at(-1)!;
    if (path.length < 2 || index <= 0) return false;
    this.moveItem(path, [...path.slice(0, -1), index - 1]);
    return true;
  }

  /** One step down within its tab or group. False when it is already last. */
  moveDown(path: LayoutPath): boolean {
    if (path.length < 2) return false;
    const list = this.parentList(this.draft, path);
    const index = path.at(-1)!;
    if (index >= list.length - 1) return false;
    this.moveItem(path, [...path.slice(0, -1), index + 1]);
    return true;
  }

  /** Moves an attribute into the group just above it, else the group just below. False when there is none. */
  intoGroup(path: LayoutPath): boolean {
    if (path.length !== 2) return false;
    const [t, i] = path as [number, number];
    const list = this.tab(this.draft, t).items;
    if (!list[i] || isGroup(list[i]!)) return false;
    const above = list[i - 1];
    if (above && isGroup(above)) {
      this.moveItem(path, [t, i - 1, above.items.length]);
      return true;
    }
    const below = list[i + 1];
    if (below && isGroup(below)) {
      // After the move the group sits one place earlier.
      this.moveItem(path, [t, i, 0]);
      return true;
    }
    return false;
  }

  /** Moves an attribute out of its group to just after the group. False when it is not in a group. */
  outOfGroup(path: LayoutPath): boolean {
    if (path.length !== 3) return false;
    this.moveItem(path, [path[0]!, path[1]! + 1]);
    return true;
  }

  /** Places an attribute at the end of a tab (`[tab]`) or group (`[tab, group]`). */
  addAttribute(path: LayoutPath, key: string): void {
    this.edit((l) => {
      if (!this.attributes.some((a) => a.key === key))
        throw new Error(`The class has no attribute "${key}".`);
      if (this.isPlaced(l, key))
        throw new Error(`The attribute "${key}" is already in the layout.`);
      const list =
        path.length === 1
          ? this.tab(l, path[0]!).items
          : this.group(l, path).items;
      list.push({ attribute: key });
    });
  }

  removeAttribute(path: LayoutPath): void {
    this.edit((l) => {
      const list = this.parentList(l, path);
      const item = list[path.at(-1)!];
      if (!item || isGroup(item))
        throw new Error('There is no attribute at that place.');
      list.splice(path.at(-1)!, 1);
    });
  }

  /** Chooses a control, or `undefined` for the default. Controls that do not suit the type are refused. */
  setControl(path: LayoutPath, control: PanelControl | undefined): void {
    this.edit((l) => {
      const item = this.attributeItem(l, path);
      if (control === undefined) {
        delete item.control;
        return;
      }
      const def = this.attributes.find((a) => a.key === item.attribute);
      if (!def || !controlsFor(def.type).includes(control))
        throw new Error(
          `The control "${control}" does not suit the attribute "${item.attribute}".`,
        );
      item.control = control;
    });
  }

  /**
   * Sets `visible`, `readOnly` or `required` to a fixed value or a formula (text starting with
   * `=`); `undefined` removes it. Tabs and groups only have `visible`.
   */
  setCondition(
    path: LayoutPath,
    name: ConditionName,
    value: boolean | string | undefined,
  ): void {
    this.edit((l) => {
      if (typeof value === 'string' && !isFormula(value))
        throw new Error(
          'A condition is true, false or a formula starting with =.',
        );
      const target = this.resolve(l, path);
      if (
        name !== 'visible' &&
        (path.length === 1 || isGroup(target as PanelItem))
      )
        throw new Error('Tabs and groups only have a visible condition.');
      if (name !== 'visible') this.attributeItem(l, path);
      const record = target as unknown as Record<string, unknown>;
      if (value === undefined) delete record[name];
      else record[name] = value;
    });
  }

  /** Sets the height of a table or text area, or `undefined` for the default. */
  setHeight(path: LayoutPath, height: number | undefined): void {
    this.edit((l) => {
      const item = this.attributeItem(l, path);
      if (height === undefined) {
        delete item.height;
        return;
      }
      if (!Number.isFinite(height) || height <= 0)
        throw new Error('The height must be a number above 0.');
      item.height = Math.round(height);
    });
  }

  toggleShowRelations(): boolean {
    this.edit((l) => {
      if (l.showRelations) delete l.showRelations;
      else l.showRelations = true;
    });
    return this.draft.showRelations === true;
  }

  // Internals --------------------------------------------------------------------------------

  private edit(change: (layout: PanelLayout) => void): void {
    const next = clone(this.draft);
    change(next);
    if (JSON.stringify(next) === JSON.stringify(this.draft)) return;
    this.undoStack.push(this.draft);
    this.redoStack = [];
    this.draft = next;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.toLayout());
  }

  private name(text: string, what: string): string {
    const trimmed = text.trim();
    if (trimmed === '') throw new Error(`A ${what} needs a name.`);
    return trimmed;
  }

  private tab(layout: PanelLayout, index: number): PanelTab {
    const tab = layout.tabs[index];
    if (!tab) throw new Error(`There is no tab ${index + 1}.`);
    return tab;
  }

  private group(layout: PanelLayout, path: LayoutPath): PanelGroupItem {
    const item =
      path.length === 2
        ? this.tab(layout, path[0]!).items[path[1]!]
        : undefined;
    if (!item || !isGroup(item)) throw new Error('There is no group there.');
    return item;
  }

  private attributeItem(
    layout: PanelLayout,
    path: LayoutPath,
  ): PanelAttributeItem {
    const item = this.resolve(layout, path);
    if (path.length < 2 || 'items' in item)
      throw new Error('There is no attribute at that place.');
    return item as PanelAttributeItem;
  }

  /** The list that holds the item a path names. */
  private parentList(layout: PanelLayout, path: LayoutPath): PanelItem[] {
    if (path.length === 2) return this.tab(layout, path[0]!).items;
    if (path.length === 3) return this.group(layout, path.slice(0, 2)).items;
    throw new Error('That is not an item of a tab or group.');
  }

  private resolve(layout: PanelLayout, path: LayoutPath): PanelTab | PanelItem {
    if (path.length === 1) return this.tab(layout, path[0]!);
    const item = this.parentList(layout, path)[path.at(-1)!];
    if (!item) throw new Error('There is nothing at that place.');
    return item;
  }

  private isPlaced(layout: PanelLayout, key: string): boolean {
    const walk = (items: readonly PanelItem[]): boolean =>
      items.some((i) => (isGroup(i) ? walk(i.items) : i.attribute === key));
    return layout.tabs.some((t) => walk(t.items));
  }
}
