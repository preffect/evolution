// The one home of every HUD `data-testid` (docs/UI.md §7): components render these values, the
// input layer's focus rules query them and the Playwright acceptance loop (§8) asserts on them, so
// no id literal is typed twice. Keys are camelCase, values are the id strings docs/UI.md names.
//
// Only the ids shipped so far are listed; #187–#190 add their own as they land.

import type { PlayerId } from '@evolution/shared';

export const HUD_TEST_ID = {
  /** The HUD shell: the overlay layer over the canvas (docs/UI.md §7). */
  hud: 'hud',
  /** The own cell's status mirror: the accessibility and test surface of §3.1.2's indicators. */
  ownCell: 'hud-own-cell',
  /** The leaderboard panel, compact or expanded (docs/UI.md §3.1.1). */
  leaderboard: 'leaderboard',
  /** The panel's header: `LEADERBOARD` with the `TAB` hint; clicking it toggles the full list. */
  leaderboardHeader: 'leaderboard-header',
  /** The row list, carried only while the full list is open (docs/UI.md §3.1.1). */
  leaderboardFull: 'leaderboard-full',
  /** The round clock's `m:ss` readout (docs/UI.md §3.1.1). */
  roundClock: 'hud-round-clock',
  /** The caption under it: `ROUND`, or `BLOOM` once the bloom starts. */
  roundPhase: 'hud-round-phase',
  /** The trait picker's container (docs/UI.md §3.2, #188). */
  traitOffer: 'trait-offer',
  /** The Escape menu's panel (docs/UI.md §3.5, #189). */
  menuOverlay: 'menu-overlay',
  /** The results panel (docs/UI.md §3.4, #189). */
  resultsOverlay: 'results-overlay',
} as const;

/** One leaderboard row, by the player it names (docs/UI.md §3.1.1). */
export function leaderboardRowTestId(id: PlayerId): string {
  return `leaderboard-row-${id}`;
}

/** `[data-testid="…"]`, the one place the attribute name is spelled. */
export function testIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}
