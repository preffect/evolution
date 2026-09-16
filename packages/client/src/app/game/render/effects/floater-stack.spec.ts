import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { createTestCellAbsorbedEffect, createTestEatEffect } from '../../../../testing/builders';
import { CUE_RIM } from '../../hud/format/mass-cues';
import {
  CUE_GAP_PX,
  CUE_PILL_HEIGHT_PX,
  CUE_ROW_GAP_PX,
  FLOATER_FADE_FRACTION,
  FLOATER_LIFETIME_MS,
  FLOATER_MAX_VISIBLE,
  FLOATER_MERGE_MS,
  FLOATER_RISE_PX,
} from '../constants';
import { FLOATER_CAUSE, FloaterStack, floaterAlpha, floaterSpawnsOf } from './floater-stack';

const OWN = entityId('own');
const OTHER = entityId('other');
const LEFT_PX = 40;

describe('floaterSpawnsOf', () => {
  it("turns the own cell's eats and engulf payouts into floaters and ignores every other cell's", () => {
    const effects = [
      createTestEatEffect({ cellId: OWN, massGained: 3, dnaGained: 0 }),
      createTestEatEffect({ cellId: OWN, massGained: 0, dnaGained: 5 }),
      createTestEatEffect({ cellId: OTHER, massGained: 9, dnaGained: 9 }),
      createTestCellAbsorbedEffect({
        cellId: OTHER,
        predatorCellId: OWN,
        predatorMassGained: 60,
        predatorDnaGained: 4,
      }),
    ];
    expect(floaterSpawnsOf(effects, OWN)).toEqual([
      { cause: FLOATER_CAUSE.food, amount: 3 },
      { cause: FLOATER_CAUSE.dna, amount: 5 },
      { cause: FLOATER_CAUSE.engulf, amount: 60 },
      { cause: FLOATER_CAUSE.dna, amount: 4 },
    ]);
  });
});

describe('floaterAlpha', () => {
  it('holds opaque until the last FLOATER_FADE_FRACTION of the lifetime, then fades to nothing', () => {
    const fadeStartMs = FLOATER_LIFETIME_MS * (1 - FLOATER_FADE_FRACTION);
    expect(floaterAlpha(0)).toBe(1);
    expect(floaterAlpha(fadeStartMs - 1)).toBe(1);
    expect(floaterAlpha((fadeStartMs + FLOATER_LIFETIME_MS) / 2)).toBeCloseTo(0.5);
    expect(floaterAlpha(FLOATER_LIFETIME_MS)).toBe(0);
  });
});

describe('FloaterStack', () => {
  it('rises FLOATER_RISE_PX over the lifetime from CUE_GAP_PX above the 3 o’clock line, then leaves', () => {
    const stack = new FloaterStack();
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, 0, LEFT_PX);
    expect(stack.placements(0)[0]).toMatchObject({
      amountText: '+3',
      causeLabel: 'Food',
      rim: CUE_RIM.gain,
      leftPx: LEFT_PX,
      bottomPx: -CUE_GAP_PX,
    });
    expect(stack.placements(FLOATER_LIFETIME_MS / 2)[0]?.bottomPx).toBeCloseTo(-CUE_GAP_PX - FLOATER_RISE_PX / 2);
    expect(stack.placements(FLOATER_LIFETIME_MS)).toEqual([]);
  });

  it('merges the same cause within FLOATER_MERGE_MS into the youngest, and not after it', () => {
    const stack = new FloaterStack();
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, 0, LEFT_PX);
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, FLOATER_MERGE_MS - 1, LEFT_PX);
    expect(stack.placements(FLOATER_MERGE_MS - 1).map((floater) => floater.amountText)).toEqual(['+6']);
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, FLOATER_MERGE_MS, LEFT_PX);
    expect(stack.count).toBe(2);
  });

  it('pushes the live floaters up one row for a new one, and keeps each one’s x from its spawn', () => {
    const stack = new FloaterStack();
    stack.spawn({ cause: FLOATER_CAUSE.engulf, amount: 60 }, 0, LEFT_PX);
    stack.spawn({ cause: FLOATER_CAUSE.sprint, amount: -16 }, 0, LEFT_PX + 50);
    const [older, newer] = stack.placements(0);
    expect(older).toMatchObject({ leftPx: LEFT_PX, bottomPx: -CUE_GAP_PX - (CUE_PILL_HEIGHT_PX + CUE_ROW_GAP_PX) });
    expect(newer).toMatchObject({ leftPx: LEFT_PX + 50, bottomPx: -CUE_GAP_PX, amountText: '−16', rim: CUE_RIM.none });
  });

  it(`keeps at most ${FLOATER_MAX_VISIBLE}: the oldest leaves early`, () => {
    const stack = new FloaterStack();
    const causes = [
      FLOATER_CAUSE.food,
      FLOATER_CAUSE.dna,
      FLOATER_CAUSE.engulf,
      FLOATER_CAUSE.sprint,
      FLOATER_CAUSE.food,
    ];
    causes.forEach((cause, index) => stack.spawn({ cause, amount: index + 1 }, index * FLOATER_MERGE_MS, LEFT_PX));
    // Read at the last spawn: every floater is still inside its lifetime, so only the cap can have removed one.
    const shown = stack.placements((causes.length - 1) * FLOATER_MERGE_MS);
    expect(shown).toHaveLength(FLOATER_MAX_VISIBLE);
    expect(shown[0]?.amountText).toBe('+2');
  });

  it('clears everything for a new own cell', () => {
    const stack = new FloaterStack();
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, 0, LEFT_PX);
    stack.clear();
    expect(stack.placements(0)).toEqual([]);
  });
});
