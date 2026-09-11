// Level thresholds and level-ups (docs/PROGRESSION.md §2): the cost formulas are the shared
// `levelUpCost` / `cumulativeDnaForLevel`; gains carry over, one gain may produce several level-ups and each queues a
// draft. Step 7 of the tick runs the timeouts, the level-ups and the show-after-level-up.

import { EFFECT_KIND, cumulativeDnaForLevel, levelUpCost, type BalanceConfig } from '@evolution/shared';
import type { PlayerRecord } from '../world/entities.js';
import { findCellOfPlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { applyExpiredOffer, queueOffer, showQueuedOfferIfNone } from './offers.js';

/** A fresh player's level (docs/PROGRESSION.md §2). */
export const FIRST_LEVEL = 1;

/** The highest level, at most `MAX_LEVEL`, whose cumulative cost `dna` covers (the shared `cumulativeDnaForLevel`). */
export function levelForCumulativeDna(dna: number, balance: BalanceConfig): number {
  let level = FIRST_LEVEL;
  while (level < balance.progression.MAX_LEVEL && dna >= cumulativeDnaForLevel(level + 1, balance.progression)) {
    level += 1;
  }
  return level;
}

function syncCellLevel(world: WorldState, player: PlayerRecord): void {
  const cell = findCellOfPlayer(world, player.playerId);
  if (cell !== undefined) {
    cell.level = player.level;
  }
}

/** Derives level and progress from `dnaCumulative` silently: no offers (fixtures and debug). */
export function setLevelFromCumulativeDna(world: WorldState, player: PlayerRecord): void {
  player.level = levelForCumulativeDna(player.dnaCumulative, world.balance);
  player.dnaTowardNextLevel = player.dnaCumulative - cumulativeDnaForLevel(player.level, world.balance.progression);
  syncCellLevel(world, player);
}

function emitLevelUp(world: WorldState, player: PlayerRecord, context: StepContext): void {
  const cell = findCellOfPlayer(world, player.playerId);
  if (cell === undefined) {
    return;
  }
  cell.level = player.level;
  context.effects.push({
    kind: EFFECT_KIND.levelUp,
    tick: world.tick,
    x: cell.x,
    y: cell.y,
    cellId: cell.id,
    playerId: player.playerId,
    level: player.level,
  });
}

/** Spends the banked DNA on every level it covers; each level-up queues a draft. Returns levels gained. */
export function applyLevelUps(world: WorldState, player: PlayerRecord, context: StepContext): number {
  const { progression } = context.balance;
  let gained = 0;
  while (player.level < progression.MAX_LEVEL && player.dnaTowardNextLevel >= levelUpCost(player.level, progression)) {
    player.dnaTowardNextLevel -= levelUpCost(player.level, progression);
    player.level += 1;
    gained += 1;
    queueOffer(player);
    emitLevelUp(world, player, context);
  }
  return gained;
}

/** Step 7: timeouts, level-ups and the offer a fresh level-up shows, per player in join order. */
export function runProgression(world: WorldState, context: StepContext): void {
  for (const player of world.players) {
    applyExpiredOffer(world, player, context);
    if (applyLevelUps(world, player, context) > 0) {
      showQueuedOfferIfNone(world, player, context);
    }
  }
}
