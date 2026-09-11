// The fixed-seed bench scene (docs/RENDERING.md §7): a synthetic world built once from a seed and
// a pure `GameSnapshot` for any tick, so the bench route, the Playwright smoke and the unit tests
// all draw the same frame for the same seed and tick. Cells cover every stage and palette on
// scripted circular paths; a few pairs engulf, a few victims are absorbed and respawn, eats and
// level-ups fire on a schedule. Nothing here draws from the clock or the wall.

import {
  CELL_KIND,
  CELL_STATE,
  DEFAULT_BALANCE,
  DISH_RADIUS,
  ENGULF_SEAL_PROGRESS,
  FOOD_EDGE_MARGIN,
  PLAYER_PALETTE_COUNT,
  RADIANS_PER_FULL_TURN,
  RANDOM_STREAM,
  ROUND_PHASE,
  ROUND_DURATION_SECONDS,
  MILLISECONDS_PER_SECOND,
  TICK_INTERVAL_S,
  createSeededRandom,
  entityId,
  playerId,
  radiusForMass,
  type CellStage,
  type CellView,
  type FoodMoteView,
  type GameSnapshot,
  type MotePositionView,
  type PlayerId,
  type RandomSource,
} from '@evolution/shared';
import {
  RENDER_BENCH_ABSORB_EVERY_TICKS,
  RENDER_BENCH_CELL_COUNT,
  RENDER_BENCH_ENGULF_PAIRS,
  RENDER_BENCH_FRAGMENT_COUNT,
  RENDER_BENCH_LEVEL_UP_EVERY_TICKS,
  RENDER_BENCH_MASS,
  RENDER_BENCH_MOTE_COUNT,
  RENDER_BENCH_ORBIT_RADIUS_WU,
  RENDER_BENCH_ORBIT_SECONDS,
  RENDER_BENCH_VICTIM_COUNT,
} from '../constants';
import { scheduledBenchEffects } from './bench-effects';
import { benchFragmentSpec, benchFragmentView, type BenchFragmentSpec } from './bench-fragments';
import { benchMoteSpecs, benchMotesAt, type BenchMoteSpec } from './bench-motes';
import { benchPlayers } from './bench-players';
import { BENCH_STAGE_TRAITS, benchCellStage } from './bench-traits';

export const BENCH_STREAM_LABEL = `${RANDOM_STREAM.cosmetic}:bench`;
export const BENCH_OWN_PLAYER_ID = playerId('bench-player-0');

export interface BenchCellSpec {
  readonly index: number;
  readonly id: string;
  readonly playerId: PlayerId | null;
  readonly avatarIndex: number;
  readonly stage: CellStage;
  readonly mass: number;
  readonly orbitRadiusWu: number;
  readonly orbitSeconds: number;
  readonly phase: number;
  /** The predator this cell rides while engulfed, by index; `null` for a free cell. */
  readonly predatorIndex: number | null;
  /** Victims vanish and respawn on the absorb schedule. */
  readonly isVictim: boolean;
}

export interface BenchWorld {
  readonly seed: number;
  readonly cells: readonly BenchCellSpec[];
  readonly motes: readonly BenchMoteSpec[];
  readonly fragments: readonly BenchFragmentSpec[];
}

export interface BenchCounts {
  readonly cells: number;
  readonly motes: number;
  readonly fragments: number;
}

export const BENCH_COUNTS: BenchCounts = {
  cells: RENDER_BENCH_CELL_COUNT,
  motes: RENDER_BENCH_MOTE_COUNT,
  fragments: RENDER_BENCH_FRAGMENT_COUNT,
};

const HALF = 0.5;
const VICTIM_VISIBLE_SHARE = 0.5;
/** An engulf pair is two consecutive cells: the even index hunts, the odd one is its prey. */
const PAIR_SIZE = 2;

function logUniform(random: RandomSource, min: number, max: number): number {
  return Math.exp(Math.log(min) + (Math.log(max) - Math.log(min)) * random.nextFloat());
}

function cellSpec(index: number, count: number, random: RandomSource): BenchCellSpec {
  const isPlayer = index < PLAYER_PALETTE_COUNT;
  const isPrey = index < RENDER_BENCH_ENGULF_PAIRS * PAIR_SIZE && index % PAIR_SIZE === 1;
  const isVictim = index >= count - RENDER_BENCH_VICTIM_COUNT;
  const stage = benchCellStage(index);
  const mass = isPrey ? RENDER_BENCH_MASS.min : logUniform(random, RENDER_BENCH_MASS.min, RENDER_BENCH_MASS.max);
  return {
    index,
    id: `bench-c-${index}`,
    playerId: isPlayer ? playerId(`bench-player-${index}`) : null,
    avatarIndex: index % PLAYER_PALETTE_COUNT,
    stage,
    mass,
    orbitRadiusWu:
      RENDER_BENCH_ORBIT_RADIUS_WU.min +
      random.nextFloat() * (RENDER_BENCH_ORBIT_RADIUS_WU.max - RENDER_BENCH_ORBIT_RADIUS_WU.min),
    orbitSeconds:
      RENDER_BENCH_ORBIT_SECONDS.min +
      random.nextFloat() * (RENDER_BENCH_ORBIT_SECONDS.max - RENDER_BENCH_ORBIT_SECONDS.min),
    phase: random.nextFloat(),
    predatorIndex: isPrey ? index - 1 : null,
    isVictim,
  };
}

/** The world for `seed`: every spec drawn from the bench fork of the cosmetic stream, in index order. */
export function buildBenchWorld(seed: number, counts: BenchCounts = BENCH_COUNTS): BenchWorld {
  const random = createSeededRandom(seed).fork(BENCH_STREAM_LABEL);
  const cells = Array.from({ length: counts.cells }, (_unused, index) => cellSpec(index, counts.cells, random));
  const motes = benchMoteSpecs(counts.motes, random);
  const fragments = Array.from({ length: counts.fragments }, (_unused, index) => benchFragmentSpec(index, random));
  return { seed, cells, motes, fragments };
}

interface OrbitPose {
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
}

function orbitPose(spec: BenchCellSpec, timeSeconds: number): OrbitPose {
  const angularSpeed = RADIANS_PER_FULL_TURN / spec.orbitSeconds;
  const angle = spec.phase * RADIANS_PER_FULL_TURN + angularSpeed * timeSeconds;
  const radius = Math.min(spec.orbitRadiusWu, DISH_RADIUS - FOOD_EDGE_MARGIN);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    velocityX: -Math.sin(angle) * radius * angularSpeed,
    velocityY: Math.cos(angle) * radius * angularSpeed,
  };
}

/** Victims are on screen for the first half of every absorb cycle, absorbed at its middle and respawned at its end. */
export function isVictimVisible(tick: number): boolean {
  return (tick % RENDER_BENCH_ABSORB_EVERY_TICKS) / RENDER_BENCH_ABSORB_EVERY_TICKS < VICTIM_VISIBLE_SHARE;
}

export function victimAbsorbTick(): number {
  return Math.floor(RENDER_BENCH_ABSORB_EVERY_TICKS * VICTIM_VISIBLE_SHARE);
}

/** The prey's engulf progress cycles through the whole strip, so every frame of the wrap shows. */
function engulfProgressAt(tick: number): number {
  return (tick % RENDER_BENCH_LEVEL_UP_EVERY_TICKS) / RENDER_BENCH_LEVEL_UP_EVERY_TICKS;
}

interface EngulfLinks {
  readonly states: CellView['states'];
  readonly engulfProgress: number;
  readonly engulfingCellId: CellView['engulfingCellId'];
  readonly engulfedByCellId: CellView['engulfedByCellId'];
  /** The prey rides inside its predator, sinking as the progress grows. */
  readonly offsetX: number;
}

function engulfLinks(world: BenchWorld, spec: BenchCellSpec, tick: number): EngulfLinks {
  const predator = spec.predatorIndex === null ? null : (world.cells[spec.predatorIndex] ?? null);
  const preyOfThis = world.cells.find((other) => other.predatorIndex === spec.index) ?? null;
  if (predator !== null) {
    const progress = engulfProgressAt(tick);
    const predatorRadius = radiusForMass(predator.mass, DEFAULT_BALANCE.growth);
    return {
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: progress,
      engulfingCellId: null,
      engulfedByCellId: entityId(predator.id),
      offsetX: predatorRadius * (1 - progress * HALF),
    };
  }
  return {
    states: [preyOfThis === null ? CELL_STATE.free : CELL_STATE.engulfing],
    engulfProgress: 0,
    engulfingCellId: preyOfThis === null ? null : entityId(preyOfThis.id),
    engulfedByCellId: null,
    offsetX: 0,
  };
}

export function benchCellView(world: BenchWorld, spec: BenchCellSpec, tick: number): CellView {
  const predator = spec.predatorIndex === null ? null : (world.cells[spec.predatorIndex] ?? null);
  const pose = orbitPose(predator ?? spec, tick * TICK_INTERVAL_S);
  const links = engulfLinks(world, spec, tick);
  return {
    id: entityId(spec.id),
    kind: spec.playerId === null ? CELL_KIND.wild : CELL_KIND.player,
    playerId: spec.playerId,
    organismId: entityId(spec.id),
    avatarIndex: spec.avatarIndex,
    x: pose.x + links.offsetX,
    y: pose.y,
    velocityX: pose.velocityX,
    velocityY: pose.velocityY,
    mass: spec.mass,
    radius: radiusForMass(spec.mass, DEFAULT_BALANCE.growth),
    level: 1 + (spec.index % PLAYER_PALETTE_COUNT),
    stage: spec.stage,
    traits: [...BENCH_STAGE_TRAITS[spec.stage]],
    membraneRatioBonus: 0,
    states: links.states,
    engulfProgress: links.engulfProgress,
    engulfingCellId: links.engulfingCellId,
    engulfedByCellId: links.engulfedByCellId,
    sprintRemainingTicks: 0,
    sprintCooldownRemainingTicks: 0,
  };
}

/** The snapshot at `tick`: motes in full on tick 0 (the `game_state` shape), positions only after. */
export function benchSnapshotAt(world: BenchWorld, tick: number): GameSnapshot {
  const cells = world.cells
    .filter((spec) => !spec.isVictim || isVictimVisible(tick))
    .map((spec) => benchCellView(world, spec, tick));
  const motes: FoodMoteView[] = benchMotesAt(world.motes, tick);
  const moved: MotePositionView[] = motes
    .filter((mote) => mote.kind === 'bacterium')
    .map(({ id, x, y }) => ({ id, x, y }));
  return {
    tick,
    seed: world.seed,
    roundStartTick: 0,
    roundPhase: ROUND_PHASE.playing,
    roundTimeLeftMs:
      ROUND_DURATION_SECONDS * MILLISECONDS_PER_SECOND - tick * TICK_INTERVAL_S * MILLISECONDS_PER_SECOND,
    gelPatches: [],
    cells,
    dnaFragments: world.fragments.map((spec) => benchFragmentView(spec, tick)),
    food: { spawned: tick === 0 ? motes : [], removedIds: [], moved },
    players: benchPlayers(world, tick),
    leaderboard: [],
    appliedInputSequenceByPlayer: {},
    effects: scheduledBenchEffects(world, cells, tick),
  };
}

/** The seal frame's progress, exported so a screenshot scene can be parked on it. */
export const BENCH_SEAL_PROGRESS = ENGULF_SEAL_PROGRESS;
