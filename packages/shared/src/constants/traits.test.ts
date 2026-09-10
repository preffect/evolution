// The pure catalog and ladder tests of docs/TRAITS.md §6 (T10, T11) plus the pins that keep the
// tier tables, the identity record and the catalog one structure.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE, type CellStage, type TraitId } from '../types/game.js';
import { TRAIT_CATEGORY, type TraitDefinition } from '../types/traits.js';
import { ENDOSYMBIOSIS_BACTERIA_REQUIRED, STAGE_GATE_TRAITS, STAGE_ORDER } from './ladder.js';
import {
  DEFAULT_CELL_MODIFIERS,
  EXCLUSION_GROUPS,
  RESERVED_TRAIT_IDS,
  TRAIT_CATALOG,
  TRAIT_TIERS,
  TRAIT_TIER_COUNT,
} from './traits.js';

const BUILD_ONE_TRAIT_COUNT = 16;
const RESERVED_TRAIT_COUNT = 16;
const FORM_COUNT = 5;
const SNAKE_CASE_ID = /^[a-z]+(_[a-z]+)*$/;

/** The rows as consumers see them; the assignment itself pins that every `requires` id is a `TraitId`. */
const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
const catalogIds = catalog.map((trait) => trait.id);
const stageIndex = (stage: CellStage): number => STAGE_ORDER.indexOf(stage);
const traitById = (id: TraitId): TraitDefinition => catalog.find((trait) => trait.id === id)!;

describe('T10: the catalog', () => {
  it('has the sixteen build-1 traits with unique snake_case ids', () => {
    expect(catalog).toHaveLength(BUILD_ONE_TRAIT_COUNT);
    expect(new Set(catalogIds).size).toBe(BUILD_ONE_TRAIT_COUNT);
    for (const id of catalogIds) expect(id).toMatch(SNAKE_CASE_ID);
  });

  it.each(catalog)('$id has three tiers, a tag, a visual and an audio cue', (trait) => {
    expect(trait.tiers).toHaveLength(TRAIT_TIER_COUNT);
    expect(trait.tags.length).toBeGreaterThan(0);
    expect(trait.visual.length).toBeGreaterThan(0);
    expect(trait.audioCue).toMatch(SNAKE_CASE_ID);
  });

  it('keeps the reserved §4 ids out of the catalog', () => {
    expect(RESERVED_TRAIT_IDS).toHaveLength(RESERVED_TRAIT_COUNT);
    for (const id of RESERVED_TRAIT_IDS) expect(catalogIds).not.toContain(id);
  });

  it('requires only catalog traits of a stage no later than its own', () => {
    for (const trait of catalog) {
      for (const requiredId of trait.requires) {
        expect(catalogIds).toContain(requiredId);
        expect(stageIndex(traitById(requiredId).stage)).toBeLessThanOrEqual(stageIndex(trait.stage));
      }
    }
  });

  it('keys the tier tables by exactly the catalog ids and references them from the rows', () => {
    expect(Object.keys(TRAIT_TIERS).sort()).toEqual([...catalogIds].sort());
    for (const trait of catalog) expect(trait.tiers).toBe(TRAIT_TIERS[trait.id]);
  });

  it('uses only declared exclusion groups', () => {
    for (const trait of catalog) {
      if (trait.exclusionGroup !== undefined) expect(EXCLUSION_GROUPS).toContain(trait.exclusionGroup);
    }
  });
});

describe('T11: the ladder', () => {
  it('gates every stage after protocell with traits of the previous stage', () => {
    for (const [index, stage] of STAGE_ORDER.entries()) {
      const gates = STAGE_GATE_TRAITS[stage];
      if (index === 0) {
        expect(gates).toHaveLength(0);
        continue;
      }
      expect(gates.length).toBeGreaterThan(0);
      for (const gateId of gates) expect(traitById(gateId).stage).toBe(STAGE_ORDER[index - 1]);
    }
  });

  it('unlocks both endosymbionts by ENDOSYMBIOSIS_BACTERIA_REQUIRED bacteria of their variant', () => {
    for (const gateId of STAGE_GATE_TRAITS[CELL_STAGE.endosymbiosis]) {
      expect(traitById(gateId).unlockedBy?.count).toBe(ENDOSYMBIOSIS_BACTERIA_REQUIRED);
    }
    const otherTraits = catalog.filter((trait) => !STAGE_GATE_TRAITS.endosymbiosis.includes(trait.id));
    for (const trait of otherTraits) expect(trait.unlockedBy).toBeUndefined();
  });

  it('puts exactly the five forms in body_plan, and they are the specialised gates', () => {
    const forms = catalog.filter((trait) => trait.category === TRAIT_CATEGORY.form);
    const bodyPlan = catalog.filter((trait) => trait.exclusionGroup === EXCLUSION_GROUPS[0]);
    expect(forms).toHaveLength(FORM_COUNT);
    expect(bodyPlan.map((trait) => trait.id)).toEqual(forms.map((trait) => trait.id));
    expect([...STAGE_GATE_TRAITS[CELL_STAGE.specialised]].sort()).toEqual(forms.map((trait) => trait.id).sort());
  });
});

describe('DEFAULT_CELL_MODIFIERS', () => {
  it('is the identity: multipliers 1, everything else 0', () => {
    for (const [name, value] of Object.entries(DEFAULT_CELL_MODIFIERS)) {
      const isMultiplier = name.includes('Multiplier') && !name.includes('Bonus');
      expect(value, name).toBe(isMultiplier ? 1 : 0);
    }
  });

  it('names every modifier a tier table sets', () => {
    for (const tiers of Object.values(TRAIT_TIERS)) {
      for (const tier of tiers) {
        for (const name of Object.keys(tier)) expect(DEFAULT_CELL_MODIFIERS).toHaveProperty(name);
      }
    }
  });
});
