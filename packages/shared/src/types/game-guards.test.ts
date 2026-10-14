import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, CELL_STAGE, DNA_TAG, FOOD_KIND, GIANT_SPECIES, GIANT_SPECIES_ORDER } from './game.js';
import { isBacteriumVariant, isCellStage, isDnaTag, isFoodKind, isGiantSpecies } from './game-guards.js';

const STRANGERS: readonly unknown[] = ['spicy', '', 'Algae', 0, null, undefined, {}, ['algae']];

describe('game guards', () => {
  it('isFoodKind accepts every food kind and nothing else', () => {
    for (const kind of Object.values(FOOD_KIND)) expect(isFoodKind(kind), kind).toBe(true);
    for (const stranger of STRANGERS) expect(isFoodKind(stranger), String(stranger)).toBe(false);
    expect(isFoodKind(BACTERIUM_VARIANT.plain)).toBe(false);
  });

  it('isBacteriumVariant accepts every variant and nothing else', () => {
    for (const variant of Object.values(BACTERIUM_VARIANT)) expect(isBacteriumVariant(variant), variant).toBe(true);
    for (const stranger of STRANGERS) expect(isBacteriumVariant(stranger), String(stranger)).toBe(false);
    expect(isBacteriumVariant(FOOD_KIND.bacterium)).toBe(false);
  });

  it('isDnaTag accepts every tag and nothing else', () => {
    for (const tag of Object.values(DNA_TAG)) expect(isDnaTag(tag), tag).toBe(true);
    for (const stranger of STRANGERS) expect(isDnaTag(stranger), String(stranger)).toBe(false);
    expect(isDnaTag(FOOD_KIND.algae)).toBe(false);
  });

  it('isGiantSpecies accepts every species and nothing else, and the seat order lists each species once', () => {
    for (const species of Object.values(GIANT_SPECIES)) expect(isGiantSpecies(species), species).toBe(true);
    for (const stranger of STRANGERS) expect(isGiantSpecies(stranger), String(stranger)).toBe(false);
    expect(isGiantSpecies('amoeba')).toBe(false);
    expect([...GIANT_SPECIES_ORDER].sort()).toEqual(Object.values(GIANT_SPECIES).sort());
    expect(GIANT_SPECIES_ORDER).toEqual([GIANT_SPECIES.amoeba, GIANT_SPECIES.paramecium, GIANT_SPECIES.diatom]);
  });

  it('isCellStage accepts every stage and nothing else: no form name, no state', () => {
    for (const stage of Object.values(CELL_STAGE)) expect(isCellStage(stage), stage).toBe(true);
    for (const stranger of STRANGERS) expect(isCellStage(stranger), String(stranger)).toBe(false);
    expect(isCellStage('amoeba')).toBe(false);
    expect(isCellStage('Eukaryote')).toBe(false);
  });
});
