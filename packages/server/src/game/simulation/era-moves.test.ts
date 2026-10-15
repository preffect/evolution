// docs/architecture/server-simulation.md §3 ("Which moves a step runs: one rule"), docs/game-design/phases.md §14.2.4,
// §14.4.1: each step runs every move the era clock crossed, in era order, each with its `era_moved`; the next era's
// `era_warning` fires on its warning tick only, and only in a round that reaches it; nothing fires with the eras off.
// The world is in the new era while its move runs, so the pool's fragments are tagged by the pool's zones (§14.5.2).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  GAME_ERA,
  GAME_ERA_ORDER,
  ZONE_ID,
  zoneAt,
  type GameEffect,
} from '@evolution/shared';
import { createTestStepContext, createTestWorldInEras } from '../../testing/world-builders.js';
import type { WorldState } from '../world/world-state.js';
import { erasToMoveInto, runEraMoves } from './era-moves.js';
import { worldZoneMap } from './zones.js';

/** The pool's warning and move ticks, and the colonies', in a round started at 0 (phases.md §14.2.1, §14.4.1). */
const POOL_WARNING_TICK = 35_400;
const POOL_FIRST_TICK = 36_000;
const COLONIES_WARNING_TICK = 60_600;
const COLONIES_FIRST_TICK = 61_200;
/** Today's game's length: every era in play, none reachable. */
const DISH_ONLY_ROUND_SECONDS = 600;
/** One minute before a start: no move, no warning. */
const A_MINUTE_TICKS = 3600;

const ERA_EFFECT_KINDS: readonly string[] = [EFFECT_KIND.eraWarning, EFFECT_KIND.eraMoved];

/** The world stepped's era moves at `tick`: the effects they pushed. */
function eraEffectsAt(world: WorldState, tick: number): GameEffect[] {
  world.tick = tick;
  world.effects.length = 0;
  runEraMoves(world, createTestStepContext(world));
  return world.effects.filter((effect) => ERA_EFFECT_KINDS.includes(effect.kind));
}

describe('erasToMoveInto', () => {
  it.each([
    [GAME_ERA.dish, GAME_ERA.dish, []],
    [GAME_ERA.dish, GAME_ERA.pool, [GAME_ERA.pool]],
    [GAME_ERA.dish, GAME_ERA.colonies, [GAME_ERA.pool, GAME_ERA.colonies]],
    [GAME_ERA.pool, GAME_ERA.colonies, [GAME_ERA.colonies]],
    [GAME_ERA.colonies, GAME_ERA.colonies, []],
  ])('from %s to the clock’s %s runs %j, in era order', (movedInto, clockEra, moves) => {
    expect(erasToMoveInto(movedInto, clockEra)).toEqual(moves);
  });
});

describe('runEraMoves with every era in play, a 1 500 s round', () => {
  it('warns of the pool on tick 35 400 only, and moves into it on tick 36 000', () => {
    const world = createTestWorldInEras();
    expect(eraEffectsAt(world, POOL_WARNING_TICK - 1)).toEqual([]);
    expect(eraEffectsAt(world, POOL_WARNING_TICK)).toEqual([
      { kind: EFFECT_KIND.eraWarning, tick: POOL_WARNING_TICK, era: GAME_ERA.pool },
    ]);
    expect(eraEffectsAt(world, POOL_WARNING_TICK + 1)).toEqual([]);
    expect(eraEffectsAt(world, POOL_FIRST_TICK - 1)).toEqual([]);
    expect(world.eraMovedInto).toBe(GAME_ERA.dish);
    expect(eraEffectsAt(world, POOL_FIRST_TICK)).toEqual([
      { kind: EFFECT_KIND.eraMoved, tick: POOL_FIRST_TICK, era: GAME_ERA.pool },
    ]);
    expect(world.eraMovedInto).toBe(GAME_ERA.pool);
    expect(eraEffectsAt(world, POOL_FIRST_TICK + 1)).toEqual([]);
  });

  it('runs the pool’s move in the pool: each fragment it lays is tagged by the pool’s zone, never the dish’s', () => {
    const world = createTestWorldInEras();
    eraEffectsAt(world, POOL_FIRST_TICK);
    const zones = worldZoneMap(world);
    const tables = DEFAULT_BALANCE.ecology.DNA_FRAGMENT_TAG_TABLE_BY_ZONE;
    const zonesOfFragments = world.dnaFragments.map((fragment) => zoneAt(fragment, zones, DEFAULT_BALANCE));
    expect(zonesOfFragments).toContain(ZONE_ID.openBroth);
    for (const [index, fragment] of world.dnaFragments.entries()) {
      expect(Object.keys(tables[zonesOfFragments[index]!])).toContain(fragment.tag);
    }
  });

  it('then warns of the colonies and opens them in place, with no grace of their own', () => {
    const world = createTestWorldInEras();
    eraEffectsAt(world, POOL_FIRST_TICK);
    const poolGrace = world.moveGraceEndsAtTick;
    expect(eraEffectsAt(world, COLONIES_WARNING_TICK)).toEqual([
      { kind: EFFECT_KIND.eraWarning, tick: COLONIES_WARNING_TICK, era: GAME_ERA.colonies },
    ]);
    expect(eraEffectsAt(world, COLONIES_FIRST_TICK)).toEqual([
      { kind: EFFECT_KIND.eraMoved, tick: COLONIES_FIRST_TICK, era: GAME_ERA.colonies },
    ]);
    expect(world.eraMovedInto).toBe(GAME_ERA.colonies);
    expect(world.moveGraceEndsAtTick).toBe(poolGrace);
  });

  it('runs every crossed move on one tick, the pool’s first, when the clock is past both (a jump to the colonies)', () => {
    const world = createTestWorldInEras();
    expect(eraEffectsAt(world, COLONIES_FIRST_TICK)).toEqual([
      { kind: EFFECT_KIND.eraMoved, tick: COLONIES_FIRST_TICK, era: GAME_ERA.pool },
      { kind: EFFECT_KIND.eraMoved, tick: COLONIES_FIRST_TICK, era: GAME_ERA.colonies },
    ]);
    expect(world.eraMovedInto).toBe(GAME_ERA.colonies);
    expect(world.moveGraceEndsAtTick).not.toBeNull();
  });

  it('runs a move once: a later step in the same era moves nothing', () => {
    const world = createTestWorldInEras();
    eraEffectsAt(world, POOL_FIRST_TICK);
    expect(eraEffectsAt(world, POOL_FIRST_TICK + A_MINUTE_TICKS)).toEqual([]);
  });
});

describe('runEraMoves never fires in a round that does not reach an era', () => {
  it.each<[string, () => WorldState]>([
    ['the eras off (today’s game) in a 1 500 s round', () => createTestWorldInEras([GAME_ERA.dish])],
    ['every era in play in a 600 s round (PH5)', () => createTestWorldInEras(GAME_ERA_ORDER, DISH_ONLY_ROUND_SECONDS)],
  ])('%s: no warning, no move', (_label, buildWorld) => {
    const world = buildWorld();
    for (const tick of [POOL_WARNING_TICK, POOL_FIRST_TICK, COLONIES_WARNING_TICK, COLONIES_FIRST_TICK]) {
      expect(eraEffectsAt(world, tick), `tick ${tick}`).toEqual([]);
    }
    expect(world.eraMovedInto).toBe(GAME_ERA.dish);
  });
});
