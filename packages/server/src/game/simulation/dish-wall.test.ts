// docs/ecology/absorption.md §6.3 (#710): a centre moved or grown past `DISH_RADIUS − radius` goes back onto it, inward.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { keepInsideDish } from './dish-wall.js';

const { DISH_RADIUS } = DEFAULT_BALANCE.world;
const RADIUS = 40;
const REACH = DISH_RADIUS - RADIUS;
/** How far past its reach the outside body starts (wu). */
const PAST_REACH_WU = 12;

describe('keepInsideDish', () => {
  it('leaves a centre inside the reach untouched', () => {
    const body = { x: REACH / 2, y: -REACH / 3, radius: RADIUS };
    keepInsideDish(body, DISH_RADIUS);
    expect(body).toEqual({ x: REACH / 2, y: -REACH / 3, radius: RADIUS });
  });

  it('moves a centre past the reach radially inward onto it', () => {
    const past = REACH + PAST_REACH_WU;
    const body = { x: past * Math.SQRT1_2, y: -past * Math.SQRT1_2, radius: RADIUS };
    keepInsideDish(body, DISH_RADIUS);
    expect(Math.hypot(body.x, body.y)).toBeCloseTo(REACH, 9);
    expect(body.x).toBeCloseTo(-body.y, 9);
  });
});
