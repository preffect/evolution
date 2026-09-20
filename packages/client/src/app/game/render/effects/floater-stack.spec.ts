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

  it('adds a later pickup of the same cause to the floater on screen, and starts a new one once it has left', () => {
    const stack = new FloaterStack();
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, 0, LEFT_PX);
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, FLOATER_LIFETIME_MS - 1, LEFT_PX);
    // One pill, not two: the whole lifetime merges, not just the first moments of it.
    expect(stack.placements(FLOATER_LIFETIME_MS - 1).map((floater) => floater.amountText)).toEqual(['+6']);
    // The first has left by now, so this one is the next floater rather than a third helping of the same.
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, FLOATER_LIFETIME_MS, LEFT_PX);
    expect(stack.placements(FLOATER_LIFETIME_MS).map((floater) => floater.amountText)).toEqual(['+3']);
  });

  it('keeps the clock and the x of the first pickup when it merges: no reset, no sideways snap (#443)', () => {
    const stack = new FloaterStack();
    const halfWay = FLOATER_LIFETIME_MS / 2;
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, 0, LEFT_PX);
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, halfWay, LEFT_PX + 50);
    const merged = stack.placements(halfWay)[0];
    expect(merged?.leftPx, 'a merge must not move the pill to the new column start').toBe(LEFT_PX);
    // Its rise and its alpha are its ORIGINAL age's: a restarted clock would put both back to a newborn's.
    expect(merged, 'a merge must not restart the rise or the fade').toMatchObject({
      bottomPx: -CUE_GAP_PX - FLOATER_RISE_PX / 2,
      alpha: floaterAlpha(halfWay),
    });
    // And it leaves on the first pickup's schedule: a reset would have kept it up until halfWay + the lifetime.
    expect(stack.placements(FLOATER_LIFETIME_MS)).toEqual([]);
  });

  it('pushes the live floaters up one row for a new one, and keeps each one’s x from its spawn', () => {
    const stack = new FloaterStack();
    stack.spawn({ cause: FLOATER_CAUSE.engulf, amount: 60 }, 0, LEFT_PX);
    stack.spawn({ cause: FLOATER_CAUSE.sprint, amount: -16 }, 0, LEFT_PX + 50);
    const [older, newer] = stack.placements(0);
    expect(older).toMatchObject({ leftPx: LEFT_PX, bottomPx: -CUE_GAP_PX - (CUE_PILL_HEIGHT_PX + CUE_ROW_GAP_PX) });
    expect(newer).toMatchObject({ leftPx: LEFT_PX + 50, bottomPx: -CUE_GAP_PX, amountText: '−16', rim: CUE_RIM.none });
  });

  it(`holds one floater per cause, so the column cannot exceed ${FLOATER_MAX_VISIBLE} rows`, () => {
    const causes = Object.values(FLOATER_CAUSE);
    // The cap is structural since #443, and only while there are no more causes than rows the column may hold.
    expect(causes.length).toBeLessThanOrEqual(FLOATER_MAX_VISIBLE);
    const stack = new FloaterStack();
    const spawnRound = (round: number) =>
      causes.forEach((cause) => stack.spawn({ cause, amount: 1 }, round, LEFT_PX + round));
    spawnRound(0);
    spawnRound(1);
    spawnRound(2);
    const shown = stack.placements(2);
    expect(shown.map((floater) => floater.cause)).toEqual(causes);
    // Each cause's three pickups landed on its one floater, so nothing was dropped to keep the column short.
    expect(shown.map((floater) => floater.amountText)).toEqual(causes.map(() => '+3'));
  });

  it('clears everything for a new own cell', () => {
    const stack = new FloaterStack();
    stack.spawn({ cause: FLOATER_CAUSE.food, amount: 3 }, 0, LEFT_PX);
    stack.clear();
    expect(stack.placements(0)).toEqual([]);
  });
});
