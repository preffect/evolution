// The state hash of a world (docs/DETERMINISM.md §5): the canonical walk over `HASHED_FIELDS`
// through the shared hasher. Every non-derived record field is listed (the test pins it); the
// derived ones are excluded and named here so a debug-only field can never move the hash:
// `leaderboard` (a function of the players), `effects` (transient), `balance` and `config`
// (replay inputs), `CellRecord.modifiers` (folded at step 1), `PlayerRecord.score` (step 10) and
// `PlayerRecord.offer` (the shown offer mirror of `offerQueue[0]`).

import {
  BACTERIUM_VARIANTS,
  DNA_TAGS,
  SERVER_RANDOM_STREAM_LABELS,
  StateHasher,
  hashArray,
  hashEnumRecord,
  hashFields,
  hashRandomStreams,
  hashScalarArray,
  type GameInput,
  type GelPatchView,
  type HashedField,
  type OwnedTrait,
  type StateHash,
  type TraitChoiceInput,
} from '@evolution/shared';
import type {
  CellRecord,
  DnaFragmentRecord,
  FoodMoteRecord,
  PlayerRecord,
  SpawnerState,
  TraitOffer,
  WildSeatRecord,
} from './entities.js';
import type { WorldState } from './world-state.js';

/** The record fields the walk leaves out, by record, for the pin test. */
export const DERIVED_FIELDS = {
  world: ['config', 'balance', 'leaderboard', 'effects'],
  cell: ['modifiers'],
  player: ['score', 'offer'],
} as const;

const OWNED_TRAIT_FIELDS: readonly HashedField<OwnedTrait>[] = ['traitId', 'tier'];

function hashOwnedTraits(hasher: StateHasher, traits: readonly OwnedTrait[]): void {
  hashArray(hasher, traits, (itemHasher, trait) => hashFields(itemHasher, trait, OWNED_TRAIT_FIELDS));
}

export const CELL_HASHED_FIELDS: readonly HashedField<CellRecord>[] = [
  'id',
  'kind',
  'playerId',
  'organismId',
  'avatarIndex',
  'x',
  'y',
  'velocityX',
  'velocityY',
  'mass',
  'radius',
  'level',
  'stage',
  { key: 'traits', hash: hashOwnedTraits },
  'membraneRatioBonus',
  { key: 'states', hash: hashScalarArray },
  'engulfProgress',
  'engulfingCellId',
  'engulfedByCellId',
  'sprintRemainingTicks',
  'sprintCooldownRemainingTicks',
  'targetX',
  'targetY',
  'pinnedX',
  'pinnedY',
];

export const FOOD_MOTE_HASHED_FIELDS: readonly HashedField<FoodMoteRecord>[] = [
  'id',
  'kind',
  'bacteriumVariant',
  'x',
  'y',
  'mass',
  'dna',
  'tag',
  'headingRadians',
  'expiresAtTick',
];

export const DNA_FRAGMENT_HASHED_FIELDS: readonly HashedField<DnaFragmentRecord>[] = [
  'id',
  'x',
  'y',
  'tag',
  'driftX',
  'driftY',
];

const TRAIT_CHOICE_FIELDS: readonly HashedField<TraitChoiceInput>[] = ['offerId', 'cardIndex'];

function hashTraitChoice(hasher: StateHasher, choice: TraitChoiceInput | null): void {
  if (choice === null) {
    hasher.hashNull();
  } else {
    hashFields(hasher, choice, TRAIT_CHOICE_FIELDS);
  }
}

/** The reserved flags hash as `null` when absent so an explicit `false` differs from an omission. */
function hashReservedFlag(hasher: StateHasher, isSet: boolean | undefined): void {
  hasher.hashScalar(isSet ?? null);
}

const GAME_INPUT_FIELDS: readonly HashedField<GameInput>[] = [
  'sequence',
  'targetX',
  'targetY',
  'shouldSprint',
  { key: 'traitChoice', hash: hashTraitChoice },
  { key: 'shouldSplit', hash: hashReservedFlag },
  { key: 'shouldEject', hash: hashReservedFlag },
];

function hashPendingInput(hasher: StateHasher, input: GameInput | null): void {
  if (input === null) {
    hasher.hashNull();
  } else {
    hashFields(hasher, input, GAME_INPUT_FIELDS);
  }
}

export const TRAIT_OFFER_HASHED_FIELDS: readonly HashedField<TraitOffer>[] = [
  'offerId',
  { key: 'cards', hash: hashOwnedTraits },
  'expiresAtTick',
  'shownAtTick',
  { key: 'cardWeights', hash: hashScalarArray },
  { key: 'catalogIndexes', hash: hashScalarArray },
];

function hashOfferQueue(hasher: StateHasher, offers: readonly TraitOffer[]): void {
  hashArray(hasher, offers, (itemHasher, offer) => hashFields(itemHasher, offer, TRAIT_OFFER_HASHED_FIELDS));
}

export const PLAYER_HASHED_FIELDS: readonly HashedField<PlayerRecord>[] = [
  'playerId',
  'playerName',
  'level',
  'dnaCumulative',
  'dnaCatchUpGift',
  'dnaTowardNextLevel',
  { key: 'dnaTagPoints', hash: (hasher, points) => hashEnumRecord(hasher, points, DNA_TAGS) },
  { key: 'bacteriaEatenByVariant', hash: (hasher, counts) => hashEnumRecord(hasher, counts, BACTERIUM_VARIANTS) },
  'absorptions',
  'wildAbsorptions',
  'lifeState',
  'spectatingCellId',
  'respawnInTicks',
  'avatarIndex',
  'joinOrder',
  { key: 'ownedTraits', hash: hashOwnedTraits },
  { key: 'offerQueue', hash: hashOfferQueue },
  'nextOfferId',
  'appliedInputSequence',
  { key: 'pendingInput', hash: hashPendingInput },
];

export const GEL_PATCH_HASHED_FIELDS: readonly HashedField<GelPatchView>[] = ['x', 'y', 'radius'];

export const SPAWNER_HASHED_FIELDS: readonly HashedField<SpawnerState>[] = ['accumulator', 'spawnedCount', 'isEnabled'];

export const WILD_SEAT_HASHED_FIELDS: readonly HashedField<WildSeatRecord>[] = [
  'seatNumber',
  'cellId',
  'massSpreadFactor',
  'respawnInTicks',
  'headingX',
  'headingY',
  'decideInTicks',
  'drainedMass',
];

function hashRecords<Record>(
  hasher: StateHasher,
  records: readonly Record[],
  fields: readonly HashedField<Record>[],
): void {
  hashArray(hasher, records, (itemHasher, record) => hashFields(itemHasher, record, fields));
}

/** The world's scalar fields, in walk order. */
export const WORLD_SCALAR_HASHED_FIELDS: readonly HashedField<WorldState>[] = [
  'tick',
  'seed',
  'roundStartTick',
  'roundPhase',
  'roundTimeLeftMs',
];

export function computeStateHash(world: WorldState): StateHash {
  const hasher = new StateHasher();
  hashFields(hasher, world, WORLD_SCALAR_HASHED_FIELDS);
  hashRecords(hasher, world.cells, CELL_HASHED_FIELDS);
  hashRecords(hasher, world.food, FOOD_MOTE_HASHED_FIELDS);
  hashRecords(hasher, world.dnaFragments, DNA_FRAGMENT_HASHED_FIELDS);
  hashRecords(hasher, world.players, PLAYER_HASHED_FIELDS);
  hashRecords(hasher, world.wildSeats, WILD_SEAT_HASHED_FIELDS);
  hashRecords(hasher, world.gelPatches, GEL_PATCH_HASHED_FIELDS);
  hashFields(hasher, world.spawners.food, SPAWNER_HASHED_FIELDS);
  hashFields(hasher, world.spawners.dnaFragments, SPAWNER_HASHED_FIELDS);
  hashRandomStreams(hasher, world.random, SERVER_RANDOM_STREAM_LABELS);
  hasher.hashNumber(world.nextEntityNumber);
  return hasher.digest();
}
