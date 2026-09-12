// The payout table, rule by rule (docs/ECOLOGY.md §6.1 "Payout", §3.3 for a wild side): mass
// yield, DNA, tag points, the endosymbiont credit, the counters, and the prey's death. The whole
// engulf running into a payout is `engulf.test.ts`; the tick-accurate rows are the §8 scenarios.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DNA_TAG,
  EFFECT_KIND,
  ENDOSYMBIOSIS_BACTERIA_REQUIRED,
  FOOD_KIND,
  PLAYER_LIFE_STATE,
  secondsToTicks,
} from '@evolution/shared';
import { ENGULF_PREY_MASS, createEngulfFixture, type EngulfFixture } from '../../testing/engulf-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { requirePlayer } from '../world/lookups.js';
import type { PlayerRecord } from '../world/entities.js';
import { beginEngulf, sealEngulf } from './engulf-state.js';
import { payOutEngulf } from './engulf-payout.js';

const { absorption, ecology, growth } = DEFAULT_BALANCE;
const PAYOUT_TICK = 30;
/** The E9 prey (20 mass): the yield is 16 and the detritus two motes of 2. */
const PREY_MASS = ENGULF_PREY_MASS;
const PREY_DNA = 100;
const PREY_TAG_POINTS = 8;

interface PaidOut extends EngulfFixture {
  predatorPlayer: PlayerRecord;
  preyPlayer: PlayerRecord;
  predatorMassBefore: number;
}

/** A sealed engulf on the E9 pair, paid out on tick 30. */
function payOut(prepare: (fixture: PaidOut) => void = () => {}): PaidOut {
  const fixture = createEngulfFixture();
  const { world, context, predator, prey } = fixture;
  world.tick = PAYOUT_TICK;
  const paid: PaidOut = {
    ...fixture,
    predatorPlayer: requirePlayer(world, predator.playerId!),
    preyPlayer: requirePlayer(world, prey.playerId!),
    predatorMassBefore: predator.mass,
  };
  beginEngulf({ predator, prey });
  sealEngulf({ predator, prey });
  prepare(paid);
  paid.predatorMassBefore = predator.mass;
  payOutEngulf(world, context, { predator, prey });
  return paid;
}

describe('payOutEngulf: the predator', () => {
  it('gains ENGULF_MASS_YIELD of the prey mass and ends the engulf', () => {
    const { predator, prey, predatorMassBefore } = payOut();
    expect(predator.mass).toBeCloseTo(predatorMassBefore + PREY_MASS * absorption.ENGULF_MASS_YIELD, 6);
    expect(predator.engulfingCellId).toBeNull();
    expect(predator.states).toEqual([]);
    expect(prey.lastRelease).toBeNull(); // a payout is not a release (docs/ECOLOGY.md §6.1)
  });

  it('converts the yield above CELL_MAX_MASS into DNA (docs/ECOLOGY.md §5.4)', () => {
    const { predatorPlayer } = payOut(({ predator }) => {
      predator.mass = growth.CELL_MAX_MASS;
    });
    const overflow = PREY_MASS * absorption.ENGULF_MASS_YIELD;
    expect(predatorPlayer.dnaCumulative).toBeCloseTo(
      absorption.ENGULF_DNA_BASE + overflow * growth.MASS_OVERFLOW_DNA_PER_MASS,
      6,
    );
  });

  it('gains ENGULF_DNA_BASE plus the prey share, multiplied by its own dnaGainMultiplier', () => {
    const { predatorPlayer } = payOut(({ preyPlayer, predator, predatorPlayer: eater, world }) => {
      preyPlayer.dnaCumulative = PREY_DNA;
      eater.ownedTraits.push({ traitId: 'nucleoid', tier: 1 });
      refreshCellDerivedState(predator, eater, world.balance);
    });
    const gained = absorption.ENGULF_DNA_BASE + PREY_DNA * absorption.ENGULF_DNA_SHARE;
    const multiplier = DEFAULT_BALANCE.traits.TRAIT_TIERS.nucleoid[0]!.dnaGainMultiplier!;
    expect(predatorPlayer.dnaCumulative).toBeCloseTo(gained * multiplier, 6);
    expect(predatorPlayer.dnaTowardNextLevel).toBeCloseTo(gained * multiplier, 6);
  });

  it('takes ENGULF_TAG_SHARE of every prey tag and the flat predatory points', () => {
    const { predatorPlayer } = payOut(({ preyPlayer }) => {
      preyPlayer.dnaTagPoints[DNA_TAG.photic] = PREY_TAG_POINTS;
      preyPlayer.dnaTagPoints[DNA_TAG.predatory] = PREY_TAG_POINTS;
    });
    expect(predatorPlayer.dnaTagPoints[DNA_TAG.photic]).toBeCloseTo(PREY_TAG_POINTS * absorption.ENGULF_TAG_SHARE, 6);
    expect(predatorPlayer.dnaTagPoints[DNA_TAG.predatory]).toBeCloseTo(
      PREY_TAG_POINTS * absorption.ENGULF_TAG_SHARE + absorption.ENGULF_PREDATORY_TAG_POINTS,
      6,
    );
    expect(predatorPlayer.dnaTagPoints[DNA_TAG.armored]).toBe(0);
  });

  it('counts one absorption, which is what scores', () => {
    const { predatorPlayer } = payOut();
    expect(predatorPlayer.absorptions).toBe(1);
    expect(predatorPlayer.wildAbsorptions).toBe(0);
  });

  it('credits the endosymbiont counter of a prey that owns the organelle (docs/ECOLOGY.md §1)', () => {
    const { predatorPlayer } = payOut(({ prey, preyPlayer, world }) => {
      preyPlayer.ownedTraits.push({ traitId: 'mitochondrion', tier: 1 });
      refreshCellDerivedState(prey, preyPlayer, world.balance);
    });
    expect(predatorPlayer.bacteriaEatenByVariant.aerobic).toBe(ENDOSYMBIOSIS_BACTERIA_REQUIRED);
    expect(predatorPlayer.bacteriaEatenByVariant.photosynthetic).toBe(0);
  });

  it('never lowers a counter the eater has already filled past the requirement', () => {
    const { predatorPlayer } = payOut(({ prey, preyPlayer, predatorPlayer: eater, world }) => {
      eater.bacteriaEatenByVariant.aerobic = ENDOSYMBIOSIS_BACTERIA_REQUIRED + 5;
      preyPlayer.ownedTraits.push({ traitId: 'mitochondrion', tier: 1 });
      refreshCellDerivedState(prey, preyPlayer, world.balance);
    });
    expect(predatorPlayer.bacteriaEatenByVariant.aerobic).toBe(ENDOSYMBIOSIS_BACTERIA_REQUIRED + 5);
  });
});

describe('payOutEngulf: the prey', () => {
  it('removes the cell, emits cell_absorbed and starts the respawn countdown', () => {
    const { world, context, predator, prey, preyPlayer } = payOut();
    expect(world.cells).not.toContain(prey);
    expect(context.effects).toContainEqual({
      kind: EFFECT_KIND.cellAbsorbed,
      tick: PAYOUT_TICK,
      x: prey.x,
      y: prey.y,
      cellId: prey.id,
      playerId: preyPlayer.playerId,
      predatorCellId: predator.id,
    });
    expect(preyPlayer.lifeState).toBe(PLAYER_LIFE_STATE.spectating);
    expect(preyPlayer.spectatingCellId).toBe(predator.id);
    expect(preyPlayer.respawnInTicks).toBe(secondsToTicks(DEFAULT_BALANCE.session.RESPAWN_SPECTATE_SECONDS) + 1);
  });

  it('drops DETRITUS_MASS_FRACTION of its mass as detritus', () => {
    const { world } = payOut();
    const detritus = world.food.filter((mote) => mote.kind === FOOD_KIND.detritus);
    expect(detritus).toHaveLength(
      Math.floor((ecology.DETRITUS_MASS_FRACTION * PREY_MASS) / ecology.DETRITUS_MOTE_MASS),
    );
  });

  it('keeps its lifetime DNA and level: dying costs time and mass, never score', () => {
    const { preyPlayer } = payOut(({ preyPlayer: victim }) => {
      victim.dnaCumulative = PREY_DNA;
      victim.level = 3;
    });
    expect(preyPlayer.dnaCumulative).toBe(PREY_DNA);
    expect(preyPlayer.level).toBe(3);
  });

  it('aborts the engulf the prey itself was running, without paying it out (the chain, §6.3)', () => {
    const fixture = createEngulfFixture();
    const { world, context, predator, prey, third } = fixture;
    world.tick = PAYOUT_TICK;
    beginEngulf({ predator, prey });
    beginEngulf({ predator: prey, prey: third });
    payOutEngulf(world, context, { predator, prey });
    expect(third.engulfedByCellId).toBeNull();
    expect(third.states).toEqual([]);
    expect(world.cells).toContain(third);
    expect(requirePlayer(world, prey.playerId!).absorptions).toBe(0);
  });
});

describe('payOutEngulf: a wild cell on either side (docs/ECOLOGY.md §3.3)', () => {
  it('pays no DNA base, no tag share and counts a wildAbsorption for a wild prey', () => {
    const { predatorPlayer } = payOut(({ prey }) => {
      prey.playerId = null; // the wild-cell slice places real ones; the payout rule is the same
    });
    expect(predatorPlayer.wildAbsorptions).toBe(1);
    expect(predatorPlayer.absorptions).toBe(0);
    expect(predatorPlayer.dnaCumulative).toBe(0); // worldDna is 0 in the protocell era
    expect(predatorPlayer.dnaTagPoints[DNA_TAG.predatory]).toBe(absorption.ENGULF_PREDATORY_TAG_POINTS);
  });

  it('keeps the mass yield for a wild prey', () => {
    const { predator, predatorMassBefore } = payOut(({ prey }) => {
      prey.playerId = null;
    });
    expect(predator.mass).toBeCloseTo(predatorMassBefore + PREY_MASS * absorption.ENGULF_MASS_YIELD, 6);
  });

  it('gives a wild predator nothing but still kills the player prey', () => {
    const { world, predator, prey, preyPlayer, predatorMassBefore } = payOut(({ predator: wild }) => {
      wild.playerId = null;
    });
    expect(predator.mass).toBe(predatorMassBefore);
    expect(world.cells).not.toContain(prey);
    expect(preyPlayer.lifeState).toBe(PLAYER_LIFE_STATE.spectating);
    expect(preyPlayer.spectatingCellId).toBe(predator.id);
  });
});
