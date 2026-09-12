// The death seam (docs/GAME-DESIGN.md §5.2, docs/ECOLOGY.md §1, §6.1 payout "Prey" row). The
// engulf slice calls `absorbCell` at payout; `removePlayer` calls `dissolveCell`. Both drop
// detritus: `DETRITUS_MASS_FRACTION` of the mass in motes of `DETRITUS_MOTE_MASS` (floor), scattered
// uniformly within `DETRITUS_SCATTER_RADIUS_FACTOR` radii of the centre from the `spawner` stream.

import {
  EFFECT_KIND,
  FOOD_KIND,
  PLAYER_LIFE_STATE,
  RANDOM_STREAM,
  secondsToTicks,
  uniformPointInDiscAround,
  type RandomSource,
} from '@evolution/shared';
import { abortEngulfsOf } from '../simulation/engulf.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import { isPlayerCell, type CellRecord, type PlayerRecord } from '../world/entities.js';
import { removeFromArray, requirePlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';

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
      cell.radius * world.balance.ecology.DETRITUS_SCATTER_RADIUS_FACTOR,
      spawner.nextFloat(),
      spawner.nextFloat(),
    );
    spawnFoodMote(world, { kind: FOOD_KIND.detritus, variant: null, at: point });
  }
}

/** A spectator's camera loses its target once the cell it followed is gone (docs/ARCHITECTURE.md §2). */
function forgetSpectatedCell(world: WorldState, cell: CellRecord): void {
  for (const player of world.players) {
    if (player.spectatingCellId === cell.id) {
      player.spectatingCellId = null;
    }
  }
}

/**
 * Removes the cell from the world; the player keeps level, traits and stage (they live on the
 * record). Any engulf it was part of ends first with reason `aborted` (docs/ECOLOGY.md §6.3): a
 * predator whose prey left gets no payout, and a prey whose predator left is freed where it is.
 */
export function dissolveCell(world: WorldState, cell: CellRecord, spawner: RandomSource): void {
  abortEngulfsOf(world, cell);
  dropDetritus(world, cell, spawner);
  removeFromArray(world.cells, cell);
  forgetSpectatedCell(world, cell);
}

function startSpectating(world: WorldState, player: PlayerRecord, killer: CellRecord, kept: number): void {
  player.lifeState = PLAYER_LIFE_STATE.spectating;
  player.spectatingCellId = killer.id;
  player.respawnInTicks = secondsToTicks(world.balance.session.RESPAWN_SPECTATE_SECONDS);
  player.dnaTowardNextLevel *= kept;
}

/**
 * The prey side of an engulf payout: the cell is removed this tick, detritus dropped, the
 * `cell_absorbed` effect emitted and the player spectates the killer's cell (a player's or a
 * wild one) until respawn, keeping `dnaKeptOnDeathFraction` of its progress. A wild prey has no
 * player to spectate: the wild-cell slice removes its cell through `dissolveCell` alone.
 */
export function absorbCell(world: WorldState, context: StepContext, prey: CellRecord, predator: CellRecord): void {
  if (!isPlayerCell(prey)) {
    dissolveCell(world, prey, context.streams[RANDOM_STREAM.spawner]);
    return;
  }
  const player = requirePlayer(world, prey.playerId);
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
  startSpectating(world, player, predator, prey.modifiers.dnaKeptOnDeathFraction);
}
