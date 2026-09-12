// docs/ECOLOGY.md §6.1's spit-out and the refractory it leaves, driven at step level on a folded
// modifier the test writes: no build-1 tier table sets `spitOutChancePerSecond` until #260
// (docs/TRAITS.md §3.15), so this is the only way the branch, the `engulf` random stream and the
// refractory run at all. The rest of the lifecycle is `engulf.test.ts`.

import { describe, expect, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  ENGULF_RELEASE_REASON,
  TICK_HZ,
  distanceBetween,
  secondsToTicks,
} from '@evolution/shared';
import {
  E9_COVER_TICKS,
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  createEngulfFixture,
  releaseReasonsOf,
  stepEngulf,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import { separateOverlappingCells } from './contact.js';
import { runEngulfs } from './engulf.js';
import { hasSpitOutRefractory, recordSpitOutRefractory } from './engulf-spit-out.js';

const absorption = DEFAULT_BALANCE.absorption;
/** `spitOutChancePerSecond` = `TICK_HZ` is one chance per tick: every roll lands under it. */
const CERTAIN_SPIT_OUT_PER_SECOND = TICK_HZ;
/** The Diatom Shell I chance #260 will grant (docs/TRAITS.md §3.15): rolled, rarely hit. */
const DIATOM_ONE_CHANCE_PER_SECOND = 0.4;

type Fixture = EngulfFixture;
const twoCells = (): Fixture => createEngulfFixture();
const releaseReasons = (fixture: Fixture): unknown[] => releaseReasonsOf(fixture.context.effects);
const distanceOf = (fixture: Fixture): number => distanceBetween(fixture.predator, fixture.prey);

describe('the spit-out (docs/ECOLOGY.md §6.1; no build-1 trait sets the chance until #260)', () => {
  function spinyPrey(chancePerSecond: number): Fixture {
    const fixture = twoCells();
    fixture.prey.modifiers = { ...fixture.prey.modifiers, spitOutChancePerSecond: chancePerSecond };
    return fixture;
  }

  const streamPosition = (fixture: Fixture): number => fixture.context.streams.engulf.getState().position;

  it('draws once per wrapped tick and never during cover', () => {
    const fixture = spinyPrey(DIATOM_ONE_CHANCE_PER_SECOND);
    stepEngulf(fixture, E9_COVER_TICKS);
    expect(streamPosition(fixture)).toBe(0);
    stepEngulf(fixture, 3);
    expect(streamPosition(fixture)).toBe(3);
  });

  it('keeps drawing once a tick after the seal', () => {
    const fixture = spinyPrey(DIATOM_ONE_CHANCE_PER_SECOND);
    stepEngulf(fixture, E9_SEAL_TICK + 2);
    expect(streamPosition(fixture)).toBe(E9_SEAL_TICK + 2 - E9_COVER_TICKS);
  });

  it('releases the prey with reason spat_out and records the refractory (T4)', () => {
    const fixture = spinyPrey(CERTAIN_SPIT_OUT_PER_SECOND);
    stepEngulf(fixture, E9_COVER_TICKS + 1);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.spatOut]);
    expect(fixture.prey.engulfProgress).toBe(0);
    expect(fixture.prey.states).toEqual([]);
    expect(fixture.predator.spitOutRefractories.map((entry) => entry.preyCellId)).toEqual([fixture.prey.id]);
  });

  it('will not restart on that prey while the refractory is live, and does once it lapses', () => {
    const fixture = spinyPrey(CERTAIN_SPIT_OUT_PER_SECOND);
    stepEngulf(fixture, E9_COVER_TICKS + 1);
    const untilTick = fixture.predator.spitOutRefractories[0]?.untilTick ?? 0;
    fixture.prey.modifiers = { ...fixture.prey.modifiers, spitOutChancePerSecond: 0 };
    fixture.world.tick = untilTick;
    runEngulfs(fixture.world, fixture.context);
    expect(fixture.prey.states).toEqual([]);
    fixture.world.tick = untilTick + 1;
    runEngulfs(fixture.world, fixture.context);
    expect(fixture.prey.states).toEqual([CELL_STATE.beingEngulfed]);
  });

  it('separates the pair while the refractory is live (docs/ECOLOGY.md §5.3, T4)', () => {
    const fixture = spinyPrey(CERTAIN_SPIT_OUT_PER_SECOND);
    stepEngulf(fixture, E9_COVER_TICKS + 1);
    const before = distanceOf(fixture);
    separateOverlappingCells(fixture.world, DEFAULT_BALANCE);
    expect(distanceOf(fixture)).toBeGreaterThan(before);
  });

  it('spans exactly ENGULF_SPIT_OUT_REFRACTORY_SECONDS, with untilTick the last blocked tick', () => {
    const fixture = spinyPrey(CERTAIN_SPIT_OUT_PER_SECOND);
    stepEngulf(fixture, E9_COVER_TICKS + 1);
    const recordedAtTick = fixture.world.tick;
    const untilTick = fixture.predator.spitOutRefractories[0]?.untilTick ?? 0;
    expect(untilTick - recordedAtTick + 1).toBe(secondsToTicks(absorption.ENGULF_SPIT_OUT_REFRACTORY_SECONDS));
  });
});

describe('the spit-out refractory (docs/ECOLOGY.md §6.1, §6.3)', () => {
  it('keeps one entry per spat-out prey and prunes it when it expires', () => {
    const fixture = twoCells();
    recordSpitOutRefractory(fixture.world, { predator: fixture.predator, prey: fixture.prey }, DEFAULT_BALANCE);
    expect(fixture.predator.spitOutRefractories).toHaveLength(1);
    recordSpitOutRefractory(fixture.world, { predator: fixture.predator, prey: fixture.prey }, DEFAULT_BALANCE);
    expect(fixture.predator.spitOutRefractories).toHaveLength(1);
    fixture.world.tick = (fixture.predator.spitOutRefractories[0]?.untilTick ?? 0) + 1;
    runEngulfs(fixture.world, fixture.context);
    expect(fixture.predator.spitOutRefractories).toEqual([]);
  });

  it('forgets a prey that has left the world', () => {
    const fixture = twoCells();
    recordSpitOutRefractory(fixture.world, { predator: fixture.predator, prey: fixture.prey }, DEFAULT_BALANCE);
    fixture.world.cells = [fixture.predator];
    runEngulfs(fixture.world, fixture.context);
    expect(hasSpitOutRefractory(fixture.predator, fixture.prey.id, fixture.world.tick)).toBe(false);
  });

  it('draws nothing from the engulf stream while no prey has spines', () => {
    const fixture = twoCells();
    const before = fixture.world.random.engulf.position;
    stepEngulf(fixture, E9_PAYOUT_TICK);
    expect(fixture.context.streams.engulf.getState().position).toBe(before);
  });
});
