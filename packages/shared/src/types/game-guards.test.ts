import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, DNA_TAG, FOOD_KIND } from './game.js';
import { isBacteriumVariant, isDnaTag, isFoodKind } from './game-guards.js';

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
});
