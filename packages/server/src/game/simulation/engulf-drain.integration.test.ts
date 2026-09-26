// Spiny, toxic and armoured prey against their predators through the whole step (docs/architecture/server-simulation.md
// §3, docs/traits/catalog-organelles.md §3.11, docs/traits/catalog-forms.md §3.15, #154): the trait fold
// (`progression/modifiers.ts`), the dose the metabolism step charges (`engulf-drain.ts`), the ratio
// release and the payout, wired by `stepWorld` alone — no fixture moves a mass. Two
// runs of the same setup hash equal at every tick (docs/determinism/replay-tests-and-traps.md §7).
//
// T4's seeded spit-out runs on the scenario runner (`testing/scenarios/traits-engulf-spit-out.gameplay.test.ts`,
// #402). T22's payout ticks and masses come from `modelHeldPair`, a step
// model on the shared eligibility and pace formulas, never from the table's rounded numbers
// (docs/traits/constants-and-acceptance.md §6). Run with `./validate.sh integration`.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  foldModifiers,
  playerId,
  type EffectKind,
  type GameEffect,
  type OwnedTrait,
  type StateHash,
} from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { HELD_PAIR_OUTCOME, modelHeldPair } from '../../testing/scenarios/trait-engulf-setups.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import type { CellRecord, PlayerRecord } from '../world/entities.js';
import { computeStateHash } from '../world/state-hash.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { stepWorld } from './step.js';

const CENTRE_DISTANCE_WU = 10;
const TOP_TIER = 3;
const MASS_DIGITS = 2;
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
  for (let tick = 1; tick <= setup.ticks; tick += 1) {
    stepWorld(world, context);
    hashes.push(computeStateHash(world));
    predatorMassByTick.push(predator.mass);
  }
  return {
    world,
    predator,
    prey,
    effects: [...world.effects],
    hashes,
    predatorMassByTick,
  };
}

const toxinPrey: PairSetup = { ...T18, preyTraits: [tierOf('toxin_vacuole')] };
const trioPrey: PairSetup = {
  ...T22,
  hasNoSpitOut: true,
  preyTraits: [tierOf('cell_wall', TOP_TIER), tierOf('diatom_shell', TOP_TIER), tierOf('toxin_vacuole', TOP_TIER)],
};

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
