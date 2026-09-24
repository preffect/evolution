// The death seam (docs/game-design/session.md §5.2, docs/ecology/food-and-spawn.md §1, docs/ecology/absorption.md §6.1 payout "Prey" row). The
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
import type { MeasuredGain } from '../simulation/cell-mass.js';
import { abortEngulfsOf } from '../simulation/engulf-state.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import { isPlayerCell, type CellRecord, type PlayerRecord } from '../world/entities.js';
import { removeFromArray, requirePlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';

/**
 * `floor(fraction × mass / moteMass)` motes; the remainder is dropped (docs/ecology/food-and-spawn.md §1). The
 * fraction is `DETRITUS_MASS_FRACTION` unless the death says otherwise (a starved wild cell's feast, §3.3.6).
 */
export function detritusMoteCount(
  mass: number,
  world: WorldState,
  massFraction = world.balance.ecology.DETRITUS_MASS_FRACTION,
): number {
  return Math.floor((massFraction * mass) / world.balance.ecology.DETRITUS_MOTE_MASS);
}

export function dropDetritus(
  world: WorldState,
  cell: CellRecord,
  spawner: RandomSource,
  massFraction = world.balance.ecology.DETRITUS_MASS_FRACTION,
): void {
  const count = detritusMoteCount(cell.mass, world, massFraction);
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

/** A spectator's camera loses its target once the cell it followed is gone (docs/architecture/entity-model.md §2). */
function forgetSpectatedCell(world: WorldState, cell: CellRecord): void {
  for (const player of world.players) {
    if (player.spectatingCellId === cell.id) {
      player.spectatingCellId = null;
    }
  }
}

/**
 * Removes the cell from the world without a trace: no detritus. Any engulf it was part of ends first with reason
 * `aborted` (docs/ecology/absorption.md §6.3): a predator whose prey left gets no payout, and a prey whose predator
 * left is freed where it is. A scenario fixture replacing a wild seat's cell takes this path
 * (docs/testing/scenario-runner.md §8.1, `.placeWildCell`); a death or a removal dissolves instead.
 */
export function withdrawCell(world: WorldState, cell: CellRecord): void {
  abortEngulfsOf(world, cell);
  removeFromArray(world.cells, cell);
  forgetSpectatedCell(world, cell);
}

/**
 * Removes the cell from the world with its detritus (`massFraction` of its mass, the §1 rule by default); the player
 * keeps level, traits and stage (they live on the record).
 */
export function dissolveCell(
  world: WorldState,
  cell: CellRecord,
  spawner: RandomSource,
  massFraction = world.balance.ecology.DETRITUS_MASS_FRACTION,
): void {
  dropDetritus(world, cell, spawner, massFraction);
  withdrawCell(world, cell);
}

/**
 * The tick the cell died is spectated too (#211, the respawn convention). A death happens at step 6
 * (the engulf payout) and the countdown runs at step 9 of that same tick, so without this the
 * spectate would be one tick short of `RESPAWN_SPECTATE_SECONDS`. With it, a death on tick t places
 * the new cell on t + `RESPAWN_SPECTATE_SECONDS` × `TICK_HZ` + 1, which is what docs/GAME-DESIGN.md
 * §5.2 (G8, G13) and docs/ecology/acceptance.md §8.1 (W4) state.
 *
 * It is the step order that makes it right, and only the payout calls `absorbCell` today: a death
 * reaching `startSpectating` from *outside* a tick, or from a step after 9, would spend no countdown
 * tick on its own tick and land on t + 181 + 1. A caller added there adjusts this, or moves the
 * "+ 1" into the countdown where the tick of death can be compared.
 */
const SPECTATED_DEATH_TICK = 1;

function startSpectating(world: WorldState, player: PlayerRecord, killer: CellRecord, kept: number): void {
  player.lifeState = PLAYER_LIFE_STATE.spectating;
  player.spectatingCellId = killer.id;
  player.respawnInTicks = secondsToTicks(world.balance.session.RESPAWN_SPECTATE_SECONDS) + SPECTATED_DEATH_TICK;
  player.dnaTowardNextLevel *= kept;
}

/** A completed engulf as the prey's death reads it: the two cells and what the predator's payout added (#383). */
export interface Absorption {
  readonly prey: CellRecord;
  readonly predator: CellRecord;
  readonly predatorGain: MeasuredGain;
}

/**
 * The prey side of an engulf payout: the cell is removed this tick, detritus dropped, the
 * `cell_absorbed` effect emitted and the player spectates the killer's cell (a player's or a
 * wild one) until respawn, keeping `dnaKeptOnDeathFraction` of its progress.
 *
 * A wild prey (docs/ecology/wild-cells.md §3.3) takes the same path with `playerId: null` on the effect
 * (#270): the renderer's absorbed clip, DNA streams and ghost key on `cellId`, so the player who ate it sees
 * the dissolve; it has no player to spectate, so the countdown is skipped.
 */
export function absorbCell(world: WorldState, context: StepContext, absorption: Absorption): void {
  const { prey, predator, predatorGain } = absorption;
  context.effects.push({
    kind: EFFECT_KIND.cellAbsorbed,
    tick: world.tick,
    x: prey.x,
    y: prey.y,
    cellId: prey.id,
    playerId: prey.playerId,
    predatorCellId: predator.id,
    predatorMassGained: predatorGain.massGained,
    predatorDnaGained: predatorGain.dnaGained,
  });
  dissolveCell(world, prey, context.streams[RANDOM_STREAM.spawner]);
  if (isPlayerCell(prey)) {
    const player = requirePlayer(world, prey.playerId);
    startSpectating(world, player, predator, prey.modifiers.dnaKeptOnDeathFraction);
  }
}
