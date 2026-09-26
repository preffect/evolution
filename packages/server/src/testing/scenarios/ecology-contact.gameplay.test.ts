// docs/ecology/mass-and-movement.md §5.3 and docs/ecology/absorption.md §6.3 ("near-equal cells only push apart"): two
// protocells of equal mass charging head-on at full throttle never pass through each other (#709). One tick's closing
// is more than separation's fraction of the overlap can undo, so without the crossing rule of §5.3 the move carries
// the centres past each other and separation pushes the pair out on the far side.

import { describe, it } from 'vitest';
import { CELL_KIND, DEFAULT_BALANCE, TICK_HZ } from '@evolution/shared';
import {
  PLACED_ROW_SEED,
  evolutionScenario as scenario,
  type EvolutionScenarioSnapshot,
} from '../gameplay/evolution-adapter.js';
import { cellOf, distanceBetweenCells, type EvolutionView } from '../gameplay/evolution-views.js';
import { createScriptedStrategy, type PlayerScript } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { FULL_THROTTLE_RADII } from './shared-setups.js';

/** Two protocells of equal mass (ratio 1, under every engulf ratio), 100 wu apart on the broth line. */
const CHARGER_MASS = DEFAULT_BALANCE.growth.CELL_STARTING_MASS;
const CHARGER_GAP_WU = 100;
const COLLISION_TICKS = 3 * TICK_HZ;
/** The pair is symmetric: the midpoint of the centres never moves. */
const MIDPOINT_TOLERANCE_WU = 1e-6;

/** "Charges the other player": full throttle through the other player's centre, re-aimed every tick. */
const chargeTheOtherPlayer: PlayerScript<EvolutionScenarioSnapshot> = (context) => {
  const self = context.cell;
  const other = context.snapshot.cells.find(
    (cell) => cell.kind === CELL_KIND.player && cell.playerId !== context.actorId,
  );
  if (self === undefined || other === undefined) {
    return null;
  }
  const distance = Math.hypot(other.x - self.x, other.y - self.y);
  const reach = (FULL_THROTTLE_RADII * self.radius) / distance;
  return { targetX: self.x + (other.x - self.x) * reach, targetY: self.y + (other.y - self.y) * reach };
};

const createCharger = createScriptedStrategy('charger', chargeTheOtherPlayer);

/** How far B's centre lies east of A's: positive while A is still on its own (west) side. */
const eastwardGap = (view: EvolutionView): number => (cellOf(view, 1)?.x ?? 0) - (cellOf(view, 0)?.x ?? 0);

describe('ecology/mass-and-movement.md §5.3: two equal cells charging head-on (#709)', () => {
  it('never pass through each other: A stays west of B on every tick, in contact, midpoint held', async () => {
    const run = scenario('two chargers never cross')
      .seed(PLACED_ROW_SEED)
      .players(2)
      .placeCell({ playerIndex: 0, mass: CHARGER_MASS })
      .placeCell({ playerIndex: 1, mass: CHARGER_MASS, eastOfFirstCellWu: CHARGER_GAP_WU })
      .bot(0, createCharger)
      .bot(1, createCharger)
      .advance(COLLISION_TICKS);
    for (let tick = 1; tick <= COLLISION_TICKS; tick += 1) {
      run.expect(`A still west of B on tick ${tick}`, eastwardGap).atTick(tick).toBeGreaterThan(0);
    }
    await run
      .expect('they are in contact', (view) => {
        const west = cellOf(view, 0);
        const east = cellOf(view, 1);
        return (west?.radius ?? 0) + (east?.radius ?? 0) - (distanceBetweenCells(view, 0, 1) ?? Infinity);
      })
      .atEnd()
      .toBeGreaterThan(0)
      .expect('the midpoint never moved', (view) => ((cellOf(view, 0)?.x ?? 0) + (cellOf(view, 1)?.x ?? 0)) / 2)
      .atEnd()
      .toBeCloseTo(BROTH_POINT.x + CHARGER_GAP_WU / 2, MIDPOINT_TOLERANCE_WU)
      .runDeterministic();
  });
});
