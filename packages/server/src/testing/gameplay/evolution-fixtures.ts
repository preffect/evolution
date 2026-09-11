// The placed fixtures of the design tables applied to a live Evolution world (docs/ECOLOGY.md §8,
// docs/TESTING.md §8.1): a placed cell, mote or fragment, the anchors that need the world (a cell
// centre, a gel patch), the "placing anything disables the seeded motes and both spawners" rule
// and the gel-patch clearance of the broth point. Everything a fixture writes goes through the
// simulation's own record factories, never a second copy of a record.

import {
  BACTERIUM_VARIANTS,
  DNA_TAGS,
  FOOD_KIND,
  isBacteriumVariant,
  isDnaTag,
  isFoodKind,
  type BacteriumVariant,
  type DnaTag,
  type FoodKind,
  type Vec2,
} from '@evolution/shared';
import { setLevelFromCumulativeDna } from '../../game/progression/levels.js';
import { refreshCellDerivedState } from '../../game/progression/modifiers.js';
import { toOwnedTraits, UnknownTraitError } from '../../game/progression/owned-traits.js';
import { setCellMass } from '../../game/simulation/cell-mass.js';
import { spawnDnaFragment, spawnFoodMote } from '../../game/simulation/spawn-mote.js';
import type { CellRecord, PlayerRecord } from '../../game/world/entities.js';
import { findCellOfPlayer, findPlayer } from '../../game/world/lookups.js';
import type { WorldState } from '../../game/world/world-state.js';
import type { FixtureContext } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import {
  GEL_PATCH_CLEARANCE_WU,
  isClearOfGelPatches,
  PLACED_KIND,
  type PlacedCell,
  type PlacedFixture,
  type PlacedFragment,
  type PlacedMote,
  type PlacedTrait,
} from './fixtures.js';
import {
  ANCHOR_KIND,
  BROTH_POINT,
  describeAnchor,
  resolveFixedAnchor,
  type GelPatchAnchor,
  type PlacementAnchor,
} from './placement.js';

/** A placed fragment drifts east: the direction is fixed so a placed row never draws from a stream. */
const PLACED_FRAGMENT_DRIFT_TURN = 0;

/**
 * Placing anything means the seeded motes are gone and both spawners are off for the run
 * (docs/ECOLOGY.md §8), and the seed is refused when a gel patch reaches the broth point.
 */
export function prepareWorldForPlacement(world: WorldState): void {
  if (!isClearOfGelPatches(BROTH_POINT, world.gelPatches, GEL_PATCH_CLEARANCE_WU)) {
    throw new ScenarioSetupError(
      `seed ${world.seed} puts a gel patch within ${GEL_PATCH_CLEARANCE_WU} wu of the broth point; pick another seed`,
    );
  }
  world.food = [];
  world.dnaFragments = [];
  world.spawners.food.isEnabled = false;
  world.spawners.dnaFragments.isEnabled = false;
}

function requirePlacedCell(world: WorldState, playerIndex: number, context: FixtureContext): CellRecord {
  const cell = findCellOfPlayer(world, context.playerId(playerIndex));
  if (cell === undefined) {
    throw new ScenarioSetupError(`player ${playerIndex} has no cell at tick ${context.tick} to place against`);
  }
  return cell;
}

function gelPatchCentreOf(world: WorldState, anchor: GelPatchAnchor): Vec2 {
  const patch = world.gelPatches[anchor.patchIndex];
  if (patch === undefined) {
    throw new ScenarioSetupError(`${describeAnchor(anchor)} does not exist (${world.gelPatches.length} patches)`);
  }
  return { x: patch.x, y: patch.y };
}

/** Resolves an anchor against the world: the named points without it, the cell and gel anchors through it. */
export function resolveAnchor(world: WorldState, anchor: PlacementAnchor, context: FixtureContext): Vec2 {
  switch (anchor.kind) {
    case ANCHOR_KIND.insideCellOf: {
      const cell = requirePlacedCell(world, anchor.playerIndex, context);
      return { x: cell.x, y: cell.y };
    }
    case ANCHOR_KIND.eastOfCellOf: {
      const cell = requirePlacedCell(world, anchor.playerIndex, context);
      return { x: cell.x + anchor.distanceWu, y: cell.y };
    }
    case ANCHOR_KIND.gelPatchCentre:
      return gelPatchCentreOf(world, anchor);
    default: {
      const dish = {
        dishRadiusWu: world.balance.world.DISH_RADIUS,
        shallowsWidthWu: world.balance.ecology.SHALLOWS_WIDTH,
      };
      // Every remaining kind is a fixed anchor; `resolveFixedAnchor` answers null only for the kinds handled above.
      return resolveFixedAnchor(anchor, dish) as Vec2;
    }
  }
}

/** The one catalog check (`progression/owned-traits.ts`), refused as a setup error here. */
function grantTraits(world: WorldState, player: PlayerRecord, traits: readonly PlacedTrait[]): void {
  try {
    player.ownedTraits = toOwnedTraits(world.balance.traits.TRAIT_CATALOG, traits);
  } catch (error) {
    if (error instanceof UnknownTraitError) throw new ScenarioSetupError(error.message);
    throw error;
  }
}

function requireFixturePlayer(world: WorldState, playerIndex: number, context: FixtureContext): PlayerRecord {
  const player = findPlayer(world, context.playerId(playerIndex));
  if (player === undefined) {
    throw new ScenarioSetupError(`player ${playerIndex} is not in the world at tick ${context.tick}`);
  }
  return player;
}

/** Moves the cell to the anchor at rest (target on its own centre), sets its mass, pin, traits and lifetime DNA. */
export function applyPlacedCell(world: WorldState, fixture: PlacedCell, context: FixtureContext): void {
  const player = requireFixturePlayer(world, fixture.playerIndex, context);
  const cell = requirePlacedCell(world, fixture.playerIndex, context);
  const centre = resolveAnchor(world, fixture.at, context);
  cell.x = centre.x;
  cell.y = centre.y;
  cell.targetX = centre.x;
  cell.targetY = centre.y;
  cell.velocityX = 0;
  cell.velocityY = 0;
  cell.pinnedX = fixture.isPinned ? centre.x : null;
  cell.pinnedY = fixture.isPinned ? centre.y : null;
  setCellMass(cell, fixture.mass, world.balance);
  if (fixture.traits.length > 0) {
    grantTraits(world, player, fixture.traits);
  }
  if (fixture.dnaCumulative !== null) {
    player.dnaCumulative = fixture.dnaCumulative;
    setLevelFromCumulativeDna(world, player);
  }
  refreshCellDerivedState(cell, player, world.balance);
}

function requireFoodKind(kind: string): FoodKind {
  if (!isFoodKind(kind)) {
    throw new ScenarioSetupError(`"${kind}" is not a food kind (${Object.values(FOOD_KIND).join(', ')})`);
  }
  return kind;
}

function requireVariant(variant: string | null): BacteriumVariant {
  if (!isBacteriumVariant(variant)) {
    throw new ScenarioSetupError(
      `a placed bacterium needs a variant (${BACTERIUM_VARIANTS.join(', ')}), got ${variant}`,
    );
  }
  return variant;
}

function requireDnaTag(tag: string): DnaTag {
  if (!isDnaTag(tag)) {
    throw new ScenarioSetupError(`"${tag}" is not a DNA tag (${DNA_TAGS.join(', ')})`);
  }
  return tag;
}

export function applyPlacedMote(world: WorldState, fixture: PlacedMote, context: FixtureContext): void {
  const kind = requireFoodKind(fixture.moteKind);
  const variant = kind === FOOD_KIND.bacterium ? requireVariant(fixture.variant) : null;
  spawnFoodMote(world, { kind, variant, at: resolveAnchor(world, fixture.at, context) });
}

export function applyPlacedFragment(world: WorldState, fixture: PlacedFragment, context: FixtureContext): void {
  spawnDnaFragment(world, {
    at: resolveAnchor(world, fixture.at, context),
    tag: requireDnaTag(fixture.tag),
    driftTurn: PLACED_FRAGMENT_DRIFT_TURN,
  });
}

export function applyPlacedFixture(world: WorldState, fixture: PlacedFixture, context: FixtureContext): void {
  switch (fixture.kind) {
    case PLACED_KIND.cell:
      applyPlacedCell(world, fixture, context);
      return;
    case PLACED_KIND.mote:
      applyPlacedMote(world, fixture, context);
      return;
    case PLACED_KIND.fragment:
      applyPlacedFragment(world, fixture, context);
      return;
    default: {
      const unknownFixture: never = fixture;
      throw new ScenarioSetupError(`unknown placed fixture ${JSON.stringify(unknownFixture)}`);
    }
  }
}
