// The debug surface of the era clock (docs/architecture/debug-mcp.md §8, docs/game-design/phases.md §14.2.4):
// `debug_set_era` moves `roundStartTick`, never the tick counter, so the next step is the era's first tick (PH19: a
// jump at tick 600 to the pool gives −35 400); it refuses an era not in play, past the round, or not forward; it is
// recorded as a `debug_patch`; and `debug_set_balance` takes the era list and refuses era starts the clock cannot run on.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GAME_ERA,
  GAME_ERA_ORDER,
  ROUND_PHASE,
  createTestSessionConfig,
  eraAt,
  worldElapsedSeconds,
  withErasInPlay,
  type BalanceConfig,
  type GameEra,
} from '@evolution/shared';
import { registerBalanceTools } from '../../mcp/handlers/balance.js';
import { registerEraTools } from '../../mcp/handlers/eras.js';
import { createActiveRoomFixture, parseToolJson } from '../../testing/builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { createEvolutionBotRoster } from '../bots/evolution-bots.js';
import { evolutionModuleFactory, type EvolutionModule } from '../evolution-module.js';
import { DEBUG_PATCH_KIND, REPLAY_EVENT_KIND, type Replay } from '../replay/replay-format.js';
import { ReplayRecorder } from '../replay/replay-recorder.js';
import { runStep } from '../simulation/step.js';
import { createInputRejectionCounters, type WorldState } from '../world/world-state.js';
import { setEraForDebug } from './debug-era.js';
import type { BalancePatch } from './simulation-debug-handle.js';
import { DebugRequestError } from './debug-request-error.js';
import { applyDebugPatch, setBalanceForDebug } from './debug-operations.js';
import { createEvolutionDebugHandle } from './evolution-debug-handle.js';

/** The game's length with the colonies on (§14.2.3), so every era is reachable, and today's, which ends at the pool. */
const COLONIES_ON_ROUND_SECONDS = 1500;
const DISH_ONLY_ROUND_SECONDS = 600;
/** PH19: the jump at tick 600 to the pool (applied before that step) and the round start it leaves (600 − 36 000). */
const PH19_JUMP_TICK = 600;
const PH19_ROUND_START_TICK = -35_400;
/** The world's tick when a patch stamped for step 600 is applied. */
const TICK_BEFORE_THE_JUMP = PH19_JUMP_TICK - 1;
const COLONIES_FIRST_ELAPSED_TICKS = 61_200;
/** Real balance paths, named through constants because a patch is keyed by constant names. */
const ERAS_IN_PLAY_LEAF = 'ERAS_IN_PLAY';
const ERA_START_LEAF = 'ERA_START_SECONDS';
/** Pool starts no clock can run on: after the colonies' 1020 s; past the 600 s a round in the pool has played. */
const POOL_START_AFTER_THE_COLONIES_SECONDS = 1100;
const POOL_START_PAST_THE_ROUND_SECONDS = 700;
/** 36 000.3 ticks: between two ticks (the review's probe). */
const BETWEEN_TICKS_POOL_START_SECONDS = 600.005;

/** A test world at `tick` of a round of `roundDurationSeconds`, playing `erasInPlay`. */
function worldPlaying(
  erasInPlay: readonly GameEra[],
  tick = TICK_BEFORE_THE_JUMP,
  roundDurationSeconds = COLONIES_ON_ROUND_SECONDS,
): WorldState {
  const world = createTestWorld({ balance: withErasInPlay(erasInPlay) });
  world.config = createTestSessionConfig({ seed: world.seed, roundDurationSeconds });
  world.tick = tick;
  return world;
}

function eraOf(world: WorldState): GameEra {
  const roundSeconds = world.config.roundDurationSeconds;
  return eraAt(worldElapsedSeconds(world.tick, world.roundStartTick, roundSeconds), roundSeconds, world.balance);
}

function stepOnce(world: WorldState): void {
  runStep(world, world.balance, createInputRejectionCounters());
}

describe('setEraForDebug', () => {
  it('moves roundStartTick so the next step is the pool’s first tick, below zero early in a round (PH19)', () => {
    const world = worldPlaying(GAME_ERA_ORDER);
    expect(setEraForDebug(world, GAME_ERA.pool)).toEqual({
      era: GAME_ERA.pool,
      firstTick: PH19_JUMP_TICK,
      roundStartTick: PH19_ROUND_START_TICK,
    });
    expect(world.tick).toBe(TICK_BEFORE_THE_JUMP);
    expect(eraOf(world)).toBe(GAME_ERA.dish);
    stepOnce(world);
    expect(world.tick).toBe(PH19_JUMP_TICK);
    expect(eraOf(world)).toBe(GAME_ERA.pool);
    expect(world.roundPhase).toBe(ROUND_PHASE.playing);
  });

  it('jumps from the dish straight to the colonies, and from the pool on to them', () => {
    const fromDish = worldPlaying(GAME_ERA_ORDER);
    setEraForDebug(fromDish, GAME_ERA.colonies);
    expect(fromDish.roundStartTick).toBe(PH19_JUMP_TICK - COLONIES_FIRST_ELAPSED_TICKS);
    const fromPool = worldPlaying(GAME_ERA_ORDER);
    setEraForDebug(fromPool, GAME_ERA.pool);
    stepOnce(fromPool);
    setEraForDebug(fromPool, GAME_ERA.colonies);
    stepOnce(fromPool);
    expect(eraOf(fromPool)).toBe(GAME_ERA.colonies);
  });

  it.each<[string, () => WorldState, GameEra, RegExp]>([
    ['an era not in play', () => worldPlaying([GAME_ERA.dish]), GAME_ERA.pool, /"pool" is not in play/],
    [
      'an era the round ends before',
      () => worldPlaying([GAME_ERA.dish, GAME_ERA.pool], TICK_BEFORE_THE_JUMP, DISH_ONLY_ROUND_SECONDS),
      GAME_ERA.pool,
      /A round of 600 s ends before "pool" starts at 600 s/,
    ],
    ['the current era', () => worldPlaying(GAME_ERA_ORDER), GAME_ERA.dish, /only moves to a later era/],
  ])('refuses %s and changes nothing', (_label, buildWorld, era, reason) => {
    const world = buildWorld();
    const roundStartTick = world.roundStartTick;
    expect(() => setEraForDebug(world, era)).toThrow(reason);
    expect(() => setEraForDebug(world, era)).toThrow(DebugRequestError);
    expect(world.roundStartTick).toBe(roundStartTick);
  });

  it('refuses an earlier era once the pool has opened: no way back', () => {
    const world = worldPlaying(GAME_ERA_ORDER);
    setEraForDebug(world, GAME_ERA.pool);
    stepOnce(world);
    for (const era of [GAME_ERA.dish, GAME_ERA.pool]) {
      expect(() => setEraForDebug(world, era)).toThrow(/The round is in "pool": debug_set_era only moves/);
    }
  });

  it('refuses any jump once the round is over', () => {
    const world = worldPlaying(GAME_ERA_ORDER);
    world.roundPhase = ROUND_PHASE.results;
    expect(() => setEraForDebug(world, GAME_ERA.pool)).toThrow(/The round is over/);
  });

  it('is what applyDebugPatch runs for a recorded set_era', () => {
    const world = worldPlaying(GAME_ERA_ORDER);
    applyDebugPatch(world, { kind: DEBUG_PATCH_KIND.setEra, era: GAME_ERA.pool });
    expect(world.roundStartTick).toBe(PH19_ROUND_START_TICK);
  });
});

describe('setBalanceForDebug and the eras domain', () => {
  it('turns the pool on through the era list', () => {
    const world = createTestWorld();
    const patched = setBalanceForDebug(world, { eras: { [ERAS_IN_PLAY_LEAF]: [GAME_ERA.dish, GAME_ERA.pool] } });
    expect((patched as BalanceConfig).eras.ERAS_IN_PLAY).toEqual([GAME_ERA.dish, GAME_ERA.pool]);
  });

  it('refuses an era start that is not a whole number of ticks (600.005 s), so a jump never lands a tick early', () => {
    const world = createTestWorld();
    expect(() =>
      setBalanceForDebug(world, { eras: { [ERA_START_LEAF]: { [GAME_ERA.pool]: BETWEEN_TICKS_POOL_START_SECONDS } } }),
    ).toThrow(new DebugRequestError('The patch breaks the era clock: pool starts at 600.005 s, not on a whole tick'));
  });

  it('refuses era starts the clock cannot run on, naming the problem', () => {
    const world = createTestWorld();
    expect(() =>
      setBalanceForDebug(world, {
        eras: { [ERA_START_LEAF]: { [GAME_ERA.pool]: POOL_START_AFTER_THE_COLONIES_SECONDS } },
      }),
    ).toThrow(
      new DebugRequestError('The patch breaks the era clock: colonies starts at 1020 s, not after pool at 1100 s'),
    );
    expect(world.balance).toBe(DEFAULT_BALANCE);
  });
});

describe('setBalanceForDebug never takes a round back to an earlier era', () => {
  const inThePool = () => {
    const world = worldPlaying(GAME_ERA_ORDER);
    setEraForDebug(world, GAME_ERA.pool);
    stepOnce(world);
    return world;
  };

  it.each<[string, BalancePatch]>([
    ['taking the pool out of play', { eras: { [ERAS_IN_PLAY_LEAF]: [GAME_ERA.dish] } }],
    [
      'moving the pool’s start past the round’s time',
      { eras: { [ERA_START_LEAF]: { [GAME_ERA.pool]: POOL_START_PAST_THE_ROUND_SECONDS } } },
    ],
  ])('refuses %s once the round is in the pool', (_label, patch) => {
    const world = inThePool();
    const balance = world.balance;
    expect(() => setBalanceForDebug(world, patch)).toThrow(
      new DebugRequestError('The patch would take the round back from "pool" to "dish"'),
    );
    expect(world.balance).toBe(balance);
  });

  it('takes the same patch while the round is still in the dish', () => {
    const world = worldPlaying(GAME_ERA_ORDER);
    setBalanceForDebug(world, { eras: { [ERAS_IN_PLAY_LEAF]: [GAME_ERA.dish] } });
    expect(world.balance.eras.ERAS_IN_PLAY).toEqual([GAME_ERA.dish]);
  });
});

describe('the Evolution handle records the jump', () => {
  it('as a debug_patch stamped for the next step', () => {
    const world = worldPlaying(GAME_ERA_ORDER);
    const recorder = new ReplayRecorder(world);
    const handle = createEvolutionDebugHandle({
      world,
      recorder,
      rejections: createInputRejectionCounters(),
      bots: createEvolutionBotRoster(world),
      membership: { addPlayer: () => false, removePlayer: () => false },
    });
    handle.setEra(GAME_ERA.pool);
    const events = (handle.exportReplay() as Replay).events.filter(
      (event) => event.kind === REPLAY_EVENT_KIND.debugPatch,
    );
    expect(events).toEqual([
      {
        tick: PH19_JUMP_TICK,
        kind: REPLAY_EVENT_KIND.debugPatch,
        patch: { kind: DEBUG_PATCH_KIND.setEra, era: GAME_ERA.pool },
      },
    ]);
  });
});

describe('debug_set_balance and debug_set_era on a real Evolution room', () => {
  it('takes the era list, then jumps to the pool; refuses the dish after it', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: evolutionModuleFactory });
    registerBalanceTools(fixture.mcp, fixture.context);
    registerEraTools(fixture.mcp, fixture.context);
    const { world } = fixture.gameModule as EvolutionModule;
    world.config = { ...world.config, roundDurationSeconds: COLONIES_ON_ROUND_SECONDS };
    const setEra = (era: string) => fixture.call('debug_set_era', { gameId: fixture.gameId, era });
    const refusal = (text: string) => ({
      isError: true,
      content: [expect.objectContaining({ text: expect.stringContaining(text) })],
    });
    expect(await setEra(GAME_ERA.pool)).toMatchObject(refusal('"pool" is not in play'));
    const patch = { eras: { [ERAS_IN_PLAY_LEAF]: [GAME_ERA.dish, GAME_ERA.pool] } };
    const patched = parseToolJson(await fixture.call('debug_set_balance', { gameId: fixture.gameId, patch }));
    expect((patched as BalanceConfig).eras.ERAS_IN_PLAY).toEqual([GAME_ERA.dish, GAME_ERA.pool]);
    const jump = parseToolJson(await setEra(GAME_ERA.pool));
    expect(jump).toMatchObject({ era: GAME_ERA.pool, roundStartTick: world.roundStartTick });
    fixture.room.step(1);
    expect(eraOf(world)).toBe(GAME_ERA.pool);
    expect(await setEra(GAME_ERA.dish)).toMatchObject(refusal('The round is in "pool"'));
    fixture.stop();
  });
});
