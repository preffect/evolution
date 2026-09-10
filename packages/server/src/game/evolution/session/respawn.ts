// Step 9 (docs/GAME-DESIGN.md §5.2): a spectating player's timer counts down; on the tick after
// it reaches zero a new cell is placed by safe placement at the starting mass, level and traits
// intact, and a `respawn` effect is emitted.

import { EFFECT_KIND, PLAYER_LIFE_STATE, RANDOM_STREAM } from '@evolution/shared';
import type { PlayerRecord } from '../world/entities.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { spawnCellForPlayer } from './players.js';

function respawnPlayer(world: WorldState, player: PlayerRecord, context: StepContext): void {
  const cell = spawnCellForPlayer(
    world,
    player,
    context.balance.growth.CELL_STARTING_MASS,
    context.streams[RANDOM_STREAM.spawnPlacement],
  );
  context.effects.push({
    kind: EFFECT_KIND.respawn,
    tick: world.tick,
    x: cell.x,
    y: cell.y,
    cellId: cell.id,
    playerId: player.playerId,
  });
}

export function runRespawns(world: WorldState, context: StepContext): void {
  for (const player of world.players) {
    if (player.lifeState !== PLAYER_LIFE_STATE.spectating) {
      continue;
    }
    if (player.respawnInTicks > 0) {
      player.respawnInTicks -= 1;
    } else {
      respawnPlayer(world, player, context);
    }
  }
}
