// The death seam (docs/GAME-DESIGN.md §5.2, docs/ECOLOGY.md §1, §6.1 payout "Prey" row). The
// engulf slice calls `absorbCell` at payout; `removePlayer` calls `dissolveCell`. Both drop
// detritus: `DETRITUS_MASS_FRACTION` of the mass in motes of `DETRITUS_MOTE_MASS` (floor), scattered
// uniformly within twice the cell's radius from the `spawner` stream.

import {
  EFFECT_KIND,
  FOOD_KIND,
  PLAYER_LIFE_STATE,
  RANDOM_STREAM,
  secondsToTicks,
  uniformPointInDiscAround,
  type RandomSource,
} from '@evolution/shared';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { removeFromArray, requirePlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';

const DETRITUS_SCATTER_RADII = 2;

/** `floor(fraction × mass / moteMass)` motes; the remainder is dropped (docs/ECOLOGY.md §1). */
export function detritusMoteCount(mass: number, world: WorldState): number {
  const ecology = world.balance.ecology;
  return Math.floor((ecology.DETRITUS_MASS_FRACTION * mass) / ecology.DETRITUS_MOTE_MASS);
}

export function dropDetritus(world: WorldState, cell: CellRecord, spawner: RandomSource): void {
  const count = detritusMoteCount(cell.mass, world);
  for (let index = 0; index < count; index += 1) {
    const point = uniformPointInDiscAround(
      cell,
      cell.radius * DETRITUS_SCATTER_RADII,
      spawner.nextFloat(),
      spawner.nextFloat(),
    );
    spawnFoodMote(world, { kind: FOOD_KIND.detritus, variant: null, at: point });
  }
}

/** Removes the cell from the world; the player keeps level, traits and stage (they live on the record). */
export function dissolveCell(world: WorldState, cell: CellRecord, spawner: RandomSource): void {
  dropDetritus(world, cell, spawner);
  removeFromArray(world.cells, cell);
}

function startSpectating(world: WorldState, player: PlayerRecord, killer: PlayerRecord, kept: number): void {
  player.lifeState = PLAYER_LIFE_STATE.spectating;
  player.spectatingPlayerId = killer.playerId;
  player.respawnInTicks = secondsToTicks(world.balance.session.RESPAWN_SPECTATE_SECONDS);
  player.dnaTowardNextLevel *= kept;
}

/**
 * The prey side of an engulf payout: the cell is removed this tick, detritus dropped, the
 * `cell_absorbed` effect emitted and the player spectates the killer until respawn, keeping
 * `dnaKeptOnDeathFraction` of its progress.
 */
export function absorbCell(world: WorldState, context: StepContext, prey: CellRecord, predator: CellRecord): void {
  const player = requirePlayer(world, prey.playerId);
  const killer = requirePlayer(world, predator.playerId);
  context.effects.push({
    kind: EFFECT_KIND.cellAbsorbed,
    tick: world.tick,
    x: prey.x,
    y: prey.y,
    cellId: prey.id,
    playerId: player.playerId,
    predatorCellId: predator.id,
  });
  dissolveCell(world, prey, context.streams[RANDOM_STREAM.spawner]);
  startSpectating(world, player, killer, prey.modifiers.dnaKeptOnDeathFraction);
}
