// The sprint ring's fill (docs/ui/hud.md §3.1.2). The ring is the own cell's identity ring: it is
// always drawn, and this is how much of it has recharged. Pure, so the rule is tested without a
// camera; the renderer turns it into an arc (#187) and the status mirror turns it into a word.
//
// There is no client-side estimate: the server's `sprintCooldownRemainingTicks` is the only clock,
// so a cooldown shortened by a folded trait modifier simply starts partly drawn.

import { clamp, secondsToTicks, type BalanceConfig, type CellView } from '@evolution/shared';

/** A full ring: the sprint is ready. Exported because the status mirror reads the same bound. */
export const READY = 1;
const EMPTY = 0;

/** The `balance.controls` rows the fill reads; the room's live copy, so `debug_set_balance` is felt. */
export type SprintFillBalance = Pick<BalanceConfig['controls'], 'SPRINT_COOLDOWN_SECONDS'>;

/** What the fill needs of the own cell: the two sprint clocks the snapshot carries. */
export type SprintFillCell = Pick<CellView, 'sprintCooldownRemainingTicks'>;

/**
 * 0..1, where 1 is ready. `1 − remaining / cooldownTicks`, clamped, so a cooldown that is longer
 * than the balance says (or a zero-length one) still answers inside the range.
 */
export function sprintFillFor(cell: SprintFillCell, balance: SprintFillBalance): number {
  const remaining = cell.sprintCooldownRemainingTicks;
  if (remaining <= EMPTY) return READY;
  const cooldownTicks = secondsToTicks(balance.SPRINT_COOLDOWN_SECONDS);
  if (cooldownTicks <= EMPTY) return READY;
  return clamp(READY - remaining / cooldownTicks, EMPTY, READY);
}
