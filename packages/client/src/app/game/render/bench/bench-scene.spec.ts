// docs/RENDERING.md §9: counts and seed-stability of the bench scene.
import { describe, expect, it } from 'vitest';
import {
  CELL_STATE,
  EFFECT_KIND,
  FOOD_KIND,
  PLAYER_PALETTE_COUNT,
  STAGE_ORDER,
  WORLD_ORGANISM_ID,
} from '@evolution/shared';
import {
  RENDER_BENCH_ABSORB_EVERY_TICKS,
  RENDER_BENCH_CELL_COUNT,
  RENDER_BENCH_EATS_PER_SNAPSHOT,
  RENDER_BENCH_ENGULF_PAIRS,
  RENDER_BENCH_FRAGMENT_COUNT,
  RENDER_BENCH_LEVEL_UP_EVERY_TICKS,
  RENDER_BENCH_MOTE_COUNT,
  RENDER_BENCH_SEED,
  RENDER_BENCH_VICTIM_COUNT,
} from '../constants';
import { victimAbsorbTick } from './bench-effects';
import { BENCH_OWN_PLAYER_ID, benchSnapshotAt, buildBenchWorld, engulfProgressAt } from './bench-scene';

const world = buildBenchWorld(RENDER_BENCH_SEED);

describe('bench scene', () => {
  it('has the bench load: 100 cells across every stage and palette, 1 400 motes, 110 fragments', () => {
    const snapshot = benchSnapshotAt(world, 0);
    expect(snapshot.cells).toHaveLength(RENDER_BENCH_CELL_COUNT);
    expect(snapshot.food.spawned).toHaveLength(RENDER_BENCH_MOTE_COUNT);
    expect(snapshot.dnaFragments).toHaveLength(RENDER_BENCH_FRAGMENT_COUNT);
    expect(new Set(snapshot.cells.map((cell) => cell.stage)).size).toBe(STAGE_ORDER.length);
    expect(new Set(snapshot.cells.map((cell) => cell.avatarIndex)).size).toBe(PLAYER_PALETTE_COUNT);
    expect(snapshot.cells.filter((cell) => cell.playerId !== null)).toHaveLength(PLAYER_PALETTE_COUNT);
    expect(Object.keys(snapshot.players)).toHaveLength(PLAYER_PALETTE_COUNT);
    expect(snapshot.players[BENCH_OWN_PLAYER_ID]?.playerName).toBe('Bench 0');
    const wild = snapshot.cells.find((cell) => cell.playerId === null)!;
    expect(wild.organismId).toBe(WORLD_ORGANISM_ID);
    expect(new Set(snapshot.food.spawned.map((mote) => mote.kind))).toEqual(
      new Set([FOOD_KIND.algae, FOOD_KIND.bacterium, FOOD_KIND.detritus]),
    );
  });

  it('is seed-stable and differs by seed', () => {
    expect(benchSnapshotAt(buildBenchWorld(RENDER_BENCH_SEED), 120)).toEqual(benchSnapshotAt(world, 120));
    expect(benchSnapshotAt(buildBenchWorld(RENDER_BENCH_SEED + 1), 120)).not.toEqual(benchSnapshotAt(world, 120));
  });

  it('moves the cells on orbits with a matching velocity and walks only the bacteria', () => {
    const before = benchSnapshotAt(world, 0);
    const after = benchSnapshotAt(world, 6);
    const cell = after.cells[2]!;
    const previous = before.cells[2]!;
    expect(Math.hypot(cell.x - previous.x, cell.y - previous.y)).toBeGreaterThan(0);
    expect(Math.sign(cell.x - previous.x)).toBe(Math.sign(cell.velocityX + previous.velocityX));
    const bacteriumIds = before.food.spawned.filter((mote) => mote.kind === FOOD_KIND.bacterium).map((mote) => mote.id);
    expect(after.food.moved.map((mote) => mote.id)).toEqual(bacteriumIds);
    expect(after.food.spawned).toEqual([]);
    expect(after.dnaFragments[0]).not.toEqual(before.dnaFragments[0]);
  });

  it('keeps the engulf pairs together with a cycling progress', () => {
    const snapshot = benchSnapshotAt(world, 30);
    const prey = snapshot.cells.filter((cell) => cell.states.includes(CELL_STATE.beingEngulfed));
    expect(prey).toHaveLength(RENDER_BENCH_ENGULF_PAIRS);
    for (const cell of prey) {
      const predator = snapshot.cells.find((candidate) => candidate.id === cell.engulfedByCellId)!;
      expect(predator.states).toEqual([CELL_STATE.engulfing]);
      expect(predator.engulfingCellId).toBe(cell.id);
      expect(Math.hypot(cell.x - predator.x, cell.y - predator.y)).toBeLessThan(predator.radius);
      expect(cell.engulfProgress).toBeCloseTo(engulfProgressAt(30), 9);
    }
    expect(engulfProgressAt(30)).toBeCloseTo(30 / RENDER_BENCH_LEVEL_UP_EVERY_TICKS, 9);
  });

  it("schedules eats every snapshot, a level-up on its cadence and the victims' absorb and respawn", () => {
    const eats = benchSnapshotAt(world, 3).effects.filter((effect) => effect.kind === EFFECT_KIND.eat);
    expect(eats).toHaveLength(RENDER_BENCH_EATS_PER_SNAPSHOT);
    const atLevelUp = benchSnapshotAt(world, RENDER_BENCH_LEVEL_UP_EVERY_TICKS).effects;
    expect(atLevelUp.filter((effect) => effect.kind === EFFECT_KIND.levelUp)).toHaveLength(1);
    const absorbTick = victimAbsorbTick();
    const absorbed = benchSnapshotAt(world, absorbTick).effects.filter(
      (effect) => effect.kind === EFFECT_KIND.cellAbsorbed,
    );
    expect(absorbed).toHaveLength(RENDER_BENCH_VICTIM_COUNT);
    expect(absorbed.every((effect) => 'playerId' in effect && effect.playerId === BENCH_OWN_PLAYER_ID)).toBe(true);
    expect(benchSnapshotAt(world, absorbTick).cells).toHaveLength(RENDER_BENCH_CELL_COUNT - RENDER_BENCH_VICTIM_COUNT);
    const respawns = benchSnapshotAt(world, RENDER_BENCH_ABSORB_EVERY_TICKS).effects.filter(
      (effect) => effect.kind === EFFECT_KIND.respawn,
    );
    expect(respawns).toHaveLength(RENDER_BENCH_VICTIM_COUNT);
    expect(benchSnapshotAt(world, 1).effects.some((effect) => effect.kind === EFFECT_KIND.respawn)).toBe(false);
  });
});
