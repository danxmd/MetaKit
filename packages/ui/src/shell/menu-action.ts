/**
 * Where focus goes in a menu for a key, or `null` when the key does not move it. `current` is -1
 * when no item has focus yet.
 */
export function menuFocusTarget(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count;
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

const ITEMS =
  '.menu-list button:not(:disabled), .menu-list a[href], .menu-list select:not(:disabled), .menu-list input:not(:disabled)';

/**
 * The one behaviour for every `<details class="menu">`: it closes when an item is chosen, on
 * Escape, and when the person presses anywhere else; that press is not swallowed, so it still
 * does what it was aimed at. Arrow keys, Home and End move between items. Items that should keep
 * the menu open (a setting, a choice) sit inside an element with `data-keep-open`.
 */
export function menuBehaviour(node: HTMLDetailsElement) {
  const close = () => node.removeAttribute('open');
  const items = () => [...node.querySelectorAll<HTMLElement>(ITEMS)];
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const item = target?.closest('.menu-list button, .menu-list a');
    if (item && !item.closest('[data-keep-open]')) close();
  };
  const onOutside = (event: Event) => {
    if (node.open && !node.contains(event.target as Node)) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && node.open) {
      event.stopPropagation();
      close();
      node.querySelector('summary')?.focus();
      return;
    }
    // A select or a text field needs the arrow keys for itself.
    const target = event.target as HTMLElement;
    if (target.closest('.menu-list select, .menu-list input')) return;
    const list = items();
    const next = menuFocusTarget(
      event.key,
      list.indexOf(document.activeElement as HTMLElement),
      list.length,
    );
    if (next === null) return;
    if (!node.open) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      node.setAttribute('open', '');
    }
    event.preventDefault();
    list[next]?.focus();
  };
  node.addEventListener('click', onClick);
  node.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onOutside, true);
  return {
    destroy() {
      node.removeEventListener('click', onClick);
      node.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside, true);
    },
  };
}
