// Test support (docs/testing/tiers-and-builders.md §4): a quantity as `formatQuantity` writes it, from a readable
// literal. The formatter makes every space inside a quantity non-breaking, so a line never breaks between a number
// and its unit (#858); a spec writes `unbroken('+0.3 mass / s')` rather than an invisible character or an escape.

import { NO_BREAK_SPACE } from '../app/game/quantities/quantity-unit';

/** `text` with every space non-breaking: write only the quantity in it, never the words around it. */
export function unbroken(text: string): string {
  return text.replaceAll(' ', NO_BREAK_SPACE);
}
