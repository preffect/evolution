// Score and ranking (docs/GAME-DESIGN.md §5.3, docs/ARCHITECTURE.md §2): computed, never stored
// twice. `score = (dnaCumulative − dnaCatchUpGift) + SCORE_ABSORPTION_BONUS × absorptions`; ties
// by current mass, then by earliest join. Step 10 of the tick.

import type { LeaderboardRow } from '@evolution/shared';
import type { PlayerRecord } from '../world/entities.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';

export function scoreOf(player: PlayerRecord, absorptionBonus: number): number {
  return player.dnaCumulative - player.dnaCatchUpGift + absorptionBonus * player.absorptions;
}

interface RankedPlayer {
  readonly player: PlayerRecord;
  readonly mass: number;
}

function compareRanked(left: RankedPlayer, right: RankedPlayer): number {
  return (
    right.player.score - left.player.score || right.mass - left.mass || left.player.joinOrder - right.player.joinOrder
  );
}

/** Writes every player's `score` and the ranked rows; a spectating player ranks with mass 0. */
export function updateLeaderboard(world: WorldState): void {
  const bonus = world.balance.session.SCORE_ABSORPTION_BONUS;
  const ranked: RankedPlayer[] = world.players.map((player) => {
    player.score = scoreOf(player, bonus);
    return { player, mass: findCellOfPlayer(world, player.playerId)?.mass ?? 0 };
  });
  ranked.sort(compareRanked);
  world.leaderboard = ranked.map(({ player, mass }, index): LeaderboardRow => ({
    rank: index + 1,
    playerId: player.playerId,
    score: player.score,
    mass,
    level: player.level,
    absorptions: player.absorptions,
  }));
}
