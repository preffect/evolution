// The leaderboard order (#198): docs/game-design/session.md §5.3 defines the score
// (`dnaCumulative − dnaCatchUpGift + SCORE_ABSORPTION_BONUS × absorptions`, PROGRESSION §1) and
// docs/determinism/ordering-and-state-hash.md §4 the comparator: score, then current mass, then join order.
// The absorption bonus on the row is G8's (game-design-session.gameplay.test.ts).

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DNA_TAG,
  cumulativeDnaForLevel,
  entryDnaFloor,
  ticksToSeconds,
  worldReference,
} from '@evolution/shared';
import { medianOf } from '../../game/session/entry.js';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { progressOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { insideCellOf, scenarioPlayerId } from '../gameplay/index.js';
import { P7_JOIN_TICK } from './shared-setups.js';

const { growth, ecology, progression } = DEFAULT_BALANCE;
/** Neighbours far enough apart that no placement, separation or eating reaches another cell. */
const NEIGHBOUR_SPACING_WU = 700;
/** The leaderboard is rebuilt at step 10 of every tick: tick 1 ranks what tick 1 ate. */
const RANK_TICK = 1;
/** A score every tied player shares: set by fixture, so it is lifetime DNA, not gift. */
const TIED_DNA = cumulativeDnaForLevel(2, progression);

function rankedPlayerIds(view: EvolutionView) {
  return view.snapshot.leaderboard.map((row) => row.playerId);
}

function rankedScores(view: EvolutionView) {
  return view.snapshot.leaderboard.map((row) => row.score);
}

/** One player per `dnaByPlayer` entry on a starting-mass cell, spaced east of player 0, with that lifetime DNA at setup. */
function placedRow(name: string, dnaByPlayer: readonly number[]) {
  const run = scenario(name).seed(PLACED_ROW_SEED).players(dnaByPlayer.length);
  dnaByPlayer.forEach((dnaCumulative, playerIndex) => {
    run.placeCell({
      playerIndex,
      mass: growth.CELL_STARTING_MASS,
      dnaCumulative,
      ...(playerIndex > 0 ? { eastOfFirstCellWu: NEIGHBOUR_SPACING_WU * playerIndex } : {}),
    });
  });
  return run;
}

describe('session §5.3: the leaderboard order', () => {
  it('ranks by score: the DNA each cell eats this tick orders the board', async () => {
    const fragmentsByPlayer = [1, 3, 2];
    const run = placedRow('leaderboard by score', [0, 0, 0]);
    fragmentsByPlayer.forEach((fragments, playerIndex) => {
      for (let fragment = 0; fragment < fragments; fragment += 1) {
        run.atTick(RANK_TICK).placeFragment({ tag: DNA_TAG.motile, at: insideCellOf(playerIndex) });
      }
    });
    await run
      .advance(RANK_TICK)
      .expect('highest score first', rankedPlayerIds)
      .atTick(RANK_TICK)
      .toEqual([1, 2, 0].map(scenarioPlayerId))
      .expect('scores', rankedScores)
      .atTick(RANK_TICK)
      .toEqual([3, 2, 1].map((fragments) => fragments * ecology.DNA_FRAGMENT_DNA))
      .expect('ranks', (view) => view.snapshot.leaderboard.map((row) => row.rank))
      .atTick(RANK_TICK)
      .toEqual([1, 2, 3])
      .runDeterministic();
  });

  it('breaks a score tie by current mass, heavier first', async () => {
    const heavierMass = 2 * growth.CELL_STARTING_MASS;
    await placedRow('leaderboard tie by mass', [TIED_DNA, TIED_DNA])
      .placeCell({
        playerIndex: 1,
        mass: heavierMass,
        dnaCumulative: TIED_DNA,
        eastOfFirstCellWu: NEIGHBOUR_SPACING_WU,
      })
      .advance(RANK_TICK)
      .expect('scores tied', rankedScores)
      .atTick(RANK_TICK)
      .toEqual([TIED_DNA, TIED_DNA])
      .expect('the heavier, later joiner first', rankedPlayerIds)
      .atTick(RANK_TICK)
      .toEqual([1, 0].map(scenarioPlayerId))
      .expect('row masses descend', (view) => view.snapshot.leaderboard.map((row) => row.mass))
      .atTick(RANK_TICK)
      .toSatisfy((masses) => masses[0]! > masses[1]!, 'the first row heavier than the second')
      .runDeterministic();
  });

  it('breaks a score and mass tie by join order, earliest first, below a higher score', async () => {
    const leaderDna = TIED_DNA + ecology.DNA_FRAGMENT_DNA;
    await placedRow('leaderboard tie by join order', [TIED_DNA, TIED_DNA, leaderDna])
      .advance(RANK_TICK)
      .expect('the higher score, then the tied pair in join order', rankedPlayerIds)
      .atTick(RANK_TICK)
      .toEqual([2, 0, 1].map(scenarioPlayerId))
      .expect('scores', rankedScores)
      .atTick(RANK_TICK)
      .toEqual([leaderDna, TIED_DNA, TIED_DNA])
      .expect('tied masses', (view) => view.snapshot.leaderboard.slice(1).map((row) => row.mass))
      .atTick(RANK_TICK)
      .toEqual([growth.CELL_STARTING_MASS, growth.CELL_STARTING_MASS])
      .runDeterministic();
  });

  it('ranks a late joiner by earned DNA only: its catch-up gift buys no rank', async () => {
    const leaderDna = cumulativeDnaForLevel(3, progression);
    const trailerDna = ecology.DNA_FRAGMENT_DNA;
    const reference = worldReference(ticksToSeconds(P7_JOIN_TICK), DEFAULT_BALANCE);
    const gift = entryDnaFloor(0, medianOf([leaderDna, trailerDna]), reference, DEFAULT_BALANCE);
    // The row only discriminates when the gift, were it scored, would lift the joiner over the trailer.
    expect(gift).toBeGreaterThan(trailerDna);
    await placedRow('leaderboard late-join gift', [leaderDna, trailerDna])
      .playerJoinsAt(P7_JOIN_TICK)
      .advance(P7_JOIN_TICK)
      .expect('joiner gift', (view) => progressOf(view, 2)?.dnaCatchUpGift)
      .atTick(P7_JOIN_TICK)
      .toBe(gift)
      .expect('the joiner last', rankedPlayerIds)
      .atTick(P7_JOIN_TICK)
      .toEqual([0, 1, 2].map(scenarioPlayerId))
      .expect('scores', rankedScores)
      .atTick(P7_JOIN_TICK)
      .toEqual([leaderDna, trailerDna, 0])
      .runDeterministic();
  });
});
