// Player and cell record factories (docs/ARCHITECTURE.md §2): a fresh player at level 1, and a
// free protocell placed for a player. A cell is born with its target at its own centre (throttle
// 0: it drifts until the first input) and its derived state already folded.

import {
  BACTERIUM_VARIANTS,
  CELL_KIND,
  DEFAULT_CELL_MODIFIERS,
  DNA_TAGS,
  ENTITY_KIND,
  PLAYER_LIFE_STATE,
  STARTING_STAGE,
  zeroRecord,
  type BacteriumVariant,
  type BalanceConfig,
  type DnaTag,
  type PlayerId,
  type RandomSource,
  type Vec2,
} from '@evolution/shared';
import { FIRST_LEVEL } from '../progression/levels.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { findSafeSpawnPoint } from '../simulation/spawn-placement.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { mintEntityId } from '../world/entity-ids.js';
import type { WorldState } from '../world/world-state.js';

export interface PlayerIdentity {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly avatarIndex: number;
}

export function zeroTagPoints(): Record<DnaTag, number> {
  return zeroRecord(DNA_TAGS);
}

export function zeroBacteriaCounters(): Record<BacteriumVariant, number> {
  return zeroRecord(BACTERIUM_VARIANTS);
}

export function createPlayerRecord(identity: PlayerIdentity, joinOrder: number): PlayerRecord {
  return {
    playerId: identity.playerId,
    playerName: identity.playerName,
    avatarIndex: identity.avatarIndex,
    joinOrder,
    level: FIRST_LEVEL,
    dnaCumulative: 0,
    dnaCatchUpGift: 0,
    dnaTowardNextLevel: 0,
    dnaTagPoints: zeroTagPoints(),
    bacteriaEatenByVariant: zeroBacteriaCounters(),
    absorptions: 0,
    wildAbsorptions: 0,
    score: 0,
    offer: null,
    lifeState: PLAYER_LIFE_STATE.alive,
    spectatingCellId: null,
    respawnInTicks: 0,
    ownedTraits: [],
    offerQueue: [],
    nextOfferId: 1,
    appliedInputSequence: 0,
    pendingInput: null,
  };
}

/** A free cell for `player` at `centre` with `mass`, appended to the world; its derived state is folded. */
export function createCellRecord(world: WorldState, player: PlayerRecord, centre: Vec2, mass: number): CellRecord {
  const id = mintEntityId(world, ENTITY_KIND.cell);
  const cell: CellRecord = {
    id,
    kind: CELL_KIND.player,
    playerId: player.playerId,
    organismId: id,
    avatarIndex: player.avatarIndex,
    x: centre.x,
    y: centre.y,
    velocityX: 0,
    velocityY: 0,
    mass,
    radius: 0,
    level: player.level,
    stage: STARTING_STAGE,
    traits: [],
    membraneRatioBonus: 0,
    states: [],
    engulfProgress: 0,
    engulfingCellId: null,
    engulfedByCellId: null,
    sprintRemainingTicks: 0,
    sprintCooldownRemainingTicks: 0,
    targetX: centre.x,
    targetY: centre.y,
    modifiers: { ...DEFAULT_CELL_MODIFIERS },
    pinnedX: null,
    pinnedY: null,
    carriedOffsetX: null,
    carriedOffsetY: null,
    spitOutRefractories: [],
  };
  refreshCellDerivedState(cell, player, world.balance);
  world.cells.push(cell);
  return cell;
}

/** Places a cell for `player` by safe placement from the `spawnPlacement` stream. */
export function spawnCellForPlayer(
  world: WorldState,
  player: PlayerRecord,
  mass: number,
  spawnPlacement: RandomSource,
): CellRecord {
  const balance: BalanceConfig = world.balance;
  const centre = findSafeSpawnPoint(spawnPlacement, world.cells, balance);
  player.lifeState = PLAYER_LIFE_STATE.alive;
  player.spectatingCellId = null;
  player.respawnInTicks = 0;
  return createCellRecord(world, player, centre, mass);
}
