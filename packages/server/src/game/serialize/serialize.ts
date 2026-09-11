// Records → views (docs/ARCHITECTURE.md §2, §4): the one projection from the server records onto
// the wire types. Positions are quantised to `SNAPSHOT_POSITION_DECIMALS`; every array and
// record is copied so a snapshot never aliases the world. Full snapshots carry every mote;
// delta snapshots carry the food delta of a tracker and the effects since the last broadcast.

import {
  SNAPSHOT_POSITION_DECIMALS,
  type CellView,
  type DnaFragmentView,
  type FoodMoteView,
  type GameEffect,
  type GameSnapshot,
  type MotePositionView,
  type PlayerProgressView,
  type TraitOfferView,
} from '@evolution/shared';
import type { CellRecord, DnaFragmentRecord, FoodMoteRecord, PlayerRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import type { FoodDeltaTracker } from './food-delta-tracker.js';

const DECIMAL_BASE = 10;
const POSITION_SCALE = DECIMAL_BASE ** SNAPSHOT_POSITION_DECIMALS;

/** Rounds a world coordinate to the wire precision. */
export function quantizePosition(value: number): number {
  return Math.round(value * POSITION_SCALE) / POSITION_SCALE;
}

export function toCellView(cell: CellRecord): CellView {
  return {
    id: cell.id,
    kind: cell.kind,
    playerId: cell.playerId,
    organismId: cell.organismId,
    avatarIndex: cell.avatarIndex,
    x: quantizePosition(cell.x),
    y: quantizePosition(cell.y),
    velocityX: cell.velocityX,
    velocityY: cell.velocityY,
    mass: cell.mass,
    radius: cell.radius,
    level: cell.level,
    stage: cell.stage,
    traits: cell.traits.map((trait) => ({ ...trait })),
    membraneRatioBonus: cell.membraneRatioBonus,
    states: [...cell.states],
    engulfProgress: cell.engulfProgress,
    engulfingCellId: cell.engulfingCellId,
    engulfedByCellId: cell.engulfedByCellId,
    sprintRemainingTicks: cell.sprintRemainingTicks,
    sprintCooldownRemainingTicks: cell.sprintCooldownRemainingTicks,
  };
}

export function toFoodMoteView(mote: FoodMoteRecord): FoodMoteView {
  return {
    id: mote.id,
    kind: mote.kind,
    bacteriumVariant: mote.bacteriumVariant,
    x: quantizePosition(mote.x),
    y: quantizePosition(mote.y),
  };
}

export function toMotePositionView(mote: FoodMoteRecord): MotePositionView {
  return { id: mote.id, x: quantizePosition(mote.x), y: quantizePosition(mote.y) };
}

export function toDnaFragmentView(fragment: DnaFragmentRecord): DnaFragmentView {
  return { id: fragment.id, x: quantizePosition(fragment.x), y: quantizePosition(fragment.y), tag: fragment.tag };
}

function copyOffer(offer: TraitOfferView | null): TraitOfferView | null {
  if (offer === null) {
    return null;
  }
  return {
    offerId: offer.offerId,
    cards: offer.cards.map((card) => ({ ...card })),
    expiresAtTick: offer.expiresAtTick,
  };
}

export function toPlayerProgressView(player: PlayerRecord): PlayerProgressView {
  return {
    playerId: player.playerId,
    playerName: player.playerName,
    level: player.level,
    dnaCumulative: player.dnaCumulative,
    dnaCatchUpGift: player.dnaCatchUpGift,
    dnaTowardNextLevel: player.dnaTowardNextLevel,
    dnaTagPoints: { ...player.dnaTagPoints },
    bacteriaEatenByVariant: { ...player.bacteriaEatenByVariant },
    absorptions: player.absorptions,
    wildAbsorptions: player.wildAbsorptions,
    score: player.score,
    offer: copyOffer(player.offer),
    lifeState: player.lifeState,
    spectatingCellId: player.spectatingCellId,
    respawnInTicks: player.respawnInTicks,
  };
}

/** Everything but the food and the effects: what the full and the delta snapshot share. */
function serializeCommon(world: WorldState): Omit<GameSnapshot, 'food' | 'effects'> {
  const players: Record<string, PlayerProgressView> = {};
  const appliedInputSequenceByPlayer: Record<string, number> = {};
  for (const player of world.players) {
    players[player.playerId] = toPlayerProgressView(player);
    appliedInputSequenceByPlayer[player.playerId] = player.appliedInputSequence;
  }
  return {
    tick: world.tick,
    seed: world.seed,
    roundStartTick: world.roundStartTick,
    roundPhase: world.roundPhase,
    roundTimeLeftMs: world.roundTimeLeftMs,
    gelPatches: world.gelPatches.map((patch) => ({ ...patch })),
    cells: world.cells.map(toCellView),
    dnaFragments: world.dnaFragments.map(toDnaFragmentView),
    players,
    leaderboard: world.leaderboard.map((row) => ({ ...row })),
    appliedInputSequenceByPlayer,
  };
}

/** The `game_state` snapshot: every mote in `food.spawned`, no effects (docs/ARCHITECTURE.md §4). */
export function serializeFullSnapshot(world: WorldState): GameSnapshot {
  return {
    ...serializeCommon(world),
    food: { spawned: world.food.map(toFoodMoteView), removedIds: [], moved: [] },
    effects: [],
  };
}

/** The `game_snapshot` broadcast: the food delta since the previous broadcast and the effects since it. */
export function serializeDeltaSnapshot(
  world: WorldState,
  tracker: FoodDeltaTracker,
  effects: readonly GameEffect[],
): GameSnapshot {
  return { ...serializeCommon(world), food: tracker.diff(world.food), effects: [...effects] };
}
