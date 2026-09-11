// The bench scene's player records: one per player cell, alive, with a DNA fraction that climbs
// with the tick so the own-cell indicators (#100) have something to show.

import { PLAYER_LIFE_STATE, PLAYER_PALETTE_COUNT, type PlayerProgressView } from '@evolution/shared';
import { RENDER_BENCH_LEVEL_UP_EVERY_TICKS } from '../constants';
import type { BenchWorld } from './bench-scene';

export function benchPlayers(world: BenchWorld, tick: number): Record<string, PlayerProgressView> {
  const players: Record<string, PlayerProgressView> = {};
  for (const spec of world.cells) {
    if (spec.playerId === null) continue;
    players[spec.playerId] = {
      playerId: spec.playerId,
      playerName: `Bench ${spec.index}`,
      level: 1 + (spec.index % PLAYER_PALETTE_COUNT),
      dnaCumulative: tick,
      dnaCatchUpGift: 0,
      dnaTowardNextLevel: tick % RENDER_BENCH_LEVEL_UP_EVERY_TICKS,
      dnaTagPoints: { motile: 0, photic: 0, predatory: 0, armored: 0, toxic: 0, sensory: 0, metabolic: 0 },
      bacteriaEatenByVariant: { plain: 0, aerobic: 0, photosynthetic: 0 },
      absorptions: 0,
      wildAbsorptions: 0,
      score: spec.index,
      offer: null,
      lifeState: PLAYER_LIFE_STATE.alive,
      spectatingCellId: null,
      respawnInTicks: 0,
    };
  }
  return players;
}
