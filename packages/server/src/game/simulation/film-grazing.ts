// The rock pool's bacteria films (docs/game-design/phases.md §14.5.2): a player cell moving at under half its top speed
// with its centre over a film grazes it, gaining `POOL_FILM_GRAZE_MASS_PER_SECOND` through the cap (its overflow the
// owner's DNA, as any gain). Step 5 runs it after the light, so the mass flow reports it as its own cause (`graze`).
// Only once the world is in the pool, where the films are. A cell held in an engulf does not graze, and neither does a
// wild cell, whose size its seat settles (docs/ecology/wild-cells.md §3.3.1).

import { GAME_ERA, TICK_INTERVAL_S, isOverPoolFilm, type BalanceConfig } from '@evolution/shared';
import type { PlayerCellRecord } from '../world/entities.js';
import { requirePlayer } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import { gainMass } from './cell-mass.js';
import { speedCapOf } from './movement.js';

/** A cell grazes only below this share of its top speed (§14.5.2: "under half"). */
export const FILM_GRAZE_MAX_SPEED_SHARE = 0.5;

/** In the pool, free of any engulf as prey, centred over a film and slower than half the speed cap it moved under. */
export function isGrazingFilm(cell: PlayerCellRecord, world: WorldState, balance: BalanceConfig): boolean {
  if (world.eraMovedInto === GAME_ERA.dish || world.poolLayout === null || cell.engulfedByCellId !== null) {
    return false;
  }
  const speed = Math.hypot(cell.velocityX, cell.velocityY);
  return (
    isOverPoolFilm(cell, world.poolLayout.films, balance) &&
    speed < FILM_GRAZE_MAX_SPEED_SHARE * speedCapOf(cell, world, balance)
  );
}

/** One tick of a film's graze for a player cell that is grazing; nothing otherwise. */
export function grazeFilm(cell: PlayerCellRecord, world: WorldState, balance: BalanceConfig): void {
  if (isGrazingFilm(cell, world, balance)) {
    const gain = balance.pool.POOL_FILM_GRAZE_MASS_PER_SECOND * TICK_INTERVAL_S;
    gainMass(cell, requirePlayer(world, cell.playerId), gain, balance);
  }
}
