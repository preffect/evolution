// The Evolution module with the eras switched on through its own debug handle, so every patch is recorded and
// `debug_export_replay` reproduces the run (docs/game-design/phases.md §14.15: `ERAS_IN_PLAY` all three, seed 42).
// It steps the module tick by tick as the room does, drains each tick's effects as a broadcast would (so a row reads
// the tick's `era_warning` and `era_moved`) and hands the thread back between bursts (#262). Not a test file: the era
// integration tests import it.

import {
  EFFECT_KIND,
  GAME_ERA_ORDER,
  createTestSessionConfig,
  playerId,
  type GameEffect,
  type GameEra,
  type PlayerId,
} from '@evolution/shared';
import type { EvolutionDebugHandle } from '../game/debug/evolution-debug-handle.js';
import { createEvolutionModule, type EvolutionModule } from '../game/evolution-module.js';
import { drainBroadcastWindow } from '../game/world/broadcast-window.js';
import type { WorldState } from '../game/world/world-state.js';
import { createTestRoomInitOptions } from './builders.js';
import { yieldToEventLoop } from './event-loop.js';

/** §14.15's seed. */
export const ERA_TABLE_SEED = 42;
/** The one player every era row runs. */
export const ERA_PLAYER: PlayerId = playerId('alice');
/** The ticks a burst runs before the thread is handed back. */
const TICKS_PER_BURST = 600;
/** The balance key of the eras a game may reach: a patch is keyed by constant names. */
const ERAS_IN_PLAY_LEAF = 'ERAS_IN_PLAY';

export interface EraRoomOptions {
  readonly roundDurationSeconds: number;
  readonly erasInPlay?: readonly GameEra[];
  /** The roster, `ERA_PLAYER` alone by default. */
  readonly players?: readonly PlayerId[];
}

/** One tick's effects, as the broadcast that drains them would carry them. */
export type TickObserver = (world: WorldState, effects: readonly GameEffect[]) => void;

export interface EraRoom {
  readonly module: EvolutionModule;
  readonly world: WorldState;
  readonly handle: EvolutionDebugHandle;
  /** Every effect drained so far, in tick order. */
  readonly effects: GameEffect[];
  /** Steps until the world's tick is `tick`, calling `observe` after each step with that tick's effects. */
  stepTo(tick: number, observe?: TickObserver): Promise<void>;
}

/** A room of `players` (`ERA_PLAYER` alone by default) on seed 42, its round `roundDurationSeconds` long, `erasInPlay` patched on at tick 0. */
export function startEraRoom(options: EraRoomOptions): EraRoom {
  const config = createTestSessionConfig({
    seed: ERA_TABLE_SEED,
    roundDurationSeconds: options.roundDurationSeconds,
  });
  const module = createEvolutionModule(createTestRoomInitOptions(options.players ?? [ERA_PLAYER], { config }));
  const handle = module.getDebugHandle();
  handle.patchBalance({ eras: { [ERAS_IN_PLAY_LEAF]: [...(options.erasInPlay ?? GAME_ERA_ORDER)] } });
  const effects: GameEffect[] = [];
  const stepTo = async (tick: number, observe?: TickObserver): Promise<void> => {
    while (module.world.tick < tick) {
      module.reduceGameState();
      const drained = drainBroadcastWindow(module.world);
      effects.push(...drained);
      observe?.(module.world, drained);
      if (module.world.tick % TICKS_PER_BURST === 0) await yieldToEventLoop();
    }
  };
  return { module, world: module.world, handle, effects, stepTo };
}

/** The `era_moved` effects among `effects`, as `[tick, era]` pairs. */
export function eraMovesIn(effects: readonly GameEffect[]): [number, GameEra][] {
  return effects.flatMap((effect) =>
    effect.kind === EFFECT_KIND.eraMoved ? [[effect.tick, effect.era] as [number, GameEra]] : [],
  );
}
