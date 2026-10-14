import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  CELL_STAGE,
  DNA_TAG,
  FOOD_KIND,
  GAME_ERA,
  GAME_ERA_ORDER,
  GIANT_SPECIES,
  GIANT_SPECIES_ORDER,
} from './game.js';
import {
  isBacteriumVariant,
  isCellStage,
  isDnaTag,
  isErasInPlayList,
  isFoodKind,
  isGameEra,
  isGiantSpecies,
  isPoolCreatureSpecies,
} from './game-guards.js';
import { POOL_CREATURE_SPECIES } from './pool.js';

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

  it('isPoolCreatureSpecies accepts every pool creature and nothing else: no giant, no food kind', () => {
    for (const species of Object.values(POOL_CREATURE_SPECIES))
      expect(isPoolCreatureSpecies(species), species).toBe(true);
    for (const stranger of STRANGERS) expect(isPoolCreatureSpecies(stranger), String(stranger)).toBe(false);
    expect(isPoolCreatureSpecies(GIANT_SPECIES.amoeba)).toBe(false);
    expect(isPoolCreatureSpecies(FOOD_KIND.greenSpeck)).toBe(false);
  });

  it('isCellStage accepts every stage and nothing else: no form name, no state', () => {
    for (const stage of Object.values(CELL_STAGE)) expect(isCellStage(stage), stage).toBe(true);
    for (const stranger of STRANGERS) expect(isCellStage(stranger), String(stranger)).toBe(false);
    expect(isCellStage('amoeba')).toBe(false);
    expect(isCellStage('Eukaryote')).toBe(false);
  });

  it('isGameEra accepts every era and nothing else, and the era order lists each era once, dish first', () => {
    for (const era of Object.values(GAME_ERA)) expect(isGameEra(era), era).toBe(true);
    for (const stranger of STRANGERS) expect(isGameEra(stranger), String(stranger)).toBe(false);
    expect(isGameEra('Pool')).toBe(false);
    expect(GAME_ERA_ORDER).toEqual([GAME_ERA.dish, GAME_ERA.pool, GAME_ERA.colonies]);
  });

  it('isErasInPlayList accepts every non-empty prefix of the era order (phases.md §14.2.4)', () => {
    for (let length = 1; length <= GAME_ERA_ORDER.length; length += 1) {
      const prefix = GAME_ERA_ORDER.slice(0, length);
      expect(isErasInPlayList(prefix), prefix.join()).toBe(true);
    }
  });

  it.each<[string, unknown]>([
    ['the empty list', []],
    ['a list without the dish', [GAME_ERA.pool]],
    ['a list that skips the pool', [GAME_ERA.dish, GAME_ERA.colonies]],
    ['the eras out of order', [GAME_ERA.pool, GAME_ERA.dish]],
    ['an era twice', [GAME_ERA.dish, GAME_ERA.dish]],
    ['a list past the last era', [...GAME_ERA_ORDER, GAME_ERA.colonies]],
    ['a list of numbers', [0, 1]],
    ['an era that is not a list', GAME_ERA.dish],
    ['a record', { 0: GAME_ERA.dish }],
  ])('isErasInPlayList refuses %s', (_label, value) => {
    expect(isErasInPlayList(value)).toBe(false);
  });
});
