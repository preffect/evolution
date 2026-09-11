// The debug mutations as functions over the world (docs/ARCHITECTURE.md §8): the handle applies
// and records them, the replay runner re-applies them from the recording, so a debug patch has
// one code path. A request the world cannot honour is a `DebugRequestError`.

import {
  ENTITY_KIND,
  FOOD_KIND,
  isBacteriumVariant,
  isDnaTag,
  isFoodKind,
  type DnaTag,
  type OwnedTrait,
  type PlayerId,
} from '@evolution/shared';
import { applyBalancePatch } from './balance-patch.js';
import { DebugRequestError } from './debug-request-error.js';
import type { BalancePatch, DnaGrant, PlayerPatch, SpawnRequest } from './simulation-debug-handle.js';
import { gainDna, gainTagPoints } from '../progression/dna.js';
import { FIRST_LEVEL } from '../progression/levels.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { toOwnedTraits, UnknownTraitError } from '../progression/owned-traits.js';
import { toDnaFragmentView, toFoodMoteView, toPlayerProgressView } from '../serialize/serialize.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { findCellOfPlayer, findPlayer } from '../world/lookups.js';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import { forkServerStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { DEBUG_PATCH_KIND, type DebugPatch } from '../replay/replay-format.js';

export { DEBUG_PATCH_KIND, type DebugPatch } from '../replay/replay-format.js';

const NO_DRIFT_TURN = 0;

function requireDebugPlayer(world: WorldState, playerId: PlayerId): PlayerRecord {
  const player = findPlayer(world, playerId);
  if (player === undefined) {
    throw new DebugRequestError(`Player "${playerId}" is not in the world`);
  }
  return player;
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
  const tags = requireDnaTags(grant.tags ?? []);
  const cell = findCellOfPlayer(world, playerId);
  gainDna(player, grant.dna, cell?.modifiers.dnaGainMultiplier ?? 1);
  for (const tag of tags) {
    gainTagPoints(player, tag, grant.dna);
  }
  return toPlayerProgressView(player);
}

/** Every listed tag as a `DnaTag`, refused as a whole when one is not. */
function requireDnaTags(tags: readonly string[]): DnaTag[] {
  return tags.map((tag) => {
    if (!isDnaTag(tag)) {
      throw new DebugRequestError(`"${tag}" is not a DNA tag`);
    }
    return tag;
  });
}

/** Tier I of every listed trait, refused as a `DebugRequestError` when a name is not in the catalog. */
function ownedTraitsOf(world: WorldState, traitIds: readonly string[]): OwnedTrait[] {
  try {
    return toOwnedTraits(
      world.balance.traits.TRAIT_CATALOG,
      traitIds.map((traitId) => ({ traitId })),
    );
  } catch (error) {
    if (error instanceof UnknownTraitError) throw new DebugRequestError(error.message);
    throw error;
  }
}

/** A level the ladder has: whole, from `FIRST_LEVEL` to `MAX_LEVEL` (the MCP schema has no upper bound). */
function requireLevel(world: WorldState, level: number): number {
  const maxLevel = world.balance.progression.MAX_LEVEL;
  if (!Number.isInteger(level) || level < FIRST_LEVEL || level > maxLevel) {
    throw new DebugRequestError(`level must be a whole number from ${FIRST_LEVEL} to ${maxLevel}, got ${level}`);
  }
  return level;
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
  const level = patch.level === undefined ? undefined : requireLevel(world, patch.level);
  if (level !== undefined) {
    player.level = level;
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
    case DEBUG_PATCH_KIND.setBalance:
      return setBalanceForDebug(world, patch.patch);
    default: {
      const unknownPatch: never = patch;
      throw new SimulationInvariantError(`unknown debug patch ${JSON.stringify(unknownPatch)}`);
    }
  }
}
