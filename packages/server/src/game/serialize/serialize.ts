// Records → views (docs/architecture/entity-model.md §2, docs/architecture/wire-contract.md §4): the one projection from the server records onto
// the wire types. Numbers are quantised to the `SNAPSHOT_*_DECIMALS` of `netcode.ts` as wire-contract.md §4 "Wire
// precision" lists them (`quantize.ts`); every array and record is copied so a snapshot never
// aliases the world. Full snapshots carry every mote; delta snapshots carry the food delta of a tracker and the
// effects since the last broadcast.

import {
  SNAPSHOT_MASS_DECIMALS,
  SNAPSHOT_POSITION_DECIMALS,
  SNAPSHOT_RADIUS_DECIMALS,
  SNAPSHOT_SCORE_DECIMALS,
  SNAPSHOT_VELOCITY_DECIMALS,
  type CellView,
  type DnaFragmentView,
  type FoodMoteView,
  type GameEffect,
  type GameSnapshot,
  type LeaderboardRow,
  type MotePositionView,
  type PlayerId,
  type PlayerProgressView,
  type PlayerRosterView,
  type TraitOfferView,
} from '@evolution/shared';
import type { CellRecord, DnaFragmentRecord, FoodMoteRecord, PlayerRecord } from '../world/entities.js';
import { findPlayer } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import type { FoodDeltaTracker } from './food-delta-tracker.js';
import { WIRE_SNAPSHOT_VALUES, quantizeToDecimals, snapshotValue, type SnapshotPrecision } from './quantize.js';

export function toCellView(cell: CellRecord, precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES): CellView {
  return {
    id: cell.id,
    kind: cell.kind,
    playerId: cell.playerId,
    organismId: cell.organismId,
    avatarIndex: cell.avatarIndex,
    x: snapshotValue(cell.x, SNAPSHOT_POSITION_DECIMALS, precision),
    y: snapshotValue(cell.y, SNAPSHOT_POSITION_DECIMALS, precision),
    velocityX: snapshotValue(cell.velocityX, SNAPSHOT_VELOCITY_DECIMALS, precision),
    velocityY: snapshotValue(cell.velocityY, SNAPSHOT_VELOCITY_DECIMALS, precision),
    mass: snapshotValue(cell.mass, SNAPSHOT_MASS_DECIMALS, precision),
    radius: snapshotValue(cell.radius, SNAPSHOT_RADIUS_DECIMALS, precision),
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

export function toFoodMoteView(
  mote: FoodMoteRecord,
  precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES,
): FoodMoteView {
  return {
    id: mote.id,
    kind: mote.kind,
    bacteriumVariant: mote.bacteriumVariant,
    x: snapshotValue(mote.x, SNAPSHOT_POSITION_DECIMALS, precision),
    y: snapshotValue(mote.y, SNAPSHOT_POSITION_DECIMALS, precision),
  };
}

export function toMotePositionView(mote: FoodMoteRecord): MotePositionView {
  return {
    id: mote.id,
    x: quantizeToDecimals(mote.x, SNAPSHOT_POSITION_DECIMALS),
    y: quantizeToDecimals(mote.y, SNAPSHOT_POSITION_DECIMALS),
  };
}

export function toDnaFragmentView(
  fragment: DnaFragmentRecord,
  precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES,
): DnaFragmentView {
  return {
    id: fragment.id,
    x: snapshotValue(fragment.x, SNAPSHOT_POSITION_DECIMALS, precision),
    y: snapshotValue(fragment.y, SNAPSHOT_POSITION_DECIMALS, precision),
    tag: fragment.tag,
  };
}

/** A copy of a ranked row with its score and mass at the wire precision (docs/architecture/wire-contract.md §4.1). */
export function toLeaderboardRowView(
  row: LeaderboardRow,
  precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES,
): LeaderboardRow {
  return {
    ...row,
    score: snapshotValue(row.score, SNAPSHOT_SCORE_DECIMALS, precision),
    mass: snapshotValue(row.mass, SNAPSHOT_MASS_DECIMALS, precision),
  };
}

function copyOffer(offer: TraitOfferView | null): TraitOfferView | null {
  if (offer === null) {
    return null;
  }
  return {
    offerId: offer.offerId,
    level: offer.level,
    cards: offer.cards.map((card) => ({ ...card })),
    expiresAtTick: offer.expiresAtTick,
  };
}

/** The player's own progress; its score rounds as its leaderboard row's does, so the two never disagree. */
export function toPlayerProgressView(
  player: PlayerRecord,
  precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES,
): PlayerProgressView {
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
    score: snapshotValue(player.score, SNAPSHOT_SCORE_DECIMALS, precision),
    ownedTraits: player.ownedTraits.map((trait) => ({ ...trait })),
    stage: player.stage,
    offer: copyOffer(player.offer),
    lifeState: player.lifeState,
    spectatingCellId: player.spectatingCellId,
    respawnInTicks: player.respawnInTicks,
  };
}

/** What every client is sent of every player (docs/architecture/wire-contract.md §4.1). */
export function toPlayerRosterView(player: PlayerRecord): PlayerRosterView {
  return { playerId: player.playerId, playerName: player.playerName };
}

/**
 * What `viewerPlayerId` alone is sent of its own progress (docs/architecture/wire-contract.md §4.1): `null` for a
 * viewer with no player in the world.
 */
export function ownProgressOf(world: WorldState, viewerPlayerId: PlayerId): PlayerProgressView | null {
  const viewer = findPlayer(world, viewerPlayerId);
  return viewer === undefined ? null : toPlayerProgressView(viewer);
}

/** Everything but the food and the effects: what the full and the delta snapshot share, built for no viewer. */
function serializeCommon(world: WorldState, precision: SnapshotPrecision): Omit<GameSnapshot, 'food' | 'effects'> {
  const players: Record<string, PlayerRosterView> = {};
  const appliedInputSequenceByPlayer: Record<string, number> = {};
  for (const player of world.players) {
    players[player.playerId] = toPlayerRosterView(player);
    appliedInputSequenceByPlayer[player.playerId] = player.appliedInputSequence;
  }
  return {
    tick: world.tick,
    seed: world.seed,
    roundStartTick: world.roundStartTick,
    roundPhase: world.roundPhase,
    roundTimeLeftMs: world.roundTimeLeftMs,
    gelPatches: world.gelPatches.map((patch) => ({ ...patch })),
    cells: world.cells.map((cell) => toCellView(cell, precision)),
    dnaFragments: world.dnaFragments.map((fragment) => toDnaFragmentView(fragment, precision)),
    players,
    ownProgress: null,
    leaderboard: world.leaderboard.map((row) => toLeaderboardRowView(row, precision)),
    appliedInputSequenceByPlayer,
  };
}

/** The `game_state` snapshot: every mote in `food.spawned`, no effects (docs/architecture/wire-contract.md §4). */
export function serializeFullSnapshot(
  world: WorldState,
  precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES,
): GameSnapshot {
  return {
    ...serializeCommon(world, precision),
    food: { spawned: world.food.map((mote) => toFoodMoteView(mote, precision)), removedIds: [], moved: [] },
    effects: [],
  };
}

/**
 * The `game_snapshot` broadcast: the food delta since the previous broadcast and every effect since
 * it. This is the one drain of `world.effects` (docs/architecture/entity-model.md §2): the steps and the
 * between-tick paths (a join's catch-up level-ups, a debug grant) all push there.
 */
export function serializeDeltaSnapshot(world: WorldState, tracker: FoodDeltaTracker): GameSnapshot {
  const effects: GameEffect[] = world.effects.splice(0);
  return { ...serializeCommon(world, WIRE_SNAPSHOT_VALUES), food: tracker.diff(world.food), effects };
}
