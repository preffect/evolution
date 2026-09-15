// Records → views (docs/architecture/entity-model.md §2, docs/architecture/wire-contract.md §4): the one projection from the server records onto
// the wire types. Positions, a cell's velocity, mass and radius, and a leaderboard row's score and mass are quantised
// to the `SNAPSHOT_*_DECIMALS` of `netcode.ts` (`quantize.ts`); every array and record is copied so a snapshot never
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
import { quantizePosition, quantizeToDecimals, type SnapshotQuantizer } from './quantize.js';

export function toCellView(cell: CellRecord, quantize: SnapshotQuantizer = quantizeToDecimals): CellView {
  return {
    id: cell.id,
    kind: cell.kind,
    playerId: cell.playerId,
    organismId: cell.organismId,
    avatarIndex: cell.avatarIndex,
    x: quantize(cell.x, SNAPSHOT_POSITION_DECIMALS),
    y: quantize(cell.y, SNAPSHOT_POSITION_DECIMALS),
    velocityX: quantize(cell.velocityX, SNAPSHOT_VELOCITY_DECIMALS),
    velocityY: quantize(cell.velocityY, SNAPSHOT_VELOCITY_DECIMALS),
    mass: quantize(cell.mass, SNAPSHOT_MASS_DECIMALS),
    radius: quantize(cell.radius, SNAPSHOT_RADIUS_DECIMALS),
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

export function toFoodMoteView(mote: FoodMoteRecord, quantize: SnapshotQuantizer = quantizeToDecimals): FoodMoteView {
  return {
    id: mote.id,
    kind: mote.kind,
    bacteriumVariant: mote.bacteriumVariant,
    x: quantize(mote.x, SNAPSHOT_POSITION_DECIMALS),
    y: quantize(mote.y, SNAPSHOT_POSITION_DECIMALS),
  };
}

export function toMotePositionView(mote: FoodMoteRecord): MotePositionView {
  return { id: mote.id, x: quantizePosition(mote.x), y: quantizePosition(mote.y) };
}

export function toDnaFragmentView(
  fragment: DnaFragmentRecord,
  quantize: SnapshotQuantizer = quantizeToDecimals,
): DnaFragmentView {
  return {
    id: fragment.id,
    x: quantize(fragment.x, SNAPSHOT_POSITION_DECIMALS),
    y: quantize(fragment.y, SNAPSHOT_POSITION_DECIMALS),
    tag: fragment.tag,
  };
}

/** A copy of a ranked row with its score and mass at the wire precision (docs/architecture/wire-contract.md §4.1). */
export function toLeaderboardRowView(
  row: LeaderboardRow,
  quantize: SnapshotQuantizer = quantizeToDecimals,
): LeaderboardRow {
  return {
    ...row,
    score: quantize(row.score, SNAPSHOT_SCORE_DECIMALS),
    mass: quantize(row.mass, SNAPSHOT_MASS_DECIMALS),
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

/** The snapshot members only their viewer is sent (docs/architecture/wire-contract.md §4.1), in the order the room appends them. */
export const VIEWER_SNAPSHOT_KEYS = ['ownProgress'] as const satisfies readonly (keyof GameSnapshot)[];

/** One viewer's values for `VIEWER_SNAPSHOT_KEYS`. */
export function serializeViewerState(
  world: WorldState,
  viewerPlayerId: PlayerId,
): Pick<GameSnapshot, (typeof VIEWER_SNAPSHOT_KEYS)[number]> {
  return { ownProgress: ownProgressOf(world, viewerPlayerId) };
}

/** Everything but the food and the effects: what the full and the delta snapshot share, built for no viewer. */
function serializeCommon(world: WorldState, quantize: SnapshotQuantizer): Omit<GameSnapshot, 'food' | 'effects'> {
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
    cells: world.cells.map((cell) => toCellView(cell, quantize)),
    dnaFragments: world.dnaFragments.map((fragment) => toDnaFragmentView(fragment, quantize)),
    players,
    ownProgress: null,
    leaderboard: world.leaderboard.map((row) => toLeaderboardRowView(row, quantize)),
    appliedInputSequenceByPlayer,
  };
}

/** The `game_state` snapshot: every mote in `food.spawned`, no effects (docs/architecture/wire-contract.md §4). */
export function serializeFullSnapshot(
  world: WorldState,
  quantize: SnapshotQuantizer = quantizeToDecimals,
): GameSnapshot {
  return {
    ...serializeCommon(world, quantize),
    food: { spawned: world.food.map((mote) => toFoodMoteView(mote, quantize)), removedIds: [], moved: [] },
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
  return { ...serializeCommon(world, quantizeToDecimals), food: tracker.diff(world.food), effects };
}
