// docs/ecology/acceptance.md §8.2, the giant hunter's window of slice 3 (giants.md §3.5.6, §3.5.17), each run twice
// and hash-compared: G3 (the hunt window gates the amoeba's chase, from tick 0 for a player) and G4 (it gates the
// chase, never the swallow; the grazer and the drifter swallow nothing). The fleeing rows are
// ecology-giant-flee.gameplay.test.ts, the diet's ecology-giant-diet.gameplay.test.ts. The placed rows run on seed 48
// (docs/testing/scenario-runner.md §8.1). G15 waits for ticket #819's kept grab.

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES, canEngulf, distanceBetween } from '@evolution/shared';
import { cellOf, giantCellOf, giantSeatOf, wildCellOf } from '../gameplay/evolution-views.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { placedSolo } from './shared-setups.js';
import {
  AMOEBA_DECISION_TICK,
  CENTRE_BEFORE_DECISION,
  eastOfBroth,
  giantAndA,
  giantCentre,
  giantTarget,
  isWanderTargetOf,
} from './giant-setups.js';
import { PLACED_SEAT } from './wild-setups.js';

const { absorption, growth } = DEFAULT_BALANCE;
const { amoeba: AMOEBA, paramecium: PARAMECIUM, diatom: DIATOM } = GIANT_SPECIES;
const ONE_TICK = 1;

/** G3: the amoeba born 1 200 at the broth point; A 600 wu east at 310 (in the window), 290, 959 or 961. */
const G3_AMOEBA = { species: AMOEBA, bornMass: 1200 };
const G3_PREY_EAST_WU = 600;
const G3_IN_WINDOW_MASS = 310;
const G3_UNDER_WINDOW_MASS = 290;
const G3_TOP_OF_WINDOW_MASS = 959;
const G3_PAST_WINDOW_MASS = 961;
/** G4: the amoeba born 1 000 and A at 240, 10 wu east: under the window, inside `canEngulf`. */
const G4_AMOEBA = { species: AMOEBA, bornMass: 1000 };
const G4_PREY_MASS = 240;
const G4_GAP_WU = 10;
const G4_PARAMECIUM_BORN_MASS = 1100;
const G4_DIATOM_BORN_MASS = 1200;
const G4_SEAT_SIZE = 10;
const G4_READ_TICK = 60;
const G4_SEAT_DECISION_TICK = 30;

describe('ecology/acceptance.md §8.2: the hunt window (G3)', () => {
  it('G3: A at 309.77 (≥ 300) is hunted on tick 24, its centre the target, no sprint, players prey from tick 0', async () => {
    await giantAndA('G3', G3_AMOEBA, { mass: G3_IN_WINDOW_MASS, eastWu: G3_PREY_EAST_WU })
      .advance(AMOEBA_DECISION_TICK)
      .expect('no hunt before its decision', (view) => giantSeatOf(view, AMOEBA)?.huntPreyId)
      .atTick(AMOEBA_DECISION_TICK - ONE_TICK)
      .toBeNull()
      .expect("huntPreyId = A's cell", (view) => giantSeatOf(view, AMOEBA)?.huntPreyId === cellOf(view, 0)?.id)
      .atTick(AMOEBA_DECISION_TICK)
      .toBe(true)
      .expect("its target = A's centre", giantTarget(AMOEBA))
      .atTick(AMOEBA_DECISION_TICK)
      .toEqual(eastOfBroth(G3_PREY_EAST_WU))
      .expect('no sprint (600 > 3 × 138.56)', (view) => giantCellOf(view, AMOEBA)?.sprintRemainingTicks)
      .atTick(AMOEBA_DECISION_TICK)
      .toBe(0)
      .runDeterministic();
  });

  it('G3 (A at 959): 1.25 × 958.25 ≤ 1 200, the top of the window, so hunted as the first', async () => {
    await giantAndA('G3 959', G3_AMOEBA, { mass: G3_TOP_OF_WINDOW_MASS, eastWu: G3_PREY_EAST_WU })
      .advance(AMOEBA_DECISION_TICK)
      .expect("huntPreyId = A's cell", (view) => giantSeatOf(view, AMOEBA)?.huntPreyId === cellOf(view, 0)?.id)
      .atTick(AMOEBA_DECISION_TICK)
      .toBe(true)
      .runDeterministic();
  });

  for (const [variant, preyMass] of [
    ['290: under the window, although a touch would swallow it', G3_UNDER_WINDOW_MASS],
    ['961: past what it can engulf, and no threat to it either', G3_PAST_WINDOW_MASS],
  ] as const) {
    it(`G3 (A at ${variant}): not a hunt target, nothing to flee or graze → a wander target`, async () => {
      await giantAndA(`G3 ${preyMass}`, G3_AMOEBA, { mass: preyMass, eastWu: G3_PREY_EAST_WU })
        .advance(AMOEBA_DECISION_TICK)
        .capture(CENTRE_BEFORE_DECISION, giantCentre(AMOEBA))
        .atTick(AMOEBA_DECISION_TICK - ONE_TICK)
        .expect('huntPreyId null', (view) => giantSeatOf(view, AMOEBA)?.huntPreyId)
        .atTick(AMOEBA_DECISION_TICK)
        .toBeNull()
        .expect('a wander target: 2 radii along its heading', isWanderTargetOf(AMOEBA))
        .atTick(AMOEBA_DECISION_TICK)
        .toBe(true)
        .runDeterministic();
    });
  }
});

describe('ecology/acceptance.md §8.2: not chased, but not safe to touch (G4)', () => {
  it('G4: A at 240 is under the window, yet the amoeba can engulf it and the engulf starts on tick 1', async () => {
    await giantAndA('G4', G4_AMOEBA, { mass: G4_PREY_MASS, eastWu: G4_GAP_WU })
      .advance(ONE_TICK)
      .expect('canEngulf(amoeba, A) on tick 0: the ring and the label are the truth', (view) => {
        const amoeba = giantCellOf(view, AMOEBA);
        const prey = cellOf(view, 0);
        return amoeba !== undefined && prey !== undefined && canEngulf(amoeba, prey, absorption);
      })
      .atTick(0)
      .toBe(true)
      .expect(
        "A's engulfedByCellId = the amoeba",
        (view) => cellOf(view, 0)?.engulfedByCellId === giantCellOf(view, AMOEBA)?.id,
      )
      .atTick(ONE_TICK)
      .toBe(true)
      .runDeterministic();
  });

  for (const [species, bornMass] of [
    [PARAMECIUM, G4_PARAMECIUM_BORN_MASS],
    [DIATOM, G4_DIATOM_BORN_MASS],
  ] as const) {
    it(`G4 (${species}): engulfs no cell in 60 ticks, seat 0 does not flee it, separation parts the pair`, async () => {
      await placedSolo(`G4 ${species}`)
        .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: { x: -BROTH_POINT.x, y: 0 } })
        .placeGiant({ species, bornMass, at: BROTH_POINT })
        .placeWildCell({ seat: PLACED_SEAT, sizeFactor: G4_SEAT_SIZE, at: eastOfBroth(G4_GAP_WU) })
        .advance(G4_READ_TICK)
        .expect('canEngulf(giant, seat 0) false', (view) => {
          const giant = giantCellOf(view, species);
          const seat = wildCellOf(view, PLACED_SEAT);
          return giant !== undefined && seat !== undefined && canEngulf(giant, seat, absorption);
        })
        .atTick(0)
        .toBe(false)
        .expect('seat 0 never engulfed', (view) => wildCellOf(view, PLACED_SEAT)?.engulfedByCellId)
        .atTick(G4_READ_TICK)
        .toBeNull()
        .expect(
          'seat 0 does not flee on tick 30 (a flee from a cell over it would sprint)',
          (view) => wildCellOf(view, PLACED_SEAT)?.sprintRemainingTicks,
        )
        .atTick(G4_SEAT_DECISION_TICK)
        .toBe(0)
        .expect('apart by separation alone', (view) => {
          const giant = giantCellOf(view, species);
          const seat = wildCellOf(view, PLACED_SEAT);
          return giant === undefined || seat === undefined ? undefined : distanceBetween(giant, seat);
        })
        .atTick(G4_READ_TICK)
        .toBeGreaterThan(G4_GAP_WU)
        .runDeterministic();
    });
  }
});
