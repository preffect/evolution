// What a keycap shows for a key (docs/ui/components-and-constants.md §10.2, `ui-key-hint`). A feature names a key
// the way `KeyboardEvent.key` does, which is also what `aria-keyshortcuts` wants; the cap shows a short
// word or an arrow instead of the long names. Caps are set uppercase by the stylesheet.

/** Keyed by `KeyboardEvent.key` names, which are PascalCase, so a map rather than an object literal. */
const KEY_CAP_LABEL: ReadonlyMap<string, string> = new Map([
  ['Escape', 'Esc'],
  [' ', 'Space'],
  ['ArrowUp', '↑'],
  ['ArrowDown', '↓'],
  ['ArrowLeft', '←'],
  ['ArrowRight', '→'],
]);

/** The cap's text for a `KeyboardEvent.key` name; a key with no short form shows as it is. */
export function keyCapLabel(key: string): string {
  return KEY_CAP_LABEL.get(key) ?? key;
}
