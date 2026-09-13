// One colour decision the HUD makes: a palette hex at an alpha, for the own leaderboard row's tint
// (docs/VISUAL-STYLE.md §7, rim colour @ 12 %). The hex values are `render/constants` and the
// channel split is `render/colour.ts`; this only names the operation so a component never builds a
// colour string inline.

import { BLUE, CHANNEL_MAX, GREEN, RED, hexToRgb } from '../../render/colour';

/** `rgba(...)` for a `#rrggbb` at `alpha` in 0..1; the channels are 0..1 floats scaled to bytes. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  const byte = (channel: number): number => Math.round(rgb[channel]! * CHANNEL_MAX);
  return `rgba(${byte(RED)}, ${byte(GREEN)}, ${byte(BLUE)}, ${alpha})`;
}
