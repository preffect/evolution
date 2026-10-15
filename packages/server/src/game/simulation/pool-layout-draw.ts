// The rock pool's layout as drawn (docs/game-design/phases.md §14.4.6, §14.5.2): the films, the algal threads and the
// light patch's orbit, from the `pool` stream, at the round's start whenever the pool is in play, so the snapshot can
// carry it from the warning tick (docs/architecture/wire-contract.md §4 "The pool layout"). Only what is drawn is
// stored: positions and angles, never a size, which the live balance gives. The films' and threads' centres and the
// orbit's radius are rounded to whole world units here, before they are stored and hashed; the angles stay exact.
// Every shape keeps off the bank: a film and the light patch lie wholly inside its inner edge, a thread's ends too.

import {
  GAME_ERA,
  RADIANS_PER_FULL_TURN,
  isEraInPlay,
  poolBankInnerRadius,
  uniformPointInAnnulus,
  type BalanceConfig,
  type LightPatchOrbitView,
  type PoolFilmView,
  type PoolLayoutView,
  type PoolThreadView,
  type RandomSource,
  type Vec2,
} from '@evolution/shared';
import type { WorldState } from '../world/world-state.js';
import { WHOLE_DISC_INNER_RADIUS } from './zones.js';

/**
 * The orbit's radius is drawn between this share of its longest and its longest, so the patch always circles: an
 * orbit near the centre would leave it standing still.
 */
const LIGHT_PATCH_ORBIT_MIN_SHARE = 0.5;
/** A thread's centre lies midway along it, so half its length must fit inside the bank. */
const THREAD_HALF_SHARE = 0.5;

/** A centre uniform by area in the disc of `reach` (never negative, whatever a patched balance makes it), in whole wu. */
function drawWholeCentre(random: RandomSource, reach: number): Vec2 {
  const point = uniformPointInAnnulus(
    WHOLE_DISC_INNER_RADIUS,
    Math.max(0, reach),
    random.nextFloat(),
    random.nextFloat(),
  );
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function drawFilm(random: RandomSource, balance: BalanceConfig): PoolFilmView {
  return drawWholeCentre(random, poolBankInnerRadius(balance) - balance.pool.POOL_FILM_RADIUS);
}

function drawThread(random: RandomSource, balance: BalanceConfig): PoolThreadView {
  const centre = drawWholeCentre(
    random,
    poolBankInnerRadius(balance) - balance.pool.POOL_THREAD_LENGTH * THREAD_HALF_SHARE,
  );
  return { ...centre, angleRadians: random.nextFloat() * RADIANS_PER_FULL_TURN };
}

function drawLightPatchOrbit(random: RandomSource, balance: BalanceConfig, startTick: number): LightPatchOrbitView {
  const longest = Math.max(0, poolBankInnerRadius(balance) - balance.pool.POOL_LIGHT_PATCH_RADIUS);
  const shortest = longest * LIGHT_PATCH_ORBIT_MIN_SHARE;
  return {
    orbitRadius: Math.round(shortest + random.nextFloat() * (longest - shortest)),
    startAngleRadians: random.nextFloat() * RADIANS_PER_FULL_TURN,
    startTick,
  };
}

/** The layout, in draw order: `POOL_FILM_COUNT` films, `POOL_THREAD_COUNT` threads, then the orbit from `startTick`. */
export function drawPoolLayout(random: RandomSource, balance: BalanceConfig, startTick: number): PoolLayoutView {
  const films = Array.from({ length: balance.pool.POOL_FILM_COUNT }, () => drawFilm(random, balance));
  const threads = Array.from({ length: balance.pool.POOL_THREAD_COUNT }, () => drawThread(random, balance));
  return { films, threads, lightPatchOrbit: drawLightPatchOrbit(random, balance, startTick) };
}

/**
 * True when the world should hold a layout and has none: the pool is in play (at the round's start, or from the
 * `debug_set_balance` that puts it in play). The layout is the `pool` stream's first draws, so a world that draws it
 * later draws the same one; a reseed keeps the drawn one, like the gel patches.
 */
export function isPoolLayoutDue(world: Pick<WorldState, 'poolLayout' | 'balance'>): boolean {
  return world.poolLayout === null && isEraInPlay(GAME_ERA.pool, world.balance);
}

/** Draws the world's layout from `random` (the `pool` stream) when it has none, its orbit from the round's start. */
export function drawPoolLayoutIfMissing(world: WorldState, random: RandomSource): void {
  if (world.poolLayout === null) {
    world.poolLayout = drawPoolLayout(random, world.balance, world.roundStartTick);
  }
}
