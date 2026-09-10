// The debug mutations as functions over the world (docs/ARCHITECTURE.md §8): the handle applies
// and records them, the replay runner re-applies them from the recording, so a debug patch has
// one code path. A request the world cannot honour is a `DebugRequestError`.

import {
  BACTERIUM_VARIANTS,
  DNA_TAGS,
  ENTITY_KIND,
  FOOD_KIND,
  type BacteriumVariant,
  type DnaTag,
  type FoodKind,
  type OwnedTrait,
  type PlayerId,
  type TraitId,
} from '@evolution/shared';
import { applyBalancePatch } from '../../debug/balance-patch.js';
import { DebugRequestError } from '../../debug/debug-request-error.js';
import type { BalancePatch, DnaGrant, PlayerPatch, SpawnRequest } from '../../debug/simulation-debug-handle.js';
import { gainDna, gainTagPoints } from '../progression/dna.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { toDnaFragmentView, toFoodMoteView, toPlayerProgressView } from '../serialize/serialize.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { findCellOfPlayer, findPlayer } from '../world/lookups.js';
import { forkServerStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';

export const DEBUG_PATCH_KIND = {
  spawn: 'spawn',
  grantDna: 'grant_dna',
  setPlayer: 'set_player',
  setBalance: 'set_balance',
} as const;

export type DebugPatch =
  | { readonly kind: typeof DEBUG_PATCH_KIND.spawn; readonly request: SpawnRequest }
  | { readonly kind: typeof DEBUG_PATCH_KIND.grantDna; readonly playerId: PlayerId; readonly grant: DnaGrant }
  | { readonly kind: typeof DEBUG_PATCH_KIND.setPlayer; readonly playerId: PlayerId; readonly patch: PlayerPatch }
  | { readonly kind: typeof DEBUG_PATCH_KIND.setBalance; readonly patch: BalancePatch };

const NO_DRIFT_TURN = 0;
const FIRST_TIER = 1;

function requireDebugPlayer(world: WorldState, playerId: PlayerId): PlayerRecord {
  const player = findPlayer(world, playerId);
  if (player === undefined) {
    throw new DebugRequestError(`Player "${playerId}" is not in the world`);
  }
  return player;
}

function isFoodKind(value: unknown): value is FoodKind {
  return Object.values(FOOD_KIND).includes(value as FoodKind);
}

function isBacteriumVariant(value: unknown): value is BacteriumVariant {
  return BACTERIUM_VARIANTS.includes(value as BacteriumVariant);
}

function isDnaTag(value: unknown): value is DnaTag {
  return DNA_TAGS.includes(value as DnaTag);
}

function spawnMoteForDebug(world: WorldState, request: SpawnRequest): unknown {
  const kind = request.params.kind ?? FOOD_KIND.algae;
  if (!isFoodKind(kind)) {
    throw new DebugRequestError(`"${String(kind)}" is not a food kind`);
  }
  const variant = request.params.variant ?? null;
  if (kind === FOOD_KIND.bacterium && !isBacteriumVariant(variant)) {
    throw new DebugRequestError('A bacterium needs a "variant" param (plain, aerobic or photosynthetic)');
  }
  const mote = spawnFoodMote(world, { kind, variant: isBacteriumVariant(variant) ? variant : null, at: request });
  return toFoodMoteView(mote);
}

/** A mote (`food_mote`, params `kind` and `variant`) or a fragment (`dna_fragment`, param `tag`) at the point. */
export function spawnForDebug(world: WorldState, request: SpawnRequest): unknown {
  if (request.kind === ENTITY_KIND.foodMote) {
    return spawnMoteForDebug(world, request);
  }
  if (request.kind === ENTITY_KIND.dnaFragment) {
    const tag = request.params.tag;
    if (!isDnaTag(tag)) {
      throw new DebugRequestError('A DNA fragment needs a "tag" param (one of the DNA tags)');
    }
    return toDnaFragmentView(spawnDnaFragment(world, { at: request, tag, driftTurn: NO_DRIFT_TURN }));
  }
  throw new DebugRequestError(`"${request.kind}" cannot be spawned: use food_mote or dna_fragment`);
}

/** DNA with the cell's gain multiplier (1 without a cell); every listed tag gets `dna` tag points. */
export function grantDnaForDebug(world: WorldState, playerId: PlayerId, grant: DnaGrant): unknown {
  const player = requireDebugPlayer(world, playerId);
  const tags = grant.tags ?? [];
  for (const tag of tags) {
    if (!isDnaTag(tag)) {
      throw new DebugRequestError(`"${tag}" is not a DNA tag`);
    }
  }
  const cell = findCellOfPlayer(world, playerId);
  gainDna(player, grant.dna, cell?.modifiers.dnaGainMultiplier ?? 1);
  for (const tag of tags) {
    gainTagPoints(player, tag as DnaTag, grant.dna);
  }
  return toPlayerProgressView(player);
}

function ownedTraitsOf(world: WorldState, traitIds: readonly string[]): OwnedTrait[] {
  const catalogIds = world.balance.traits.TRAIT_CATALOG.map((trait) => trait.id);
  return traitIds.map((traitId) => {
    if (!catalogIds.includes(traitId as TraitId)) {
      throw new DebugRequestError(`"${traitId}" is not a catalog trait`);
    }
    return { traitId: traitId as TraitId, tier: FIRST_TIER };
  });
}

function patchCell(world: WorldState, cell: CellRecord, patch: PlayerPatch): void {
  if (patch.mass !== undefined) {
    setCellMass(cell, patch.mass, world.balance);
  }
  if (patch.position !== undefined) {
    cell.x = patch.position.x;
    cell.y = patch.position.y;
    cell.targetX = patch.position.x;
    cell.targetY = patch.position.y;
  }
}

/** Overwrites mass, position, level and/or the owned traits (tier I); the cell's derived state is refolded. */
export function setPlayerForDebug(world: WorldState, playerId: PlayerId, patch: PlayerPatch): unknown {
  const player = requireDebugPlayer(world, playerId);
  const traits = patch.traits === undefined ? undefined : ownedTraitsOf(world, patch.traits);
  if (patch.level !== undefined) {
    player.level = patch.level;
    player.dnaTowardNextLevel = 0;
  }
  if (traits !== undefined) {
    player.ownedTraits = traits;
  }
  const cell = findCellOfPlayer(world, playerId);
  if (cell !== undefined) {
    patchCell(world, cell, patch);
    cell.level = player.level;
    refreshCellDerivedState(cell, player, world.balance);
  }
  return toPlayerProgressView(player);
}

/** Number leaves only, validated as a whole (balance-patch.ts); the world carries the new copy. */
export function setBalanceForDebug(world: WorldState, patch: BalancePatch): unknown {
  world.balance = applyBalancePatch(world.balance, patch).balance;
  return world.balance;
}

/** Rebuilds every stream from `seed` (docs/DETERMINISM.md §3); the caller starts a new recording. */
export function reseedForDebug(world: WorldState, seed: number): void {
  world.seed = seed;
  world.random = forkServerStreams(seed);
}

export function applyDebugPatch(world: WorldState, patch: DebugPatch): unknown {
  switch (patch.kind) {
    case DEBUG_PATCH_KIND.spawn:
      return spawnForDebug(world, patch.request);
    case DEBUG_PATCH_KIND.grantDna:
      return grantDnaForDebug(world, patch.playerId, patch.grant);
    case DEBUG_PATCH_KIND.setPlayer:
      return setPlayerForDebug(world, patch.playerId, patch.patch);
    default:
      return setBalanceForDebug(world, patch.patch);
  }
}
