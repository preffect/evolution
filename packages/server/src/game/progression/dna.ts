// DNA and tag-point gains (docs/PROGRESSION.md §1). Every DNA gain except the late-join gift is
// multiplied by the folded `dnaGainMultiplier`; level-ups are applied later in the tick by
// `levels.ts` (step 7), so a gain only moves the counters.

import type { DnaTag } from '@evolution/shared';
import type { PlayerRecord } from '../world/entities.js';

/** Adds `amount × multiplier` to the lifetime and the toward-next-level counters. */
export function gainDna(player: PlayerRecord, amount: number, multiplier: number): void {
  const gained = amount * multiplier;
  player.dnaCumulative += gained;
  player.dnaTowardNextLevel += gained;
}

export function gainTagPoints(player: PlayerRecord, tag: DnaTag, points: number): void {
  player.dnaTagPoints[tag] += points;
}

/** The catch-up gift (docs/PROGRESSION.md §5): counts toward levels, never toward score, never multiplied. */
export function grantCatchUpGift(player: PlayerRecord, dna: number): void {
  player.dnaCumulative += dna;
  player.dnaCatchUpGift += dna;
  player.dnaTowardNextLevel += dna;
}
