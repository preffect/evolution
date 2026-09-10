// The id tables (docs/CODE-STANDARDS.md §2, §6): keys camelCase, values unique snake_case.

import { describe, expect, it } from 'vitest';
import { EFFECT_KIND } from './effects.js';
import {
  BACTERIUM_VARIANT,
  CELL_STAGE,
  CELL_STATE,
  DNA_TAG,
  ENTITY_KIND,
  FOOD_KIND,
  GAME_MODE,
  PLAYER_LIFE_STATE,
  ROUND_END_CONDITION,
  ROUND_PHASE,
  ZONE_ID,
} from './game.js';
import { TRAIT_CATEGORY, TRAIT_RARITY } from './traits.js';

const SNAKE_CASE_VALUE = /^[a-z]+(_[a-z]+)*$/;
const CAMEL_CASE_KEY = /^[a-z][a-zA-Z]*$/;

const ID_TABLES: [string, Record<string, string>][] = [
  ['GAME_MODE', GAME_MODE],
  ['ROUND_END_CONDITION', ROUND_END_CONDITION],
  ['ROUND_PHASE', ROUND_PHASE],
  ['FOOD_KIND', FOOD_KIND],
  ['BACTERIUM_VARIANT', BACTERIUM_VARIANT],
  ['DNA_TAG', DNA_TAG],
  ['ZONE_ID', ZONE_ID],
  ['CELL_STATE', CELL_STATE],
  ['CELL_STAGE', CELL_STAGE],
  ['PLAYER_LIFE_STATE', PLAYER_LIFE_STATE],
  ['ENTITY_KIND', ENTITY_KIND],
  ['EFFECT_KIND', EFFECT_KIND],
  ['TRAIT_CATEGORY', TRAIT_CATEGORY],
  ['TRAIT_RARITY', TRAIT_RARITY],
];

describe('id tables', () => {
  it.each(ID_TABLES)('%s has camelCase keys and unique snake_case values', (_name, table) => {
    const values = Object.values(table);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value).toMatch(SNAKE_CASE_VALUE);
    for (const key of Object.keys(table)) expect(key).toMatch(CAMEL_CASE_KEY);
  });

  it('prefixes entity ids by kind the way the debug tools filter them', () => {
    expect(Object.values(ENTITY_KIND)).toEqual(['cell', 'food_mote', 'dna_fragment']);
  });

  it('names effects in the past tense or as the moment they mark', () => {
    expect(Object.values(EFFECT_KIND)).toEqual(['cell_absorbed', 'eat', 'level_up', 'respawn']);
  });
});
