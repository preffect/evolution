// docs/game-design/phases.md §14.5.2 (ticket #870): in the rock pool the light patch is the one sunlit zone, and it
// circles the pool once per `POOL_LIGHT_PATCH_PERIOD_SECONDS`. A chloroplast cell pinned in the pool gains light on
// exactly the ticks the moving patch covers it, and on no other: through one whole turn, so the patch both covers it
// and leaves it whatever orbit the seed draws.
//
// Run twice and hash-compared, so the layout drawn at the move, the swarms and the light reproduce.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GAME_ERA,
  distanceBetween,
  lightPatchCentreAt,
  secondsToTicks,
  type GameEra,
} from '@evolution/shared';
import { jumpToThePool } from '../gameplay/evolution-adapter.js';
import { cellOf, massFlowOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { ZONE } from '../gameplay/index.js';
import { COLONIES_ON_ROUND_SECONDS } from '../world-builders.js';
import { placedSolo } from './shared-setups.js';

const { growth, pool } = DEFAULT_BALANCE;
/** The pool's move on tick 10 (a `debug_set_era` jump), the cell pinned in the pool from the tick after. */
const MOVE_TICK = 10;
const PIN_TICK = MOVE_TICK + 1;
/** One whole turn of the patch after the pin. */
const TURN_TICKS = secondsToTicks(pool.POOL_LIGHT_PATCH_PERIOD_SECONDS);
/** The light is checked once a second through the turn. */
const SAMPLE_EVERY_TICKS = secondsToTicks(1);
/**
 * 1 400 wu due east of the centre: the drawn orbit lies between 925 and 1 850 wu out (half the longest to the longest,
 * inside the bank), so once a turn the patch's 900 wu disc passes over this point and leaves it again.
 */
const PINNED_POINT = { x: 1400, y: 0 };

/** True when the light patch covers the player's cell on the view's tick, by the snapshot's own layout. */
function isUnderThePatch(view: EvolutionView): boolean | undefined {
  const cell = cellOf(view, 0);
  const layout = view.snapshot.poolLayout;
  if (cell === undefined || layout === null) return undefined;
  const centre = lightPatchCentreAt(layout.lightPatchOrbit, view.tick, DEFAULT_BALANCE);
  return distanceBetween(cell, centre) <= pool.POOL_LIGHT_PATCH_RADIUS;
}

function gainsLight(view: EvolutionView): boolean {
  return (massFlowOf(view, 0)?.ratesPerSecond.light ?? 0) > 0;
}

describe('game-design/phases.md §14.5.2: the light patch is the pool’s sunlit zone', () => {
  it('a chloroplast cell gains light only on the ticks the moving patch covers it, through one whole turn', async () => {
    const lightOn: boolean[] = [];
    let row = placedSolo('the moving light patch')
      .config({ roundDurationSeconds: COLONIES_ON_ROUND_SECONDS })
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: ZONE.broth, traits: ['chloroplast'] })
      .atTick(MOVE_TICK)
      .place(jumpToThePool)
      .atTick(PIN_TICK)
      .placeCell({
        playerIndex: 0,
        mass: growth.CELL_STARTING_MASS,
        at: PINNED_POINT,
        isPinned: true,
        traits: ['chloroplast'],
      })
      .advance(PIN_TICK + TURN_TICKS)
      .expect('the world is in the pool', (view) => view.snapshot.era as GameEra)
      .atTick(PIN_TICK)
      .toBe(GAME_ERA.pool);
    for (let tick = PIN_TICK; tick <= PIN_TICK + TURN_TICKS; tick += SAMPLE_EVERY_TICKS) {
      row = row
        .expect(`light on tick ${tick} exactly when the patch covers the cell`, (view) => {
          const isLit = isUnderThePatch(view);
          lightOn.push(gainsLight(view));
          return isLit === undefined ? undefined : isLit === gainsLight(view);
        })
        .atTick(tick)
        .toBe(true);
    }
    await row.runDeterministic();
    expect(lightOn.some((isOn) => isOn)).toBe(true);
    expect(lightOn.some((isOn) => !isOn)).toBe(true);
  });
});
