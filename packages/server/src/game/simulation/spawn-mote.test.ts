// docs/ECOLOGY.md §1: what a mote of each kind is worth.
import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, DEFAULT_BALANCE, DNA_TAG, FOOD_KIND, secondsToTicks } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { foodKindStats, spawnDnaFragment, spawnFoodMote } from './spawn-mote.js';

const { ecology } = DEFAULT_BALANCE;

describe('foodKindStats', () => {
  it('reads mass and DNA by kind from the balance', () => {
    expect(foodKindStats(FOOD_KIND.algae, DEFAULT_BALANCE)).toEqual({
      mass: ecology.ALGAE_MASS,
      dna: ecology.ALGAE_DNA,
    });
    expect(foodKindStats(FOOD_KIND.bacterium, DEFAULT_BALANCE)).toEqual({
      mass: ecology.BACTERIUM_MASS,
      dna: ecology.BACTERIUM_DNA,
    });
    expect(foodKindStats(FOOD_KIND.detritus, DEFAULT_BALANCE)).toEqual({ mass: ecology.DETRITUS_MOTE_MASS, dna: 0 });
  });
});

describe('spawnFoodMote', () => {
  it('appends an algae mote with a minted id, no variant, no tag, no expiry', () => {
    const world = createTestWorld();
    const mote = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: 10, y: 20 } });
    expect(world.food).toEqual([mote]);
    expect(mote.id).toMatch(/^m-\d+$/);
    expect(mote).toMatchObject({
      kind: FOOD_KIND.algae,
      bacteriumVariant: null,
      tag: null,
      expiresAtTick: null,
      x: 10,
      y: 20,
    });
    expect(mote.mass).toBe(ecology.ALGAE_MASS);
  });

  it('gives a bacterium its variant tag and drops the variant for other kinds', () => {
    const world = createTestWorld();
    const aerobic = spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.aerobic,
      at: { x: 0, y: 0 },
    });
    expect(aerobic.tag).toBe(DNA_TAG.metabolic);
    expect(aerobic.bacteriumVariant).toBe(BACTERIUM_VARIANT.aerobic);
    const photo = spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.photosynthetic,
      at: { x: 0, y: 0 },
    });
    expect(photo.tag).toBe(DNA_TAG.photic);
    const plain = spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.plain,
      at: { x: 0, y: 0 },
    });
    expect(plain.tag).toBe(DNA_TAG.motile);
    const algae = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: BACTERIUM_VARIANT.plain, at: { x: 0, y: 0 } });
    expect(algae.bacteriumVariant).toBeNull();
  });

  it('gives detritus an expiry DETRITUS_LIFETIME_SECONDS after the current tick', () => {
    const world = createTestWorld();
    world.tick = 100;
    const detritus = spawnFoodMote(world, { kind: FOOD_KIND.detritus, variant: null, at: { x: 0, y: 0 } });
    expect(detritus.expiresAtTick).toBe(100 + secondsToTicks(ecology.DETRITUS_LIFETIME_SECONDS));
  });
});

describe('spawnDnaFragment', () => {
  it('appends a fragment whose drift vector has the drift speed as its length', () => {
    const world = createTestWorld();
    const fragment = spawnDnaFragment(world, { at: { x: 5, y: 6 }, tag: DNA_TAG.sensory, driftTurn: 0.25 });
    expect(world.dnaFragments).toEqual([fragment]);
    expect(fragment.id).toMatch(/^f-\d+$/);
    expect(fragment.tag).toBe(DNA_TAG.sensory);
    expect(Math.hypot(fragment.driftX, fragment.driftY)).toBeCloseTo(ecology.DNA_FRAGMENT_DRIFT_SPEED, 9);
    expect(fragment.driftX).toBeCloseTo(0, 9);
    expect(fragment.driftY).toBeCloseTo(ecology.DNA_FRAGMENT_DRIFT_SPEED, 9);
  });
});
