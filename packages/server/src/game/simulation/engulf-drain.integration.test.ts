// Spiny, toxic and armoured prey against their predators through the whole step (docs/architecture/server-simulation.md
// §3, docs/traits/catalog-organelles.md §3.11, docs/traits/catalog-forms.md §3.15, #154): the trait fold
// (`progression/modifiers.ts`), the dose the metabolism step charges (`engulf-drain.ts`), the spit-out roll and
// its refractory, the ratio release and the payout, wired by `stepWorld` alone — no fixture moves a mass. Two
// runs of the same setup hash equal at every tick (docs/determinism/replay-tests-and-traps.md §7).
//
// T4 lives here rather than on the scenario runner: its spit-out is a draw of the seed-42 `engulf` stream, and
// the runner refuses seed 42 for placed rows (a gel patch sits by the broth point), while seed 48's stream
// never draws under a Diatom Shell's chance. The world here is seed 42 with the gel patches cleared, and the
// spit-out tick is derived from that stream; #402 tracks giving the runner a seed the placed rows can spit out
// on, which would bring T4 back to the scenario tier. T22's payout ticks and masses come from `modelHeldPair`, a step
// model on the shared eligibility and pace formulas, never from the table's rounded numbers
// (docs/traits/constants-and-acceptance.md §6). Run with `./validate.sh integration`.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  RANDOM_STREAM,
  createSeededRandom,
  distanceBetween,
  foldModifiers,
  playerId,
  secondsToTicks,
  spitOutChancePerTick,
  type EffectKind,
  type GameEffect,
  type OwnedTrait,
  type StateHash,
} from '@evolution/shared';
import { E9_COVER_TICKS } from '../../testing/engulf-builders.js';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { HELD_PAIR_OUTCOME, drainedMass, modelHeldPair } from '../../testing/scenarios/trait-engulf-setups.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { computeStateHash } from '../world/state-hash.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { stepWorld } from './step.js';

const { absorption } = DEFAULT_BALANCE;
const CENTRE_DISTANCE_WU = 10;
const TOP_TIER = 3;
const MASS_DIGITS = 2;
/** `createTestWorld`'s seed, which the derived draws must be taken from. */
const TEST_WORLD_SEED = 42;
/** T4: the E9 pair, B with Diatom Shell I; unspat, the absorb at × 1.4 would pay out on tick 44. */
const T4_ROW = { predatorMass: 100, preyMass: 20, ticks: 120, unspatPayoutTick: 44 };
/** T18's pair: A at 101 over B at 80; without the toxin A absorbs B on tick 72. */
const T18 = { predatorMass: 101, preyMass: 80, ticks: 72 };
/**
 * T22: Cell Wall III + Diatom Shell III + Toxin Vacuole III at 100 against A at 300, spit-out written to 0, over the
 * row's 90 ticks. The outcome is derived (`modelHeldPair`); the table states tick 84 at ≈ 296.05 and, with Food
 * Vacuole III, tick 51 at ≈ 345.38.
 */
const T22 = { predatorMass: 300, preyMass: 100, ticks: 90 };
/**
 * What the row states, as a drift guard on the model: the model and the simulation share the shared formulas, so
 * a rule change would move both together and only the table would notice.
 */
const T22_TABLE = [
  { payoutTick: 84, massAfterYield: 296.05 },
  { payoutTick: 51, massAfterYield: 345.38 },
] as const;
/** "± 0.01" on a mass the table rounds to two decimals. */
const TABLE_MASS_TOLERANCE = 0.01;

interface PairSetup {
  readonly predatorMass: number;
  readonly preyMass: number;
  readonly ticks: number;
  readonly predatorTraits?: readonly OwnedTrait[];
  readonly preyTraits?: readonly OwnedTrait[];
  /** Writes the Diatom Shell III spit-out chance to 0 on the room's balance copy (T22 isolates ratio and armour). */
  readonly hasNoSpitOut?: boolean;
}

interface PairRun {
  readonly world: WorldState;
  readonly predator: CellRecord;
  readonly prey: CellRecord;
  readonly effects: readonly GameEffect[];
  readonly hashes: readonly StateHash[];
  readonly predatorMassByTick: readonly number[];
  readonly isPreyHeldByTick: readonly boolean[];
  /** The last tick the predator's refractory on this prey blocks a restart, per tick; `undefined` when it holds none. */
  readonly refractoryUntilByTick: readonly (number | undefined)[];
}

const tierOf = (traitId: OwnedTrait['traitId'], tier = 1): OwnedTrait => ({ traitId, tier }) as OwnedTrait;

function effectsOfKind<Kind extends EffectKind>(run: PairRun, kind: Kind): Extract<GameEffect, { kind: Kind }>[] {
  return run.effects.filter((effect): effect is Extract<GameEffect, { kind: Kind }> => effect.kind === kind);
}

function grant(world: WorldState, cell: CellRecord, player: PlayerRecord, traits?: readonly OwnedTrait[]): void {
  player.ownedTraits.push(...(traits ?? []));
  refreshCellDerivedState(cell, player, world.balance);
}

function runPair(setup: PairSetup): PairRun {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
    ],
  });
  if (setup.hasNoSpitOut === true) {
    world.balance = structuredClone(DEFAULT_BALANCE);
    world.balance.traits.TRAIT_TIERS.diatom_shell[TOP_TIER - 1]!.spitOutChancePerSecond = 0;
  }
  world.gelPatches = [];
  const [predator, prey] = world.cells as [CellRecord, CellRecord];
  for (const [cell, mass, offset] of [
    [predator, setup.predatorMass, 0],
    [prey, setup.preyMass, CENTRE_DISTANCE_WU],
  ] as const) {
    cell.x = BROTH_POINT.x + offset;
    cell.y = BROTH_POINT.y;
    cell.targetX = null;
    cell.targetY = null;
    setCellMass(cell, mass, world.balance);
  }
  grant(world, predator, world.players[0]!, setup.predatorTraits);
  grant(world, prey, world.players[1]!, setup.preyTraits);
  const context = createTestStepContext(world);
  const hashes: StateHash[] = [];
  const predatorMassByTick: number[] = [];
  const isPreyHeldByTick: boolean[] = [];
  const refractoryUntilByTick: (number | undefined)[] = [];
  for (let tick = 1; tick <= setup.ticks; tick += 1) {
    stepWorld(world, context);
    hashes.push(computeStateHash(world));
    predatorMassByTick.push(predator.mass);
    isPreyHeldByTick.push(prey.engulfedByCellId !== null);
    refractoryUntilByTick.push(
      predator.spitOutRefractories.find((refractory) => refractory.preyCellId === prey.id)?.untilTick,
    );
  }
  return {
    world,
    predator,
    prey,
    effects: [...world.effects],
    hashes,
    predatorMassByTick,
    isPreyHeldByTick,
    refractoryUntilByTick,
  };
}

/**
 * The tick a spiny prey is spat out, from the world's own `engulf` stream: the prey rolls once per tick from
 * the first wrap tick (the tick after progress reaches the wrap band, E9's tick 7), and the first draw under
 * the per-tick chance spits it out (docs/ecology/absorption.md §6.1). Undefined when no draw lands in `draws`.
 */
function spitOutTickOf(seed: number, chancePerSecond: number, draws: number): number | undefined {
  const firstWrapTick = E9_COVER_TICKS + 1;
  const stream = createSeededRandom(seed).fork(RANDOM_STREAM.engulf);
  const chance = spitOutChancePerTick(chancePerSecond);
  for (let draw = 0; draw < draws; draw += 1) {
    if (stream.nextFloat() < chance) return firstWrapTick + draw;
  }
  return undefined;
}

const toxinPrey: PairSetup = { ...T18, preyTraits: [tierOf('toxin_vacuole')] };
const trioPrey: PairSetup = {
  ...T22,
  hasNoSpitOut: true,
  preyTraits: [tierOf('cell_wall', TOP_TIER), tierOf('diatom_shell', TOP_TIER), tierOf('toxin_vacuole', TOP_TIER)],
};

describe('T4: a Diatom Shell prey spat out by the seeded engulf stream, through stepWorld (#260)', () => {
  const diatomTiers = DEFAULT_BALANCE.traits.TRAIT_TIERS.diatom_shell;

  it('spits B out on the derived tick, before the absorb could pay out, with A bled by the spike dose', () => {
    const run = runPair({ ...T4_ROW, preyTraits: [tierOf('diatom_shell')] });
    const spitOutTick = spitOutTickOf(run.world.seed, diatomTiers[0]!.spitOutChancePerSecond!, T4_ROW.unspatPayoutTick);
    expect(spitOutTick, 'the seed-42 stream draws under the Diatom Shell I chance before the payout').toBeDefined();
    const released = effectsOfKind(run, EFFECT_KIND.cellReleased);
    expect(released.map((effect) => [effect.tick, effect.reason])).toEqual([
      [spitOutTick, ENGULF_RELEASE_REASON.spatOut],
    ]);
    expect(effectsOfKind(run, EFFECT_KIND.cellAbsorbed)).toEqual([]);
    // The spike dose reads B's mass (#154); B sits at the starting mass, so it never decays.
    const expectedMass = drainedMass(T4_ROW.predatorMass, [
      { ticks: 1 },
      {
        ticks: spitOutTick! - 1,
        dose: { preyMass: T4_ROW.preyMass, fractionPerSecond: diatomTiers[0]!.spikeDrainFractionPerSecond! },
      },
    ]);
    expect(run.predatorMassByTick[spitOutTick! - 1]).toBeCloseTo(expectedMass, MASS_DIGITS);
  });

  it('records the refractory to the spit-out tick plus its seconds, and never restarts on B', () => {
    const run = runPair({ ...T4_ROW, preyTraits: [tierOf('diatom_shell')] });
    const spitOutTick = spitOutTickOf(
      run.world.seed,
      diatomTiers[0]!.spitOutChancePerSecond!,
      T4_ROW.unspatPayoutTick,
    )!;
    const refractoryTicks = secondsToTicks(absorption.ENGULF_SPIT_OUT_REFRACTORY_SECONDS);
    expect(run.refractoryUntilByTick[spitOutTick - 1]).toBe(spitOutTick + refractoryTicks);
    // Pruned the tick after the last blocked one, and B is never claimed again in the row's 120 ticks.
    expect(run.refractoryUntilByTick[spitOutTick + refractoryTicks]).toBeUndefined();
    expect(run.isPreyHeldByTick.slice(spitOutTick)).not.toContain(true);
    const contactBound = run.predator.radius - run.prey.radius * absorption.ENGULF_COVERAGE_FRACTION;
    expect(distanceBetween(run.predator, run.prey)).toBeGreaterThan(contactBound);
  });

  it('Diatom Shell III rolls the same stream, so the same draw spits B out on the same tick', () => {
    const tierOneTick = spitOutTickOf(
      TEST_WORLD_SEED,
      diatomTiers[0]!.spitOutChancePerSecond!,
      T4_ROW.unspatPayoutTick,
    );
    const run = runPair({ ...T4_ROW, preyTraits: [tierOf('diatom_shell', TOP_TIER)] });
    const topTierChance = diatomTiers[TOP_TIER - 1]!.spitOutChancePerSecond!;
    const spitOutTick = spitOutTickOf(run.world.seed, topTierChance, T4_ROW.unspatPayoutTick);
    expect(spitOutTick, "the table's claim: a chance this much larger still turns on the same draw").toBe(tierOneTick);
    expect(effectsOfKind(run, EFFECT_KIND.cellReleased).map((effect) => [effect.tick, effect.reason])).toEqual([
      [spitOutTick, ENGULF_RELEASE_REASON.spatOut],
    ]);
  });

  it('hashes equal at every tick across two runs: the spit-out draw is seeded (the runner rows hash-compare too)', () => {
    const first = runPair({ ...T4_ROW, preyTraits: [tierOf('diatom_shell')] });
    expect(runPair({ ...T4_ROW, preyTraits: [tierOf('diatom_shell')] }).hashes).toEqual(first.hashes);
  });
});

describe('a swallowed toxin prey against its predator, through stepWorld (#260, #154)', () => {
  it('T18: drains the predator under the release ratio, so the prey is released on the ratio and never absorbed', () => {
    const run = runPair(toxinPrey);
    expect(effectsOfKind(run, EFFECT_KIND.cellReleased).map((effect) => effect.reason)).toEqual([
      ENGULF_RELEASE_REASON.ratio,
    ]);
    expect(effectsOfKind(run, EFFECT_KIND.cellAbsorbed)).toEqual([]);
    expect(run.world.cells).toContain(run.prey);
  });

  it('T18: the same pair without the toxin runs to the payout', () => {
    const run = runPair(T18);
    expect(effectsOfKind(run, EFFECT_KIND.cellReleased)).toEqual([]);
    expect(effectsOfKind(run, EFFECT_KIND.cellAbsorbed)).toHaveLength(1);
    expect(run.world.cells).not.toContain(run.prey);
  });

  it('T22: the Wall + Diatom + Toxin trio at 3 × is absorbed when the step model says, plain and by a Food Vacuole III', () => {
    const tierTables = DEFAULT_BALANCE.traits.TRAIT_TIERS;
    for (const [index, predatorTraits] of [[], [tierOf('food_vacuole', TOP_TIER)]].entries()) {
      const stated = T22_TABLE[index]!;
      const expected = modelHeldPair({
        predatorMass: T22.predatorMass,
        preyMass: T22.preyMass,
        predator: foldModifiers(predatorTraits, tierTables),
        prey: foldModifiers(trioPrey.preyTraits ?? [], tierTables),
        maxTicks: T22.ticks,
      });
      expect(expected.kind, 'the model pays the trio out inside the row').toBe(HELD_PAIR_OUTCOME.payout);
      // The design row is the third opinion: it moves only when the rules really change.
      expect(expected.tick, 'the T22 row states this payout tick').toBe(stated.payoutTick);
      expect(Math.abs(expected.predatorMass - stated.massAfterYield)).toBeLessThanOrEqual(TABLE_MASS_TOLERANCE);
      const run = runPair({ ...trioPrey, predatorTraits });
      expect(effectsOfKind(run, EFFECT_KIND.cellAbsorbed).map((effect) => effect.tick)).toEqual([expected.tick]);
      expect(run.predatorMassByTick[expected.tick - 1]).toBeCloseTo(expected.predatorMass, MASS_DIGITS);
    }
  });

  it('hashes equal at every tick across two runs, and the toxin moves the hash', () => {
    const first = runPair(toxinPrey);
    expect(runPair(toxinPrey).hashes).toEqual(first.hashes);
    expect(runPair(T18).hashes).not.toEqual(first.hashes);
  });
});
