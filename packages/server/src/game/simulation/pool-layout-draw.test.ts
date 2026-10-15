// docs/game-design/phases.md §14.4.6, §14.5.2 and docs/architecture/wire-contract.md §4 "The pool layout": the layout is
// drawn from the `pool` stream at the round's start whenever the pool is in play (or when a balance patch puts it in
// play), its points in whole world units and its shapes off the bank, its sizes left to the balance; a reseed keeps it.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GAME_ERA,
  RANDOM_STREAM,
  createSeededRandom,
  createSeededRandomFromState,
  poolBankInnerRadius,
  poolThreadEnds,
  withErasInPlay,
  type BalanceConfig,
  type PoolLayoutView,
} from '@evolution/shared';
import { createTestWorld, createTestWorldInEras } from '../../testing/world-builders.js';
import { reseedForDebug, setBalanceForDebug } from '../debug/debug-operations.js';
import { forkServerStreams } from '../world/streams.js';
import { drawPoolLayout, isPoolLayoutDue } from './pool-layout-draw.js';

const POOL_ON = withErasInPlay([GAME_ERA.dish, GAME_ERA.pool]);
const { pool } = DEFAULT_BALANCE;
const BANK_INNER = poolBankInnerRadius(DEFAULT_BALANCE);
const LONGEST_ORBIT = BANK_INNER - pool.POOL_LIGHT_PATCH_RADIUS;
const SEEDS = [1, 2, 3, 42, 1234];
const ROUND_START_TICK = 7_200;
/** The leaf a patch names to put the pool in play. */
const ERAS_IN_PLAY_LEAF = 'ERAS_IN_PLAY' satisfies keyof BalanceConfig['eras'];
const SECOND_SEED = 43;

function layoutFor(seed: number, balance = DEFAULT_BALANCE): PoolLayoutView {
  return drawPoolLayout(createSeededRandom(seed), balance, ROUND_START_TICK);
}

describe('drawPoolLayout', () => {
  it.each(SEEDS)('seed %i: POOL_FILM_COUNT films and POOL_THREAD_COUNT threads, centres in whole wu', (seed) => {
    const layout = layoutFor(seed);
    expect(layout.films).toHaveLength(pool.POOL_FILM_COUNT);
    expect(layout.threads).toHaveLength(pool.POOL_THREAD_COUNT);
    for (const point of [...layout.films, ...layout.threads]) {
      expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
    }
    expect(Number.isInteger(layout.lightPatchOrbit.orbitRadius)).toBe(true);
  });

  it('keeps the angles exact: not rounded to whole radians', () => {
    const angles = SEEDS.flatMap((seed) => {
      const layout = layoutFor(seed);
      return [...layout.threads.map((thread) => thread.angleRadians), layout.lightPatchOrbit.startAngleRadians];
    });
    expect(angles.some((angle) => !Number.isInteger(angle))).toBe(true);
  });

  it.each(SEEDS)('seed %i: every film, every thread’s ends and the light patch lie inside the bank', (seed) => {
    const layout = layoutFor(seed);
    for (const film of layout.films) {
      expect(Math.hypot(film.x, film.y) + pool.POOL_FILM_RADIUS).toBeLessThanOrEqual(BANK_INNER + 1);
    }
    for (const end of layout.threads.flatMap((thread) => poolThreadEnds(thread, DEFAULT_BALANCE))) {
      expect(Math.hypot(end.x, end.y)).toBeLessThanOrEqual(BANK_INNER + 1);
    }
    expect(layout.lightPatchOrbit.orbitRadius).toBeLessThanOrEqual(LONGEST_ORBIT);
  });

  it.each(SEEDS)('seed %i: the orbit is at least half its longest, so the patch always circles', (seed) => {
    expect(layoutFor(seed).lightPatchOrbit.orbitRadius).toBeGreaterThanOrEqual(LONGEST_ORBIT / 2);
  });

  it('starts the orbit on the tick it is given, the round’s start', () => {
    expect(layoutFor(1).lightPatchOrbit.startTick).toBe(ROUND_START_TICK);
  });

  it('is the same for the same seed and differs for another', () => {
    expect(layoutFor(42)).toEqual(layoutFor(42));
    expect(layoutFor(43)).not.toEqual(layoutFor(42));
  });

  it('reads the live counts and sizes: a patched balance draws to it', () => {
    const patched = structuredClone(DEFAULT_BALANCE);
    patched.pool.POOL_FILM_COUNT = 2;
    patched.pool.POOL_THREAD_COUNT = 1;
    patched.pool.POOL_LIGHT_PATCH_RADIUS = 1_500;
    const layout = layoutFor(1, patched);
    expect([layout.films.length, layout.threads.length]).toEqual([2, 1]);
    expect(layout.lightPatchOrbit.orbitRadius).toBeLessThanOrEqual(BANK_INNER - 1_500);
  });
});

describe('the layout in a round', () => {
  it('is drawn at the round’s start when the pool is in play, from the pool stream', () => {
    const world = createTestWorld({ balance: POOL_ON });
    const poolStream = createSeededRandomFromState(forkServerStreams(world.seed)[RANDOM_STREAM.pool]);
    expect(world.poolLayout).toEqual(drawPoolLayout(poolStream, POOL_ON, world.roundStartTick));
    expect(world.random[RANDOM_STREAM.pool].position).toBeGreaterThan(0);
  });

  it('is not drawn while the eras are off: the pool stream stays undrawn, so the dish hashes as before', () => {
    const world = createTestWorld();
    expect(world.poolLayout).toBeNull();
    expect(world.random[RANDOM_STREAM.pool].position).toBe(0);
    expect(isPoolLayoutDue(world)).toBe(false);
  });

  it('a patch that puts the pool in play draws the layout the round’s start would have drawn', () => {
    const patched = createTestWorld();
    setBalanceForDebug(patched, { eras: { [ERAS_IN_PLAY_LEAF]: [GAME_ERA.dish, GAME_ERA.pool] } });
    const fromTheStart = createTestWorld({ balance: POOL_ON });
    expect(patched.poolLayout).not.toBeNull();
    expect(patched.poolLayout).toEqual(fromTheStart.poolLayout);
  });

  it('a patch that leaves the pool out of play draws nothing, and a second patch keeps the layout drawn', () => {
    const world = createTestWorld();
    setBalanceForDebug(world, { eras: { [ERAS_IN_PLAY_LEAF]: [GAME_ERA.dish] } });
    expect(world.poolLayout).toBeNull();
    const inEras = createTestWorldInEras();
    const drawn = inEras.poolLayout;
    setBalanceForDebug(inEras, { eras: { [ERAS_IN_PLAY_LEAF]: [GAME_ERA.dish, GAME_ERA.pool] } });
    expect(inEras.poolLayout).toBe(drawn);
  });

  it('a reseed keeps the drawn layout, as it keeps the gel patches', () => {
    const world = createTestWorldInEras();
    const drawn = world.poolLayout;
    reseedForDebug(world, SECOND_SEED);
    expect(world.poolLayout).toBe(drawn);
    expect(isPoolLayoutDue(world)).toBe(false);
  });
});
