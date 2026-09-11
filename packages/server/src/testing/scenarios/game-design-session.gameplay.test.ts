// docs/GAME-DESIGN.md §13, the session and world-clock rows that need no engulf and no wild cell
// (G1–G3, G9–G11, G14), each run twice and hash-compared. The control rows are
// game-design-controls.gameplay.test.ts. G8 (an absorption) waits for the engulf slice of #98;
// G13 (a wild killer) for the wild-cell slice; G12 is the pure `standingAgainstWorld` row, pinned
// in packages/shared/src/simulation/world-clock.test.ts.

import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  FOOD_KIND,
  RANDOM_STREAM,
  ROUND_PHASE,
  TICK_HZ,
  TICK_INTERVAL_MS,
  createSeededRandom,
  entryMass,
  ticksToSeconds,
  worldReference,
} from '@evolution/shared';
import { drawSpawnCandidate } from '../../game/simulation/spawn-placement.js';
import {
  PLACED_ROW_SEED,
  TABLE_SEED,
  evolutionScenario as scenario,
  type EvolutionScenarioSnapshot,
} from '../gameplay/evolution-adapter.js';
import {
  cellOf,
  distanceBetweenCells,
  effectsOfKind,
  massOf,
  progressOf,
  type EvolutionView,
} from '../gameplay/evolution-views.js';
import { player, type PlayerScript } from '../gameplay/index.js';
import { MASS_TOLERANCE, P7_JOIN_TICK, decayed, p7Setup, seededSolo } from './shared-setups.js';

const { growth, ecology, session, world: dish } = DEFAULT_BALANCE;
const TIME_TOLERANCE_MS = 1;
const ROUND_TICKS = session.ROUND_DURATION_SECONDS * TICK_HZ;
const RESULTS_TICKS = session.RESULTS_SCREEN_SECONDS * TICK_HZ;
const ROUND_MS = session.ROUND_DURATION_SECONDS * 1000;
const WORLD_LEVEL_TICKS = DEFAULT_BALANCE.worldClock.WORLD_LEVEL_SECONDS * TICK_HZ;
const G10_LEAVE_TICK = 2400;
const G14_JOIN_TICK = 18_000;

function detritusMass(view: EvolutionView): number {
  return view.snapshot.food.spawned
    .filter((mote) => mote.kind === FOOD_KIND.detritus)
    .reduce((total) => total + ecology.DETRITUS_MOTE_MASS, 0);
}

/** docs/ECOLOGY.md §1 rounding: motes = floor(fraction × mass / mote mass), the remainder dropped. */
function expectedDetritusMass(massAtRemoval: number): number {
  const motes = Math.floor((ecology.DETRITUS_MASS_FRACTION * massAtRemoval) / ecology.DETRITUS_MOTE_MASS);
  return ecology.DETRITUS_MOTE_MASS * motes;
}

function worldLevelUpAt(tick: number, level: number, stage: (typeof CELL_STAGE)[keyof typeof CELL_STAGE]) {
  return [{ kind: EFFECT_KIND.worldLevelUp, tick, level, stage }];
}

describe('GAME-DESIGN §13: the session', () => {
  it('G1: the first tick of a round', () => {
    seededSolo('G1')
      .advance(1)
      .expect('mass', (view) => massOf(view, 0))
      .atTick(1)
      .toBe(growth.CELL_STARTING_MASS)
      .expect('level', (view) => cellOf(view, 0)?.level)
      .atTick(1)
      .toBe(1)
      .expect('stage', (view) => cellOf(view, 0)?.stage)
      .atTick(1)
      .toBe(CELL_STAGE.protocell)
      .expect('traits', (view) => cellOf(view, 0)?.traits)
      .atTick(1)
      .toEqual([])
      .expect('phase', (view) => view.snapshot.roundPhase)
      .atTick(1)
      .toBe(ROUND_PHASE.playing)
      .expect('time left', (view) => view.snapshot.roundTimeLeftMs)
      .atTick(1)
      .toBeCloseTo(ROUND_MS - TICK_INTERVAL_MS, TIME_TOLERANCE_MS)
      .runDeterministic();
  });

  it('G3: a joiner whose first candidate lies on a threat is placed a safe radius away', () => {
    // The joiner's first candidate is the placement stream's second draw: the seeded player took the first.
    const placement = createSeededRandom(PLACED_ROW_SEED).fork(RANDOM_STREAM.spawnPlacement);
    drawSpawnCandidate(placement, DEFAULT_BALANCE);
    const candidate = drawSpawnCandidate(placement, DEFAULT_BALANCE);
    scenario('G3')
      .seed(PLACED_ROW_SEED)
      .players(1)
      .placeCell({ playerIndex: 0, mass: 100, at: candidate })
      .playerJoinsAt(1)
      .advance(1)
      .expect('distance from the threat', (view) => distanceBetweenCells(view, 0, 1))
      .atTick(1)
      .toBeAtLeast(dish.SAFE_SPAWN_RADIUS)
      .runDeterministic();
  });

  it('G9: a late joiner gets a safely placed protocell and the round clock ignores the join', () => {
    p7Setup('G9')
      .advance(P7_JOIN_TICK)
      .expect('cell exists', (view) => cellOf(view, 2))
      .atTick(P7_JOIN_TICK)
      .toSatisfy((cell) => cell !== undefined, 'a cell')
      .expect('stage', (view) => cellOf(view, 2)?.stage)
      .atTick(P7_JOIN_TICK)
      .toBe(CELL_STAGE.protocell)
      .expect('placed safely from A', (view) => distanceBetweenCells(view, 0, 2))
      .atTick(P7_JOIN_TICK)
      .toBeAtLeast(dish.SAFE_SPAWN_RADIUS)
      .expect('placed safely from B', (view) => distanceBetweenCells(view, 1, 2))
      .atTick(P7_JOIN_TICK)
      .toBeAtLeast(dish.SAFE_SPAWN_RADIUS)
      .expect('time left', (view) => view.snapshot.roundTimeLeftMs)
      .atTick(P7_JOIN_TICK)
      .toBeCloseTo(ROUND_MS - P7_JOIN_TICK * TICK_INTERVAL_MS, TIME_TOLERANCE_MS)
      .runDeterministic();
  });

  it('G10: a removed player dissolves into detritus', () => {
    seededSolo('G10')
      .playerLeavesAt(G10_LEAVE_TICK, 0)
      .advance(G10_LEAVE_TICK + 1)
      .capture('mass at removal', (view) => massOf(view, 0))
      .atTick(G10_LEAVE_TICK - 1)
      .expect('no cell', (view) => cellOf(view, 0))
      .atEnd()
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect(
        'detritus mass equals the rounded share of the mass at removal',
        (view) => detritusMass(view) === expectedDetritusMass(view.captured('mass at removal') as number),
      )
      .atEnd()
      .toBe(true)
      .runDeterministic();
  });

  it('G14: a joiner at 5:00 is floored at the world clock, not the idle player', () => {
    const reference = worldReference(ticksToSeconds(G14_JOIN_TICK), DEFAULT_BALANCE);
    const expectedMass = decayed(entryMass(null, reference, DEFAULT_BALANCE), 1);
    seededSolo('G14')
      .playerJoinsAt(G14_JOIN_TICK)
      .advance(G14_JOIN_TICK)
      .expect('dna', (view) => progressOf(view, 1)?.dnaCumulative)
      .atTick(G14_JOIN_TICK)
      .toBe(60)
      .expect('gift', (view) => progressOf(view, 1)?.dnaCatchUpGift)
      .atTick(G14_JOIN_TICK)
      .toBe(60)
      .expect('level', (view) => progressOf(view, 1)?.level)
      .atTick(G14_JOIN_TICK)
      .toBe(2)
      .expect('offer shown', (view) => progressOf(view, 1)?.offer?.offerId)
      .atTick(G14_JOIN_TICK)
      .toBe(1)
      .expect('mass', (view) => massOf(view, 1))
      .atTick(G14_JOIN_TICK)
      .toBeCloseTo(expectedMass, MASS_TOLERANCE)
      .expect('score', (view) => progressOf(view, 1)?.score)
      .atTick(G14_JOIN_TICK)
      .toBe(0)
      .runDeterministic();
  });
});

describe('GAME-DESIGN §13: the whole round (G2 and G11 share one seeded, idle 37 200-tick run)', () => {
  it('G2 + G11: results when the timer reaches zero, world_level_up on the level ticks only, a rematch with seed + 1', () => {
    const seen: number[] = [];
    const recordLevelUps: PlayerScript<EvolutionScenarioSnapshot> = (context) => {
      for (const effect of context.snapshot.effects) {
        if (effect.kind === EFFECT_KIND.worldLevelUp) seen.push(effect.tick);
      }
      return null;
    };
    seededSolo('G2 + G11')
      .from(1, player(0).does(recordLevelUps))
      .advance(ROUND_TICKS + RESULTS_TICKS)
      .expect('playing at 35 999', (view) => view.snapshot.roundPhase)
      .atTick(ROUND_TICKS - 1)
      .toBe(ROUND_PHASE.playing)
      .expect('results at 36 000', (view) => view.snapshot.roundPhase)
      .atTick(ROUND_TICKS)
      .toBe(ROUND_PHASE.results)
      .expect('results until 37 199', (view) => view.snapshot.roundPhase)
      .atTick(ROUND_TICKS + RESULTS_TICKS - 1)
      .toBe(ROUND_PHASE.results)
      .expect('playing at 37 200', (view) => view.snapshot.roundPhase)
      .atEnd()
      .toBe(ROUND_PHASE.playing)
      .expect('seed', (view) => view.snapshot.seed)
      .atEnd()
      .toBe(TABLE_SEED + session.ROUND_SEED_INCREMENT)
      .expect('level', (view) => progressOf(view, 0)?.level)
      .atEnd()
      .toBe(1)
      .expect('stage', (view) => cellOf(view, 0)?.stage)
      .atEnd()
      .toBe(CELL_STAGE.protocell)
      .expect('world level 2', (view) => effectsOfKind(view, EFFECT_KIND.worldLevelUp))
      .atTick(WORLD_LEVEL_TICKS)
      .toEqual(worldLevelUpAt(WORLD_LEVEL_TICKS, 2, CELL_STAGE.prokaryote))
      .expect('world level 3', (view) => effectsOfKind(view, EFFECT_KIND.worldLevelUp))
      .atTick(2 * WORLD_LEVEL_TICKS)
      .toEqual(worldLevelUpAt(2 * WORLD_LEVEL_TICKS, 3, CELL_STAGE.endosymbiosis))
      .expect('world level 4', (view) => effectsOfKind(view, EFFECT_KIND.worldLevelUp))
      .atTick(3 * WORLD_LEVEL_TICKS)
      .toEqual(worldLevelUpAt(3 * WORLD_LEVEL_TICKS, 4, CELL_STAGE.eukaryote))
      .expect('no world level-up on the rematch tick', (view) => effectsOfKind(view, EFFECT_KIND.worldLevelUp))
      .atEnd()
      .toEqual([])
      .expect('the rematch restarts the clock', (view) => view.snapshot.roundStartTick)
      .atEnd()
      .toBe(ROUND_TICKS + RESULTS_TICKS)
      .runDeterministic();
    // Both runs of `runDeterministic` feed the script, so every level tick appears twice and nothing else.
    const levelTicks = [...new Set(seen)].sort((left, right) => left - right);
    expect(levelTicks).toEqual([WORLD_LEVEL_TICKS, 2 * WORLD_LEVEL_TICKS, 3 * WORLD_LEVEL_TICKS]);
  });
});
