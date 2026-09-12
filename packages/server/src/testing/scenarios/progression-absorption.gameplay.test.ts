// docs/PROGRESSION.md §7, the two rows an absorption drives (#259): P5, where the payout's DNA
// levels the predator up, and P11, where the prey's shown offer survives its death and respawn.
// The rest of the table is progression.gameplay.test.ts; the engulf setup is engulf-setups.ts.

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE, DNA_TAG, PLAYER_LIFE_STATE, TICK_HZ } from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { progressOf } from '../gameplay/evolution-views.js';
import { eastOfCellOf, insideCellOf } from '../gameplay/index.js';
import { E9_PAYOUT_DNA, E9_PAYOUT_TICK, PREDATOR_MASS, engulfPair } from './engulf-setups.js';

const { growth, ecology, progression, session } = DEFAULT_BALANCE;
const LEVEL_2_DNA = 60;
const TIMEOUT_TICKS = progression.TRAIT_CHOICE_TIMEOUT_SECONDS * TICK_HZ;
/** P5: "A given `dnaCumulative` = `dnaTowardNextLevel` = 40 at setup", 20 short of level 2. */
const P5_BANKED_DNA = 40;
/** P11: A is far away while B eats its fragments, then the fixture drops it beside B on tick 2. */
const P11_PREDATOR_MASS = PREDATOR_MASS;
const P11_APART_WU = 700;
const P11_CENTRE_DISTANCE_WU = 10;
const P11_CLOSE_TICK = 2;
/** The engulf starts on the tick the fixture lands and runs E9's 36 ticks. */
const P11_PAYOUT_TICK = P11_CLOSE_TICK + E9_PAYOUT_TICK - 1;
/** The respawn convention (#211): payout + spectate + 1. */
const P11_RESPAWN_TICK = P11_PAYOUT_TICK + session.RESPAWN_SPECTATE_SECONDS * TICK_HZ + 1;

describe('PROGRESSION §7: what an absorption does to the progression', () => {
  it('P5: the absorption DNA levels the predator up and opens exactly one draft', () => {
    engulfPair('P5', PREDATOR_MASS, undefined, P5_BANKED_DNA)
      .advance(E9_PAYOUT_TICK + 1)
      .expect('banked DNA before the payout', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(E9_PAYOUT_TICK - 1)
      .toBe(P5_BANKED_DNA)
      .expect('dna after the payout', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(E9_PAYOUT_TICK)
      .toBe(P5_BANKED_DNA + E9_PAYOUT_DNA)
      .expect('level 2', (view) => progressOf(view, 0)?.level)
      .atTick(E9_PAYOUT_TICK)
      .toBe(2)
      .expect('toward the next level', (view) => progressOf(view, 0)?.dnaTowardNextLevel)
      .atTick(E9_PAYOUT_TICK)
      .toBe(P5_BANKED_DNA + E9_PAYOUT_DNA - LEVEL_2_DNA)
      .expect('exactly one offer, opened on the payout tick', (view) => progressOf(view, 0)?.offer?.offerId)
      .atEnd()
      .toBe(1)
      .runDeterministic();

    engulfPair('P5 without the banked DNA')
      .advance(E9_PAYOUT_TICK)
      .expect('dna', (view) => progressOf(view, 0)?.dnaCumulative)
      .atEnd()
      .toBe(E9_PAYOUT_DNA)
      .expect('still level 1', (view) => progressOf(view, 0)?.level)
      .atEnd()
      .toBe(1)
      .expect('no offer', (view) => progressOf(view, 0)?.offer)
      .atEnd()
      .toBeNull()
      .runDeterministic();
  });

  it('P11: a prey absorbed with an offer shown still has it when it respawns', () => {
    // B is placed first and alone, so the fragments inside it are B's: a cell sitting inside a
    // predator's radius would have them eaten by the predator, which eats first (docs/ECOLOGY.md §1).
    const fragments = LEVEL_2_DNA / ecology.DNA_FRAGMENT_DNA;
    const run = scenario('P11')
      .seed(PLACED_ROW_SEED)
      .players(2)
      .placeCell({ playerIndex: 1, mass: growth.CELL_STARTING_MASS })
      .placeCell({ playerIndex: 0, mass: P11_PREDATOR_MASS, eastOfFirstCellWu: P11_APART_WU });
    for (let fragment = 0; fragment < fragments; fragment += 1) {
      run.atTick(1).placeFragment({ tag: DNA_TAG.sensory, at: insideCellOf(1) });
    }
    run
      .atTick(P11_CLOSE_TICK)
      .placeCell({ playerIndex: 0, mass: P11_PREDATOR_MASS, at: eastOfCellOf(1, P11_CENTRE_DISTANCE_WU) })
      .advance(P11_RESPAWN_TICK + 1)
      .expect("B's offer is shown before it is eaten", (view) => progressOf(view, 1)?.offer?.offerId)
      .atTick(P11_PAYOUT_TICK - 1)
      .toBe(1)
      .expect('B is absorbed and spectating', (view) => progressOf(view, 1)?.lifeState)
      .atTick(P11_PAYOUT_TICK)
      .toBe(PLAYER_LIFE_STATE.spectating)
      .expect('the offer is still shown the tick B died', (view) => progressOf(view, 1)?.offer?.offerId)
      .atTick(P11_PAYOUT_TICK)
      .toBe(1)
      .expect('B is alive again one tick after the respawn', (view) => progressOf(view, 1)?.lifeState)
      .atEnd()
      .toBe(PLAYER_LIFE_STATE.alive)
      .expect(
        'the same offer, its timer having kept counting through the spectate',
        (view) => progressOf(view, 1)?.offer?.offerId,
      )
      .atEnd()
      .toBe(1)
      .expect('the offer has not expired', (view) => progressOf(view, 1)?.offer?.expiresAtTick)
      .atEnd()
      .toBe(1 + TIMEOUT_TICKS)
      .runDeterministic();
  });
});
