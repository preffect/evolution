// The one home of every HUD `data-testid` (docs/ui/components-and-constants.md §7): components render these values, the
// input layer's focus rules query them and the Playwright acceptance loop (§8) asserts on them, so
// no id literal is typed twice. Keys are camelCase, values are the id strings docs/UI.md names.
//
// Only the ids shipped so far are listed; #187–#190 add their own as they land.

import type { MassRateCause, PlayerId, TraitId } from '@evolution/shared';

export const HUD_TEST_ID = {
  /** The HUD shell: the overlay layer over the canvas (docs/ui/components-and-constants.md §7). */
  hud: 'hud',
  /** The own cell's status mirror: the accessibility and test surface of §3.1.2's indicators. */
  ownCell: 'hud-own-cell',
  /** The leaderboard panel, compact or expanded (docs/ui/hud.md §3.1.1). */
  leaderboard: 'leaderboard',
  /** The panel's header: `LEADERBOARD` with the `TAB` hint; clicking it toggles the full list. */
  leaderboardHeader: 'leaderboard-header',
  /** The label strip under the header: `LV SCORE`, or `LV SCORE MASS ENGULFS` on the full list. */
  leaderboardLabels: 'leaderboard-labels',
  /** The full list's score rule, `SCORE = DNA + 25 PER ENGULF · KEPT ON DEATH`. */
  leaderboardFooter: 'leaderboard-footer',
  /** The row list, carried only while the full list is open (docs/ui/hud.md §3.1.1). */
  leaderboardFull: 'leaderboard-full',
  /** The round clock's `m:ss` readout (docs/ui/hud.md §3.1.1). */
  roundClock: 'hud-round-clock',
  /** The caption under it: `ROUND`, or `BLOOM` once the bloom starts. */
  roundPhase: 'hud-round-phase',
  /** The trait picker's container (docs/ui/overlays.md §3.2, #188). */
  traitOffer: 'trait-offer',
  /** The picker's `6.5 s` timer text (docs/ui/overlays.md §3.2). */
  traitOfferTimer: 'trait-offer-timer',
  /** The ribbon on the card that climbs the ladder. */
  traitCardRung: 'trait-card-rung',
  /** The `I → II` mark on a card that upgrades an owned trait. */
  traitCardUpgrade: 'trait-card-upgrade',
  /** The Escape menu's panel (docs/ui/overlays.md §3.5, #189). */
  menuOverlay: 'menu-overlay',
  /** The results panel (docs/ui/overlays.md §3.4, #189). */
  resultsOverlay: 'results-overlay',
  /** The connection banner, with `data-connection-state` (docs/ui/overlays.md §3.6, #219). */
  connectionBanner: 'connection-banner',
  /** The server's newest `error` message in play, under the banner (#219). */
  serverError: 'hud-server-error',
  /** The control that dismisses it. */
  serverErrorDismiss: 'hud-server-error-dismiss',
  /** The hold-Tab "affecting you" panel, beside the full board (docs/ui/overlays.md §3.7, #387). */
  affectingPanel: 'affecting-panel',
  /** Its mass element: the mass, its trend glyph, the net rate and the sparkline. */
  affectingMass: 'affecting-mass',
  /** The gain from the `eat` effects of the last `AFFECTING_FOOD_WINDOW_SECONDS`, as a rate. */
  affectingCauseFood: 'affecting-cause-food',
  /** The zone row; absent in the open broth, which has nothing to say. */
  affectingZone: 'affecting-zone',
  /** The bloom row, only once the bloom has started. */
  affectingBloom: 'affecting-bloom',
  /** The largest plain cell the own cell can engulf. */
  affectingPreyBelow: 'affecting-prey-below',
  /** The mass a cell needs to engulf the own cell. */
  affectingThreatAbove: 'affecting-threat-above',
  /** The size's own speed cost, before traits. */
  affectingSpeed: 'affecting-speed',
  /** The standing against the world clock. */
  affectingWorld: 'affecting-world',
} as const;

/** One mass-cause row, by the cause it names (docs/ui/overlays.md §3.7). */
export function affectingCauseTestId(cause: MassRateCause): string {
  return `affecting-cause-${cause}`;
}

/** One owned-trait row, by the trait it names (docs/ui/overlays.md §3.7). */
export function affectingTraitTestId(traitId: TraitId): string {
  return `affecting-trait-${traitId}`;
}

/** One leaderboard row, by the player it names (docs/ui/hud.md §3.1.1). */
export function leaderboardRowTestId(id: PlayerId): string {
  return `leaderboard-row-${id}`;
}

/** One trait card, by its index in the offer (docs/ui/overlays.md §3.2). */
export function traitCardTestId(cardIndex: number): string {
  return `trait-card-${cardIndex}`;
}

/** The card's pick control. */
export function traitCardPickTestId(cardIndex: number): string {
  return `trait-card-${cardIndex}-pick`;
}

/** `[data-testid="…"]`, the one place the attribute name is spelled. */
export function testIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}
