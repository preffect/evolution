// The fixed-seed bench scene (docs/RENDERING.md §7): a synthetic world built once from a seed and
// a pure `GameSnapshot` for any tick, so the bench route, the Playwright smoke and the unit tests
// all draw the same frame for the same seed and tick. Cells cover every stage and palette on
// scripted circular paths; a few pairs engulf, a few victims are absorbed and respawn, eats and
// level-ups fire on a schedule. Nothing here draws from the clock or the wall.

import {
  CELL_KIND,
  CELL_STATE,
  COSMETIC_SUB_STREAM,
  DEFAULT_BALANCE,
  DISH_RADIUS,
  FOOD_EDGE_MARGIN,
  FOOD_KIND,
  MILLISECONDS_PER_SECOND,
  PLAYER_PALETTE_COUNT,
  RADIANS_PER_FULL_TURN,
  RANDOM_STREAM,
  ROUND_DURATION_SECONDS,
  ROUND_PHASE,
  TICK_INTERVAL_S,
  WORLD_ORGANISM_ID,
  createSeededRandom,
  entityId,
  playerId,
  radiusForMass,
  type CellStage,
  type CellView,
  type GameSnapshot,
  type PlayerId,
  type RandomSource,
} from '@evolution/shared';
import {
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
import { HALF } from '../geometry';
import { isVictimVisible, scheduledBenchEffects } from './bench-effects';
import {
  benchFragmentSpecs,
  benchFragmentView,
  benchMoteSpecs,
  benchMotesAt,
  type BenchFragmentSpec,
  type BenchMoteSpec,
} from './bench-food';
import { BENCH_STAGE_TRAITS, benchCellLevel, benchCellStage, benchPlayers } from './bench-traits';

/** The bench's own fork of the cosmetic stream: `cosmetic:bench`, the pattern of docs/RENDERING.md §1. */
export const BENCH_STREAM_LABEL = `${RANDOM_STREAM.cosmetic}:${COSMETIC_SUB_STREAM.bench}`;
export const BENCH_OWN_PLAYER_ID: PlayerId = playerId('bench-player-0');

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

/** The bench load of docs/RENDERING.md §7. */
export const BENCH_COUNTS: BenchCounts = {
  cells: RENDER_BENCH_CELL_COUNT,
  motes: RENDER_BENCH_MOTE_COUNT,
  fragments: RENDER_BENCH_FRAGMENT_COUNT,
};

/** An engulf pair is two consecutive cells: the even index hunts, the odd one is its prey. */
const PAIR_SIZE = 2;

function logUniform(random: RandomSource, range: { readonly min: number; readonly max: number }): number {
  return Math.exp(Math.log(range.min) + (Math.log(range.max) - Math.log(range.min)) * random.nextFloat());
}

function uniform(random: RandomSource, range: { readonly min: number; readonly max: number }): number {
  return range.min + random.nextFloat() * (range.max - range.min);
}

function cellSpec(index: number, count: number, random: RandomSource): BenchCellSpec {
  const isPlayer = index < PLAYER_PALETTE_COUNT;
  const isPrey = index < RENDER_BENCH_ENGULF_PAIRS * PAIR_SIZE && index % PAIR_SIZE === 1;
  return {
    index,
    id: `bench-c-${index}`,
    playerId: isPlayer ? playerId(`bench-player-${index}`) : null,
    avatarIndex: index % PLAYER_PALETTE_COUNT,
    stage: benchCellStage(index),
    mass: isPrey ? RENDER_BENCH_MASS.min : logUniform(random, RENDER_BENCH_MASS),
    orbitRadiusWu: uniform(random, RENDER_BENCH_ORBIT_RADIUS_WU),
    orbitSeconds: uniform(random, RENDER_BENCH_ORBIT_SECONDS),
    phase: random.nextFloat(),
    predatorIndex: isPrey ? index - 1 : null,
    isVictim: index >= count - RENDER_BENCH_VICTIM_COUNT,
  };
}

/** The world for `seed`: every spec drawn from the bench fork of the cosmetic stream, in index order. */
export function buildBenchWorld(seed: number, counts: BenchCounts = BENCH_COUNTS): BenchWorld {
  const random = createSeededRandom(seed).fork(BENCH_STREAM_LABEL);
  const cells = Array.from({ length: counts.cells }, (_unused, index) => cellSpec(index, counts.cells, random));
  return {
    seed,
    cells,
    motes: benchMoteSpecs(counts.motes, random),
    fragments: benchFragmentSpecs(counts.fragments, random),
  };
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

/** The prey's engulf progress cycles through the whole strip, so every frame of the wrap shows. */
export function engulfProgressAt(tick: number): number {
  return (tick % RENDER_BENCH_LEVEL_UP_EVERY_TICKS) / RENDER_BENCH_LEVEL_UP_EVERY_TICKS;
}

type EngulfLinks = Pick<CellView, 'states' | 'engulfProgress' | 'engulfingCellId' | 'engulfedByCellId'> & {
  /** The prey rides inside its predator, sinking as the progress grows. */
  readonly offsetX: number;
};

function engulfLinks(world: BenchWorld, spec: BenchCellSpec, tick: number): EngulfLinks {
  const predator = spec.predatorIndex === null ? null : (world.cells[spec.predatorIndex] ?? null);
  if (predator !== null) {
    const progress = engulfProgressAt(tick);
    return {
      states: [CELL_STATE.beingEngulfed],
      engulfProgress: progress,
      engulfingCellId: null,
      engulfedByCellId: entityId(predator.id),
      offsetX: radiusForMass(predator.mass, DEFAULT_BALANCE.growth) * (1 - progress * HALF),
    };
  }
  const prey = world.cells.find((other) => other.predatorIndex === spec.index) ?? null;
  return {
    states: [prey === null ? CELL_STATE.free : CELL_STATE.engulfing],
    engulfProgress: 0,
    engulfingCellId: prey === null ? null : entityId(prey.id),
    engulfedByCellId: null,
    offsetX: 0,
  };
}

export function benchCellView(world: BenchWorld, spec: BenchCellSpec, tick: number): CellView {
  const predator = spec.predatorIndex === null ? null : (world.cells[spec.predatorIndex] ?? null);
  const pose = orbitPose(predator ?? spec, tick * TICK_INTERVAL_S);
  const { offsetX, ...links } = engulfLinks(world, spec, tick);
  return {
    id: entityId(spec.id),
    kind: spec.playerId === null ? CELL_KIND.wild : CELL_KIND.player,
    playerId: spec.playerId,
    organismId: spec.playerId === null ? WORLD_ORGANISM_ID : entityId(spec.id),
    avatarIndex: spec.avatarIndex,
    x: pose.x + offsetX,
    y: pose.y,
    velocityX: pose.velocityX,
    velocityY: pose.velocityY,
    mass: spec.mass,
    radius: radiusForMass(spec.mass, DEFAULT_BALANCE.growth),
    level: benchCellLevel(spec.index),
    stage: spec.stage,
    traits: [...BENCH_STAGE_TRAITS[spec.stage]],
    membraneRatioBonus: 0,
    ...links,
    sprintRemainingTicks: 0,
    sprintCooldownRemainingTicks: 0,
  };
}

/** The snapshot at `tick`: motes in full on tick 0 (the `game_state` shape), bacteria positions only after. */
export function benchSnapshotAt(world: BenchWorld, tick: number): GameSnapshot {
  const present = world.cells.filter((spec) => !spec.isVictim || isVictimVisible(tick));
  const cells = present.map((spec) => benchCellView(world, spec, tick));
  const victims = world.cells.filter((spec) => spec.isVictim).map((spec) => benchCellView(world, spec, tick));
  const motes = benchMotesAt(world.motes, tick);
  const moved = motes.filter((mote) => mote.kind === FOOD_KIND.bacterium).map(({ id, x, y }) => ({ id, x, y }));
  const players = world.cells
    .filter((spec) => spec.playerId !== null)
    .map((spec) => ({ index: spec.index, playerId: spec.playerId! }));
  return {
    tick,
    seed: world.seed,
    roundStartTick: 0,
    roundPhase: ROUND_PHASE.playing,
    roundTimeLeftMs: (ROUND_DURATION_SECONDS - tick * TICK_INTERVAL_S) * MILLISECONDS_PER_SECOND,
    gelPatches: [],
    cells,
    dnaFragments: world.fragments.map((spec) => benchFragmentView(spec, tick)),
    food: { spawned: tick === 0 ? motes : [], removedIds: [], moved },
    players: benchPlayers(players, tick),
    leaderboard: [],
    appliedInputSequenceByPlayer: {},
    effects: scheduledBenchEffects({ cells, victims, creditedPlayerId: BENCH_OWN_PLAYER_ID }, tick),
  };
}
