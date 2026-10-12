// docs/ecology/giants.md §3.5.8 and docs/ecology/acceptance.md §8.2 G9 (the payout side): a player that swallows a
// giant gains `GIANT_DNA_BONUS` through its own gain multiplier, and nothing from the DNA base or the world's share;
// the mass, the tags and the wild counter as for any wild prey; `cell_absorbed` names the giant's species. A wild cell
// or a giant that swallows a giant keeps the mass alone.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, DNA_TAG, EFFECT_KIND, GIANT_SPECIES, TICK_HZ } from '@evolution/shared';
import { seatTestGiantCell, seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import type { CellRecord } from '../world/entities.js';
import { requirePlayer } from '../world/lookups.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { beginEngulf, sealEngulf } from './engulf-state.js';
import { payOutEngulf } from './engulf-payout.js';

const { absorption, giants } = DEFAULT_BALANCE;
const PREDATOR_MASS = 2000;
const AMOEBA_BORN_MASS = 1000;
/** G9's variant: tick 21 600, where a wild prey would pay `ENGULF_DNA_SHARE` × 140. */
const WORLD_DNA_140_TICK = 360 * TICK_HZ;
const NUCLEOID_I = DEFAULT_BALANCE.traits.TRAIT_TIERS.nucleoid[0]!.dnaGainMultiplier!;

interface GiantMeal {
  readonly world: WorldState;
  readonly predator: CellRecord;
  readonly prey: CellRecord;
}

/** A sealed engulf of a born-1000 amoeba, its predator placed `predatorOf` the world, paid out at `tick`. */
function swallowAmoeba(tick: number, predatorOf: (world: WorldState) => CellRecord): GiantMeal {
  const world = createTestWorld();
  world.tick = tick;
  const predator = predatorOf(world);
  setCellMass(predator, PREDATOR_MASS, DEFAULT_BALANCE);
  const prey = seatTestGiantCell(world, {
    species: GIANT_SPECIES.amoeba,
    at: { x: predator.x + 10, y: predator.y },
    bornMass: AMOEBA_BORN_MASS,
  }).cell;
  beginEngulf({ predator, prey });
  sealEngulf({ predator, prey });
  payOutEngulf(world, createTestStepContext(world), { predator, prey });
  return { world, predator, prey };
}

const playerPredator = (world: WorldState) => world.cells[0]!;

describe('payOutEngulf: a player eats a giant (G9)', () => {
  it('pays GIANT_DNA_BONUS exactly, the mass yield, predatory points and one wild absorption', () => {
    const { world, predator, prey } = swallowAmoeba(0, playerPredator);
    const eater = requirePlayer(world, predator.playerId!);
    expect(eater.dnaCumulative).toBe(giants.GIANT_DNA_BONUS);
    expect(predator.mass).toBeCloseTo(PREDATOR_MASS + AMOEBA_BORN_MASS * absorption.ENGULF_MASS_YIELD, 6);
    expect(eater.dnaTagPoints[DNA_TAG.predatory]).toBe(absorption.ENGULF_PREDATORY_TAG_POINTS);
    expect([eater.wildAbsorptions, eater.absorptions]).toEqual([1, 0]);
    expect(world.cells).not.toContain(prey);
  });

  it('pays the same 200 where a wild prey would carry the world share (worldDna 140): no share, no base', () => {
    const { world, predator } = swallowAmoeba(WORLD_DNA_140_TICK, playerPredator);
    expect(requirePlayer(world, predator.playerId!).dnaCumulative).toBe(giants.GIANT_DNA_BONUS);
  });

  it("pays the bonus through the eater's dnaGainMultiplier: 210 with Nucleoid I", () => {
    const { world, predator } = swallowAmoeba(0, (built) => {
      const cell = built.cells[0]!;
      const player = requirePlayer(built, cell.playerId!);
      player.ownedTraits.push({ traitId: 'nucleoid', tier: 1 });
      refreshCellDerivedState(cell, player, built.balance);
      return cell;
    });
    expect(requirePlayer(world, predator.playerId!).dnaCumulative).toBe(giants.GIANT_DNA_BONUS * NUCLEOID_I);
  });

  it('emits cell_absorbed with no prey player, the 200 DNA and the giant species', () => {
    const { world, predator, prey } = swallowAmoeba(0, playerPredator);
    expect(world.effects).toContainEqual(
      expect.objectContaining({
        kind: EFFECT_KIND.cellAbsorbed,
        cellId: prey.id,
        playerId: null,
        predatorCellId: predator.id,
        predatorDnaGained: giants.GIANT_DNA_BONUS,
        preyGiantSpecies: GIANT_SPECIES.amoeba,
      }),
    );
  });
});

describe('payOutEngulf: a wild cell eats a giant', () => {
  it('keeps the mass yield alone', () => {
    const wildPredator = (world: WorldState) => seatTestWildCell(world, { at: { x: -1500, y: 0 } }).cell;
    const { world, predator } = swallowAmoeba(0, wildPredator);
    expect(predator.mass).toBeCloseTo(PREDATOR_MASS + AMOEBA_BORN_MASS * absorption.ENGULF_MASS_YIELD, 6);
    expect(world.players[0]!.dnaCumulative).toBe(0);
  });
});
