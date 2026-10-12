// docs/ecology/giants.md §3.5.3, §3.5.10: a giant settles on its born mass, which never decays and never moves with
// the world; a meal becomes growth up to `GIANT_MASS_CEILING`; the growth decays at the player's rate ×
// `GIANT_DECAY_MULTIPLIER`; the build and the speed multiplier are laid on again; and the die-off never counts a giant.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES, TICK_INTERVAL_S } from '@evolution/shared';
import { seatTestGiantCell, seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { decayPerSecond, metabolismInputOf } from '../simulation/metabolism.js';
import { giantDecayPerSecond, settleGiantCells } from './giant-settle.js';
import { settleWildCells } from './wild-settle.js';

const { giants, growth, ecology } = DEFAULT_BALANCE;
const SETTLE_DIGITS = 6;
/** Away from the player at the origin side of the dish, in open broth. */
const AWAY = { x: 1500, y: 1500 };
/** The amoeba's Mitochondrion I. */
const MITOCHONDRION_DECAY = DEFAULT_BALANCE.traits.TRAIT_TIERS.mitochondrion[0]!.decayMultiplier!;

function settledOnce(bornMass: number, grownMass = 0) {
  const world = createTestWorld();
  const giant = seatTestGiantCell(world, { species: GIANT_SPECIES.amoeba, at: AWAY, bornMass, grownMass });
  return { world, ...giant, context: createTestStepContext(world) };
}

describe('giantDecayPerSecond', () => {
  it("is the player's decay at the giant's mass × GIANT_DECAY_MULTIPLIER", () => {
    const { world, cell } = settledOnce(1400, 100);
    const playerRate = decayPerSecond(metabolismInputOf(cell, world, DEFAULT_BALANCE), DEFAULT_BALANCE);
    expect(giantDecayPerSecond(cell, world, DEFAULT_BALANCE)).toBeCloseTo(
      playerRate * giants.GIANT_DECAY_MULTIPLIER,
      SETTLE_DIGITS,
    );
    expect(playerRate).toBeCloseTo(
      (1500 - growth.CELL_STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND * MITOCHONDRION_DECAY,
      SETTLE_DIGITS,
    );
  });
});

describe('settleGiantCells', () => {
  it('keeps a giant with no growth at its born mass, whatever the world clock', () => {
    const { world, seat, cell, context } = settledOnce(1000);
    world.tick = 30_000;
    settleGiantCells(world, context);
    expect([cell.mass, seat.grownMass, seat.fullMass]).toEqual([1000, 0, 1000]);
  });

  it('takes one tick of the quartered decay from the growth alone', () => {
    const { world, seat, cell, context } = settledOnce(1400, 100);
    const perTick = giantDecayPerSecond(cell, world, DEFAULT_BALANCE) * TICK_INTERVAL_S;
    settleGiantCells(world, context);
    expect(seat.grownMass).toBeCloseTo(100 - perTick, SETTLE_DIGITS);
    expect(cell.mass).toBeCloseTo(1500 - perTick, SETTLE_DIGITS);
    expect(seat.bornMass).toBe(1400);
  });

  it('G11: turns a meal into growth and loses what passes GIANT_MASS_CEILING', () => {
    const { world, seat, cell, context } = settledOnce(1400);
    setCellMass(cell, 1400 + 0.8 * 411, DEFAULT_BALANCE); // the payout of a 411-mass wild cell: 1 728.8
    settleGiantCells(world, context);
    expect([seat.fullMass, seat.grownMass, cell.mass]).toEqual([giants.GIANT_MASS_CEILING, 100, 1500]);
  });

  it('lays the build and the species speed multiplier on again', () => {
    const { world, cell, context } = settledOnce(1000);
    cell.modifiers = { ...cell.modifiers, speedMultiplier: 1 };
    settleGiantCells(world, context);
    expect(cell.modifiers.speedMultiplier).toBeCloseTo(giants.GIANT_SPEED_MULTIPLIER_BY_SPECIES.giant_amoeba, 10);
  });
});

describe('a giant and the die-off (§3.5.10)', () => {
  it('is never counted: a light wild cell beside three heavy giants does not starve, nor does any giant', () => {
    const world = createTestWorld();
    const wild = seatTestWildCell(world, { at: { x: -1500, y: 0 }, mass: 600 });
    const amoeba = seatTestGiantCell(world, { species: GIANT_SPECIES.amoeba, at: AWAY, bornMass: 1500 });
    seatTestGiantCell(world, { species: GIANT_SPECIES.diatom, at: { x: 0, y: -1500 }, bornMass: 1500 });
    const context = createTestStepContext(world);
    settleWildCells(world, context);
    settleGiantCells(world, context);
    expect([wild.seat.isStarving, wild.cell.isStarving, amoeba.cell.isStarving]).toEqual([false, false, false]);
    expect(amoeba.cell.mass).toBe(1500);
  });
});
