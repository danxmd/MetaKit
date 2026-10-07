/**
 * Behaviour for `<details class="menu">`: it closes when an item is chosen, when the person
 * clicks elsewhere, and on Escape. Items that should keep it open (a setting, a choice) sit
 * inside an element with `data-keep-open`.
 */
export function menuBehaviour(node: HTMLDetailsElement) {
  const close = () => node.removeAttribute('open');
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
      close();
      node.querySelector('summary')?.focus();
    }
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
