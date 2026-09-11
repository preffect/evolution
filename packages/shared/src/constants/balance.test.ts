// docs/ARCHITECTURE.md §9: `data/balance.json` is generated from `DEFAULT_BALANCE` and pinned
// equal here, so a hand edit of the JSON (or a constant changed without regenerating) fails the gate.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type BalanceConfig } from './balance.js';
import { DISH_RADIUS } from './world.js';
import { ENGULF_MASS_RATIO } from './absorption.js';
import { TRAIT_TIERS } from './traits.js';

const BALANCE_FILE = new URL('../../../../data/balance.json', import.meta.url);
const GENERATE_COMMAND = 'pnpm generate:balance';

const EXPECTED_DOMAINS = [
  'world',
  'session',
  'worldClock',
  'controls',
  'ladder',
  'ecology',
  'growth',
  'wildCells',
  'absorption',
  'progression',
  'traits',
];

describe('DEFAULT_BALANCE', () => {
  it('has exactly the tunable domains of ARCHITECTURE §9, in order', () => {
    expect(Object.keys(DEFAULT_BALANCE)).toEqual(EXPECTED_DOMAINS);
  });

  it('mirrors the domain constants', () => {
    expect(DEFAULT_BALANCE.world.DISH_RADIUS).toBe(DISH_RADIUS);
    expect(DEFAULT_BALANCE.absorption.ENGULF_MASS_RATIO).toBe(ENGULF_MASS_RATIO);
    expect(DEFAULT_BALANCE.traits.TRAIT_TIERS).toBe(TRAIT_TIERS);
  });

  it('is a plain record, not a module namespace, so it clones and compares like its JSON', () => {
    expect(Object.prototype.toString.call(DEFAULT_BALANCE.world)).toBe('[object Object]');
    expect(structuredClone(DEFAULT_BALANCE)).toEqual(DEFAULT_BALANCE);
  });

  it('is deep-frozen: a room that patches without cloning throws instead of rewriting every room', () => {
    expect(Object.isFrozen(DEFAULT_BALANCE)).toBe(true);
    expect(Object.isFrozen(DEFAULT_BALANCE.traits.TRAIT_CATALOG[0]?.tiers[0])).toBe(true);
    expect(() => {
      DEFAULT_BALANCE.world.DISH_RADIUS = DISH_RADIUS + 1;
    }).toThrow(TypeError);
    expect(DEFAULT_BALANCE.world.DISH_RADIUS).toBe(DISH_RADIUS);
  });

  it('types number leaves as patchable numbers, never as their literal defaults', () => {
    const patched: BalanceConfig = structuredClone(DEFAULT_BALANCE);
    patched.world.DISH_RADIUS = DISH_RADIUS + 1;
    expect(patched.world.DISH_RADIUS).not.toBe(DEFAULT_BALANCE.world.DISH_RADIUS);
  });

  it(`equals data/balance.json (regenerate with \`${GENERATE_COMMAND}\`)`, () => {
    const generated: unknown = JSON.parse(readFileSync(BALANCE_FILE, 'utf8'));
    expect(generated).toEqual(JSON.parse(JSON.stringify(DEFAULT_BALANCE)));
  });
});
