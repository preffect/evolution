// Records → views (docs/architecture/entity-model.md §2, docs/architecture/wire-contract.md §4): the one projection from the server records onto
// the wire types. Numbers are quantised to the `SNAPSHOT_*_DECIMALS` of `netcode.ts` as wire-contract.md §4 "Wire
// precision" lists them (`quantize.ts`); every array and record is copied so a snapshot never
// aliases the world. The full snapshot carries every mote and fragment for no viewer; the broadcast carries the effects
// since the last one and none of the members each viewer is sent apart (`viewer-snapshot-keys.ts`, #399).

import {
  SNAPSHOT_MASS_DECIMALS,
  SNAPSHOT_POSITION_DECIMALS,
  SNAPSHOT_RADIUS_DECIMALS,
  SNAPSHOT_SCORE_DECIMALS,
  SNAPSHOT_VELOCITY_DECIMALS,
  PLAYER_LIFE_STATE,
  type CellView,
  type DnaFragmentView,
  type FoodMoteView,
  type GameEffect,
  type GameSnapshot,
  type LeaderboardRow,
  type MotePositionView,
  type OwnProgressView,
  type PlayerId,
  type PlayerProgressView,
  type PlayerRosterView,
  type TraitOfferView,
} from '@evolution/shared';
import type { CellRecord, DnaFragmentRecord, FoodMoteRecord, PlayerRecord } from '../world/entities.js';
import { findPlayer } from '../world/lookups.js';
import { drainBroadcastWindow } from '../world/broadcast-window.js';
import type { WorldState } from '../world/world-state.js';
import { toEffectView, toMassFlowView } from './mass-flow-view.js';
import { WIRE_SNAPSHOT_VALUES, quantizeToDecimals, snapshotValue, type SnapshotPrecision } from './quantize.js';
import type { BroadcastSnapshot } from './viewer-snapshot-keys.js';

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

/** Whether an own view carries the sealed sprint window: a `game_state` carries no window, as it carries no effects. */
export const SPRINT_WINDOW = { included: 'included', omitted: 'omitted' } as const;
export type SprintWindow = (typeof SPRINT_WINDOW)[keyof typeof SPRINT_WINDOW];

/**
 * The player's progress and why its cell's mass moves (#383): `massFlow` is `null` while spectating and until the
 * metabolism step has run for a new cell.
 */
export function toOwnProgressView(
  world: WorldState,
  player: PlayerRecord,
  precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES,
  sprintWindow: SprintWindow = SPRINT_WINDOW.included,
): OwnProgressView {
  const ledger = world.massFlow;
  const record = player.lifeState === PLAYER_LIFE_STATE.alive ? ledger.metabolismByPlayer[player.playerId] : undefined;
  const sprintSpent = sprintWindow === SPRINT_WINDOW.included ? ledger.sprintSpentByPlayer[player.playerId] : undefined;
  return {
    ...toPlayerProgressView(player, precision),
    massFlow: record === undefined ? null : toMassFlowView(record, sprintSpent, precision),
  };
}

/**
 * What `viewerPlayerId` alone is sent of its own progress (docs/architecture/wire-contract.md §4.1): `null` for a
 * viewer with no player in the world.
 */
export function ownProgressOf(
  world: WorldState,
  viewerPlayerId: PlayerId,
  sprintWindow: SprintWindow = SPRINT_WINDOW.included,
): OwnProgressView | null {
  const viewer = findPlayer(world, viewerPlayerId);
  return viewer === undefined ? null : toOwnProgressView(world, viewer, WIRE_SNAPSHOT_VALUES, sprintWindow);
}

/**
 * Everything every viewer is sent alike but the effects: what the full snapshot and the broadcast share. Typed as the
 * broadcast, so a member a viewer is sent apart that is still built here fails to compile (#399).
 */
function serializeShared(world: WorldState, precision: SnapshotPrecision): Omit<BroadcastSnapshot, 'effects'> {
  const players: Record<string, PlayerRosterView> = {};
  for (const player of world.players) {
    players[player.playerId] = toPlayerRosterView(player);
  }
  return {
    tick: world.tick,
    seed: world.seed,
    roundStartTick: world.roundStartTick,
    roundPhase: world.roundPhase,
    roundTimeLeftMs: world.roundTimeLeftMs,
    gelPatches: world.gelPatches.map((patch) => ({ ...patch })),
    cells: world.cells.map((cell) => toCellView(cell, precision)),
    players,
    leaderboard: world.leaderboard.map((row) => toLeaderboardRowView(row, precision)),
  };
}

/**
 * The `game_state` snapshot for no viewer (docs/architecture/wire-contract.md §4): every mote in `food.spawned`, every
 * fragment and every player's input sequence, no own progress and no effects.
 */
export function serializeFullSnapshot(
  world: WorldState,
  precision: SnapshotPrecision = WIRE_SNAPSHOT_VALUES,
): GameSnapshot {
  return {
    ...serializeShared(world, precision),
    dnaFragments: world.dnaFragments.map((fragment) => toDnaFragmentView(fragment, precision)),
    food: { spawned: world.food.map((mote) => toFoodMoteView(mote, precision)), removedIds: [], moved: [] },
    ownProgress: null,
    appliedInputSequenceByPlayer: Object.fromEntries(
      world.players.map((player) => [player.playerId, player.appliedInputSequence]),
    ),
    effects: [],
  };
}

/**
 * The `game_snapshot` broadcast: what every viewer is sent alike, and every effect since the previous broadcast. This
 * is the one drain of `world.effects` (docs/architecture/entity-model.md §2): the steps and the between-tick paths (a
 * join's catch-up level-ups, a debug grant) all push there. It seals the sprint window the viewers' own progress
 * reports with it (#383).
 */
export function serializeBroadcastSnapshot(world: WorldState): BroadcastSnapshot {
  const effects: GameEffect[] = drainBroadcastWindow(world).map((effect) => toEffectView(effect, WIRE_SNAPSHOT_VALUES));
  return { ...serializeShared(world, WIRE_SNAPSHOT_VALUES), effects };
}
