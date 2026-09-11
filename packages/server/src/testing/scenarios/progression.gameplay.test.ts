// docs/PROGRESSION.md §7: the DNA, level, draft and entry rows that need no engulf, each run twice
// and hash-compared. P5 and P11 (an absorption) wait for the engulf slice of #98. The pure rows
// are pinned beside their functions: P4, P9, P12 and P14 in game/progression/draft.test.ts, P13 in
// game/progression/ladder.test.ts.

import { describe, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, DNA_TAG, TICK_HZ, type TraitId } from '@evolution/shared';
import { createGrazerStrategy } from '../../game/bots/strategies/grazer.js';
import {
  PLACED_ROW_SEED,
  TABLE_SEED,
  evolutionAdapter,
  evolutionScenario as scenario,
} from '../gameplay/evolution-adapter.js';
import { cellOf, massOf, progressOf } from '../gameplay/evolution-views.js';
import { chooseTrait, insideCellOf, player } from '../gameplay/index.js';
import { MASS_TOLERANCE, P7_JOIN_TICK, decayed, p7Setup, placedSolo } from './shared-setups.js';

const { growth, ecology, progression } = DEFAULT_BALANCE;
const LEVEL_2_DNA = 60;
const LEVEL_3_DNA = 140;
const LEVEL_12_DNA = 1760;
const PROTOCELL_PICKS: readonly TraitId[] = ['nucleoid', 'simple_flagellum', 'cell_wall'];
/** "Greedy bot, re-evaluated every 30 ticks." */
const GREEDY_BOT_DECISION_TICKS = 30;
const SIX_MINUTES_TICKS = 6 * 60 * TICK_HZ;
const TIMEOUT_TICKS = progression.TRAIT_CHOICE_TIMEOUT_SECONDS * TICK_HZ;
/** P6's pick lands on tick 5; the stale repeat two ticks later. */
const P6_PICK_TICK = 5;
/** P8: a join inside the 30 s grace. */
const P8_JOIN_TICK = 600;

/** P2's world: the seeded cell fed twelve `sensory` fragments, one per tick. */
function p2Setup(name: string) {
  const fragments = LEVEL_2_DNA / ecology.DNA_FRAGMENT_DNA;
  const run = placedSolo(name);
  for (let tick = 1; tick <= fragments; tick += 1) {
    run.atTick(tick).placeFragment({ tag: DNA_TAG.sensory, at: insideCellOf(0) });
  }
  return { run, levelTick: fragments };
}

describe('PROGRESSION §7: levels and offers', () => {
  it('P1: a greedy bot reaches level 2 inside six minutes of the seeded world', () => {
    scenario('P1')
      .seed(TABLE_SEED)
      .players(1)
      .bot(0, createGrazerStrategy(evolutionAdapter.perception), GREEDY_BOT_DECISION_TICKS)
      .advance(SIX_MINUTES_TICKS)
      .expect('level', (view) => progressOf(view, 0)?.level)
      .atEnd()
      .toBeAtLeast(2)
      .runDeterministic();
  });

  it('P2: the twelfth fragment reaches level 2 and shows the protocell draft', () => {
    const { run, levelTick } = p2Setup('P2');
    run
      .advance(levelTick)
      .expect('level before', (view) => progressOf(view, 0)?.level)
      .atTick(levelTick - 1)
      .toBe(1)
      .expect('toward next level before', (view) => progressOf(view, 0)?.dnaTowardNextLevel)
      .atTick(levelTick - 1)
      .toBe(LEVEL_2_DNA - ecology.DNA_FRAGMENT_DNA)
      .expect('no offer before', (view) => progressOf(view, 0)?.offer)
      .atTick(levelTick - 1)
      .toBeNull()
      .expect('dna', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(levelTick)
      .toBe(LEVEL_2_DNA)
      .expect('level', (view) => progressOf(view, 0)?.level)
      .atTick(levelTick)
      .toBe(2)
      .expect('toward next level', (view) => progressOf(view, 0)?.dnaTowardNextLevel)
      .atTick(levelTick)
      .toBe(0)
      .expect('offer id', (view) => progressOf(view, 0)?.offer?.offerId)
      .atTick(levelTick)
      .toBe(1)
      .expect('the three protocell picks', (view) =>
        progressOf(view, 0)
          ?.offer?.cards.map((card) => card.traitId)
          .sort(),
      )
      .atTick(levelTick)
      .toEqual([...PROTOCELL_PICKS].sort())
      .runDeterministic();
  });

  it('P3: an offer left alone times out on the tick its count reaches the timeout, picking the heaviest card', () => {
    const { run, levelTick } = p2Setup('P3');
    const closeTick = levelTick + TIMEOUT_TICKS;
    run
      .advance(closeTick)
      .expect('still open the tick before', (view) => progressOf(view, 0)?.offer?.offerId)
      .atTick(closeTick - 1)
      .toBe(1)
      .expect('closed', (view) => progressOf(view, 0)?.offer)
      .atTick(closeTick)
      .toBeNull()
      .expect('nucleoid I owned', (view) => cellOf(view, 0)?.traits)
      .atTick(closeTick)
      .toEqual([{ traitId: 'nucleoid', tier: 1 }])
      .expect('stage', (view) => cellOf(view, 0)?.stage)
      .atTick(closeTick)
      .toBe(CELL_STAGE.prokaryote)
      .runDeterministic();
  });

  it('P6: a 140-DNA gain queues two drafts; a pick shows the next one and a stale pick is ignored', () => {
    const fragments = LEVEL_3_DNA / ecology.DNA_FRAGMENT_DNA;
    const run = placedSolo('P6');
    for (let fragment = 0; fragment < fragments; fragment += 1) {
      run.atTick(1).placeFragment({ tag: DNA_TAG.sensory, at: insideCellOf(0) });
    }
    run
      .atTick(P6_PICK_TICK, player(0).does(chooseTrait({ offerId: 1, cardIndex: 0 })))
      .atTick(P6_PICK_TICK + 2, player(0).does(chooseTrait({ offerId: 1, cardIndex: 1 })))
      .advance(P6_PICK_TICK + 2)
      .expect('level', (view) => progressOf(view, 0)?.level)
      .atTick(1)
      .toBe(3)
      .expect('toward next level', (view) => progressOf(view, 0)?.dnaTowardNextLevel)
      .atTick(1)
      .toBe(0)
      .expect('offer 1 shown', (view) => progressOf(view, 0)?.offer?.offerId)
      .atTick(1)
      .toBe(1)
      .expect('offer 1 applied', (view) => cellOf(view, 0)?.traits.length)
      .atTick(P6_PICK_TICK)
      .toBe(1)
      .expect('offer 2 shown with its own timer', (view) => progressOf(view, 0)?.offer)
      .atTick(P6_PICK_TICK + 1)
      .toSatisfy(
        (offer) => offer?.offerId === 2 && offer.expiresAtTick === P6_PICK_TICK + 1 + TIMEOUT_TICKS,
        'offer 2, expiring 600 ticks after tick 6',
      )
      .expect('a stale pick changes nothing', (view) => [
        progressOf(view, 0)?.offer?.offerId,
        cellOf(view, 0)?.traits.length,
      ])
      .atTick(P6_PICK_TICK + 2)
      .toEqual([2, 1])
      .runDeterministic();
  });

  it('P10: at the max level DNA keeps counting and no draft opens', () => {
    placedSolo('P10')
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, dnaCumulative: LEVEL_12_DNA })
      .atTick(1)
      .placeFragment({ tag: DNA_TAG.motile, at: insideCellOf(0) })
      .advance(1)
      .expect('dna', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(1)
      .toBe(LEVEL_12_DNA + ecology.DNA_FRAGMENT_DNA)
      .expect('level', (view) => progressOf(view, 0)?.level)
      .atTick(1)
      .toBe(progression.MAX_LEVEL)
      .expect('no offer', (view) => progressOf(view, 0)?.offer)
      .atTick(1)
      .toBeNull()
      .runDeterministic();
  });
});

describe('PROGRESSION §7: entering the dish', () => {
  it('P7: a joiner past the grace gets half the median DNA (a level-2 draft) and the capped entry mass', () => {
    p7Setup('P7')
      .advance(P7_JOIN_TICK)
      .expect('dna', (view) => progressOf(view, 2)?.dnaCumulative)
      .atTick(P7_JOIN_TICK)
      .toBe(LEVEL_2_DNA)
      .expect('gift', (view) => progressOf(view, 2)?.dnaCatchUpGift)
      .atTick(P7_JOIN_TICK)
      .toBe(LEVEL_2_DNA)
      .expect('level', (view) => progressOf(view, 2)?.level)
      .atTick(P7_JOIN_TICK)
      .toBe(2)
      .expect('toward next level', (view) => progressOf(view, 2)?.dnaTowardNextLevel)
      .atTick(P7_JOIN_TICK)
      .toBe(0)
      .expect('the protocell draft', (view) =>
        progressOf(view, 2)
          ?.offer?.cards.map((card) => card.traitId)
          .sort(),
      )
      .atTick(P7_JOIN_TICK)
      .toEqual([...PROTOCELL_PICKS].sort())
      .expect('mass', (view) => massOf(view, 2))
      .atTick(P7_JOIN_TICK)
      .toBeCloseTo(decayed(progression.ENTRY_MAX_MASS, 1), MASS_TOLERANCE)
      .expect('score', (view) => progressOf(view, 2)?.score)
      .atTick(P7_JOIN_TICK)
      .toBe(0)
      .runDeterministic();
  });

  it('P8: a joiner inside the grace starts fresh', () => {
    scenario('P8')
      .seed(PLACED_ROW_SEED)
      .players(2)
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, dnaCumulative: 120 })
      .placeCell({ playerIndex: 1, mass: growth.CELL_STARTING_MASS, dnaCumulative: 120, eastOfFirstCellWu: 700 })
      .playerJoinsAt(P8_JOIN_TICK)
      .advance(P8_JOIN_TICK)
      .expect('mass', (view) => massOf(view, 2))
      .atTick(P8_JOIN_TICK)
      .toBe(growth.CELL_STARTING_MASS)
      .expect('dna', (view) => progressOf(view, 2)?.dnaCumulative)
      .atTick(P8_JOIN_TICK)
      .toBe(0)
      .expect('level', (view) => progressOf(view, 2)?.level)
      .atTick(P8_JOIN_TICK)
      .toBe(1)
      .expect('no offer', (view) => progressOf(view, 2)?.offer)
      .atTick(P8_JOIN_TICK)
      .toBeNull()
      .runDeterministic();
  });
});
