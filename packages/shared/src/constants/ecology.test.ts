// Structural pins of the ecology tables (docs/ECOLOGY.md §1–§3): the walk-order arrays cover
// their enums, every weight row is a distribution, and the populations match the bandwidth
// budget of docs/ARCHITECTURE.md §4.1.

import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, DNA_TAG, ZONE_ID } from '../types/game.js';
import { STAGE_ORDER } from './ladder.js';
import { MAX_PLAYERS_PER_GAME } from './lobby.js';
import {
  BACTERIUM_TAG_BY_VARIANT,
  BACTERIUM_VARIANTS,
  BACTERIUM_VARIANT_WEIGHTS_BY_ZONE,
  BROTH_VARIANT_SHARE_BY_WORLD_STAGE,
  DNA_FRAGMENT_CAP_BASE,
  DNA_FRAGMENT_CAP_PER_PLAYER,
  DNA_FRAGMENT_TAG_TABLE_BY_ZONE,
  FOOD_CAP_BASE,
  FOOD_CAP_PER_PLAYER,
  FOOD_KIND_WEIGHTS_BY_WORLD_STAGE,
  FOOD_ZONE_WEIGHTS_BY_KIND,
} from './ecology.js';

const FULL_ROOM_FOOD_CAP = 1400;
const FULL_ROOM_FRAGMENT_CAP = 110;
const WEIGHT_TOLERANCE_DIGITS = 10;

function sumOf(row: Record<string, number | undefined>): number {
  return Object.values(row).reduce<number>((total, weight) => total + (weight ?? 0), 0);
}

describe('ecology tables', () => {
  it('walks every bacterium variant exactly once', () => {
    expect([...BACTERIUM_VARIANTS].sort()).toEqual(Object.values(BACTERIUM_VARIANT).sort());
    expect(new Set(BACTERIUM_VARIANTS).size).toBe(BACTERIUM_VARIANTS.length);
  });

  it('maps the endosymbiont variants to the tags the ladder credits', () => {
    expect(BACTERIUM_TAG_BY_VARIANT.aerobic).toBe(DNA_TAG.metabolic);
    expect(BACTERIUM_TAG_BY_VARIANT.photosynthetic).toBe(DNA_TAG.photic);
    expect(BACTERIUM_TAG_BY_VARIANT.plain).toBe(DNA_TAG.motile);
  });

  it('makes every weight row a distribution', () => {
    for (const row of Object.values(FOOD_KIND_WEIGHTS_BY_WORLD_STAGE))
      expect(sumOf(row)).toBeCloseTo(1, WEIGHT_TOLERANCE_DIGITS);
    for (const row of Object.values(FOOD_ZONE_WEIGHTS_BY_KIND))
      expect(sumOf(row)).toBeCloseTo(1, WEIGHT_TOLERANCE_DIGITS);
    for (const row of Object.values(BACTERIUM_VARIANT_WEIGHTS_BY_ZONE)) {
      expect(sumOf(row)).toBeCloseTo(1, WEIGHT_TOLERANCE_DIGITS);
    }
    for (const row of Object.values(DNA_FRAGMENT_TAG_TABLE_BY_ZONE)) {
      expect(sumOf(row)).toBeCloseTo(1, WEIGHT_TOLERANCE_DIGITS);
    }
  });

  it('gives the gel the broth fragment row: a gel patch is part of the broth for spawning', () => {
    expect(DNA_FRAGMENT_TAG_TABLE_BY_ZONE[ZONE_ID.viscousGel]).toEqual(
      DNA_FRAGMENT_TAG_TABLE_BY_ZONE[ZONE_ID.openBroth],
    );
  });

  it('fixes only the trip rows of the variant table: the vent carries aerobic, the shallows photosynthetic', () => {
    expect(Object.keys(BACTERIUM_VARIANT_WEIGHTS_BY_ZONE).sort()).toEqual([ZONE_ID.sunlitShallows, ZONE_ID.warmVent]);
    expect(BACTERIUM_VARIANT_WEIGHTS_BY_ZONE[ZONE_ID.warmVent].photosynthetic).toBe(0);
    expect(BACTERIUM_VARIANT_WEIGHTS_BY_ZONE[ZONE_ID.sunlitShallows].aerobic).toBe(0);
  });

  it('turns the world heavier, never lighter: the bacterium share never falls as the world ages', () => {
    let previousShare = 0;
    for (const stage of STAGE_ORDER) {
      const share = FOOD_KIND_WEIGHTS_BY_WORLD_STAGE[stage].bacterium;
      expect(share).toBeGreaterThanOrEqual(previousShare);
      previousShare = share;
    }
    let previousBrothShare = 0;
    for (const stage of STAGE_ORDER) {
      expect(BROTH_VARIANT_SHARE_BY_WORLD_STAGE[stage]).toBeGreaterThanOrEqual(previousBrothShare);
      previousBrothShare = BROTH_VARIANT_SHARE_BY_WORLD_STAGE[stage];
    }
  });

  it('caps a full room at the populations the bandwidth budget was computed for', () => {
    expect(FOOD_CAP_BASE + FOOD_CAP_PER_PLAYER * MAX_PLAYERS_PER_GAME).toBe(FULL_ROOM_FOOD_CAP);
    expect(DNA_FRAGMENT_CAP_BASE + DNA_FRAGMENT_CAP_PER_PLAYER * MAX_PLAYERS_PER_GAME).toBe(FULL_ROOM_FRAGMENT_CAP);
  });
});
