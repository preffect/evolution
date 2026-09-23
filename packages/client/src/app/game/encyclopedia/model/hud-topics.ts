// How to read the HUD, one page per element (docs/architecture/encyclopedia.md §12.4). Each topic is anchored to what
// draws its element: a DOM element by its `HUD_TEST_ID` key, or a renderer-drawn indicator by its field of the
// `OwnCellIndicators` record, since the five indicators share the one `ownCell` status mirror and a test id alone
// would anchor none of them. A removed or renamed element fails `typecheck`; the completeness spec pins that the
// anchors are pairwise distinct.

import type { ValueOf } from '@evolution/shared';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import type { HUD_TEST_ID } from '../../test-ids/hud-test-ids';

export const HUD_TOPIC = {
  dnaRing: 'dna_ring',
  levelNumeral: 'level_numeral',
  ladderOrbit: 'ladder_orbit',
  selfRing: 'self_ring',
  threatRing: 'threat_ring',
  leaderboard: 'leaderboard',
  roundClock: 'round_clock',
} as const;
export type HudTopicId = ValueOf<typeof HUD_TOPIC>;

export const HUD_ELEMENT_KIND = { dom: 'dom', indicator: 'indicator' } as const;

/** What draws a topic's element: a DOM element the HUD renders, or an indicator the renderer draws on the own cell. */
export type HudElementAnchor =
  | { readonly kind: typeof HUD_ELEMENT_KIND.dom; readonly testId: keyof typeof HUD_TEST_ID }
  | { readonly kind: typeof HUD_ELEMENT_KIND.indicator; readonly field: keyof OwnCellIndicators };

function domElement(testId: keyof typeof HUD_TEST_ID): HudElementAnchor {
  return { kind: HUD_ELEMENT_KIND.dom, testId };
}

function indicator(field: keyof OwnCellIndicators): HudElementAnchor {
  return { kind: HUD_ELEMENT_KIND.indicator, field };
}

export const HUD_ELEMENT_BY_TOPIC: Readonly<Record<HudTopicId, HudElementAnchor>> = {
  [HUD_TOPIC.dnaRing]: indicator('dnaFraction'),
  [HUD_TOPIC.levelNumeral]: indicator('level'),
  [HUD_TOPIC.ladderOrbit]: indicator('ladder'),
  /** The identity ring is the sprint ring (docs/ui/hud.md §3.1.2). */
  [HUD_TOPIC.selfRing]: indicator('sprintFill'),
  [HUD_TOPIC.threatRing]: indicator('nearestThreat'),
  [HUD_TOPIC.leaderboard]: domElement('leaderboard'),
  [HUD_TOPIC.roundClock]: domElement('roundClock'),
};
