// docs/architecture/debug-mcp.md §8 and docs/ecology/giants.md §3.5.15: `debug_spawn(gameId, 'giant', x, y, { species,
// mass })` seats that species' giant at the point in its own seat whether or not the dish lists it, replaces one
// already there without detritus, draws a born mass from the `giants` stream when none is named, and refuses an
// unknown species or a mass outside [`CELL_STARTING_MASS`, `GIANT_MASS_CEILING`]. A balance patch of the trait tiers refolds a giant through
// its build, so its species speed multiplier stays (giants.md §3.5.15, the multiplier's one home).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GIANT_SPAWN_KIND,
  GIANT_SPECIES,
  foldModifiers,
  RANDOM_STREAM,
  SERVER_RANDOM_STREAM_LABELS,
  type CellView,
} from '@evolution/shared';
import { seatTestGiantCell } from '../../testing/wild-builders.js';
import { createTestWorld, NO_GIANTS_BALANCE } from '../../testing/world-builders.js';
import type { WorldState } from '../world/world-state.js';
import { applyDebugPatch, DEBUG_PATCH_KIND, setBalanceForDebug, spawnForDebug } from './debug-operations.js';
import { DebugRequestError } from './debug-request-error.js';

const { giants } = DEFAULT_BALANCE;
const POINT = { x: 1200, y: -300 };
const TIER_TABLES_LEAF = 'TRAIT_TIERS';
/** Cilia I at 1.4: the paramecium's build owns it. */
const CILIA_SPEED_PATCH = { traits: { [TIER_TABLES_LEAF]: { cilia: { 0: { speedMultiplier: 1.4 } } } } };

function spawnGiant(world: WorldState, params: Record<string, unknown>): CellView {
  return spawnForDebug(world, { kind: GIANT_SPAWN_KIND, ...POINT, params }) as CellView;
}

describe('spawnForDebug, a giant', () => {
  it('seats the species at the point and born mass named, in its seat, on a balance that lists no giant', () => {
    const world = createTestWorld({ balance: NO_GIANTS_BALANCE });
    expect(world.balance.giants.GIANT_SPECIES_IN_DISH).toEqual([]);
    const view = spawnGiant(world, { species: GIANT_SPECIES.diatom, mass: 1234 });
    expect(view).toMatchObject({ ...POINT, mass: 1234, giantSpecies: GIANT_SPECIES.diatom, level: 6, playerId: null });
    expect(world.giantSeats).toHaveLength(1);
    expect(world.giantSeats[0]).toMatchObject({ seatNumber: 26, cellId: view.id, bornMass: 1234, grownMass: 0 });
  });

  it('replaces the species giant already there, leaving no detritus', () => {
    const world = createTestWorld();
    const first = spawnGiant(world, { species: GIANT_SPECIES.amoeba, mass: 1000 });
    const second = spawnGiant(world, { species: GIANT_SPECIES.amoeba, mass: 1100 });
    const amoebas = world.cells.filter((cell) => cell.giantSpecies === GIANT_SPECIES.amoeba);
    expect(amoebas.map((cell) => cell.id)).toEqual([second.id]);
    expect(second.id).not.toBe(first.id);
    expect(world.food).toEqual([]);
    expect(world.giantSeats).toHaveLength(1);
  });

  it('draws a born mass in range and a heading from the giants stream alone, written back', () => {
    const world = createTestWorld();
    const before = structuredClone(world.random);
    const view = spawnGiant(world, { species: GIANT_SPECIES.paramecium });
    expect(view.mass).toBeGreaterThanOrEqual(giants.GIANT_BORN_MASS_MIN_BY_SPECIES.giant_paramecium);
    expect(view.mass).toBeLessThan(giants.GIANT_BORN_MASS_MAX_BY_SPECIES.giant_paramecium);
    expect(world.random[RANDOM_STREAM.giants].position).toBe(before[RANDOM_STREAM.giants].position + 2);
    for (const label of SERVER_RANDOM_STREAM_LABELS.filter((other) => other !== RANDOM_STREAM.giants)) {
      expect(world.random[label], label).toEqual(before[label]);
    }
  });

  it('replays: the same patch on the same world seats the same giant', () => {
    const patch = {
      kind: DEBUG_PATCH_KIND.spawn,
      request: { kind: GIANT_SPAWN_KIND, ...POINT, params: { species: GIANT_SPECIES.amoeba } },
    };
    expect(applyDebugPatch(createTestWorld(), patch)).toEqual(applyDebugPatch(createTestWorld(), patch));
  });

  it('refuses an unknown species and a mass outside [CELL_STARTING_MASS, GIANT_MASS_CEILING]', () => {
    const world = createTestWorld();
    expect(() => spawnGiant(world, {})).toThrow(DebugRequestError);
    expect(() => spawnGiant(world, { species: 'amoeba' })).toThrow(/giant_amoeba, giant_paramecium, giant_diatom/);
    const floor = DEFAULT_BALANCE.growth.CELL_STARTING_MASS;
    const ceiling = giants.GIANT_MASS_CEILING;
    for (const mass of [0, -5, floor - 1, ceiling + 1, 4000, 'big', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => spawnGiant(world, { species: GIANT_SPECIES.amoeba, mass }), String(mass)).toThrow(DebugRequestError);
    }
    expect(world.giantSeats).toEqual([]);
  });

  it('takes the bounds themselves: a giant of CELL_STARTING_MASS and one at the ceiling', () => {
    const world = createTestWorld();
    const floor = DEFAULT_BALANCE.growth.CELL_STARTING_MASS;
    expect(spawnGiant(world, { species: GIANT_SPECIES.amoeba, mass: floor }).mass).toBe(floor);
    expect(spawnGiant(world, { species: GIANT_SPECIES.diatom, mass: giants.GIANT_MASS_CEILING }).mass).toBe(1500);
  });
});

describe('setBalanceForDebug, a trait tier patch, on a giant', () => {
  it('refolds the giant through its build, so its species speed multiplier stays', () => {
    const world = createTestWorld();
    const species = GIANT_SPECIES.paramecium;
    const { cell } = seatTestGiantCell(world, { species, at: { x: 1500, y: 0 }, bornMass: 1000 });
    setBalanceForDebug(world, CILIA_SPEED_PATCH);
    const traitsOnly = foldModifiers(cell.traits, world.balance.traits.TRAIT_TIERS).speedMultiplier;
    expect(traitsOnly).not.toBe(foldModifiers(cell.traits, DEFAULT_BALANCE.traits.TRAIT_TIERS).speedMultiplier);
    const speciesMultiplier = giants.GIANT_SPEED_MULTIPLIER_BY_SPECIES[species];
    expect(cell.modifiers.speedMultiplier).toBeCloseTo(traitsOnly * speciesMultiplier, 10);
  });
});
