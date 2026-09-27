// A trait tier tuned live (ticket #715; docs/architecture/debug-mcp.md §8 `debug_set_balance`): a player in a real
// `GameRoom` on the Evolution module owns cilia and a patch raises cilia tier I's speed. A paused room reads the new
// number on `debug_get_player_progress` at once (the patch refolds; step 1 would only refold on the next tick), and a
// running room's cell swims faster on the broadcast snapshot. Run with `./validate.sh integration`.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  TICK_INTERVAL_MS,
  createTestGameInput,
  createTestSessionConfig,
  playerId,
  type BalanceConfig,
  type GameSnapshot,
} from '@evolution/shared';
import { GameRoom } from '../../lobby/game-room.js';
import { createManualRoomTiming, createTestConnection, createTestRoomInitOptions } from '../../testing/builders.js';
import { createEvolutionModule } from '../evolution-module.js';
import type { SimulationDebugHandle } from './simulation-debug-handle.js';

const SEED = 42;
const SWIMMER = playerId('swimmer');
const CILIA = 'cilia';
/** A real balance path, named through a constant because a patch is keyed by constant names. */
const TIER_TABLES_LEAF = 'TRAIT_TIERS';
const TIER_I_ROW = 0;
const START = { x: 0, y: 0 };
/** Far enough east that the cell swims flat out for the whole run. */
const TARGET = { x: 2000, y: 0 };
const SWIM_TICKS = 60;
const TIER_I_SPEED = DEFAULT_BALANCE.traits.TRAIT_TIERS.cilia[TIER_I_ROW]!.speedMultiplier!;
const PATCHED_SPEED = 2;
const CILIA_SPEED_PATCH = {
  traits: { [TIER_TABLES_LEAF]: { [CILIA]: { [TIER_I_ROW]: { speedMultiplier: PATCHED_SPEED } } } },
};
/** The distance ratio may fall short of the speed ratio only by the acceleration ramp both runs share. */
const RAMP_SLACK = 0.9;

/** A running room whose swimmer owns cilia tier I at `START`, and the debug handle members the tests drive. */
function startRoom() {
  const options = createTestRoomInitOptions([SWIMMER], { config: createTestSessionConfig({ seed: SEED }) });
  const module = createEvolutionModule(options);
  const timing = createManualRoomTiming();
  const room = new GameRoom(module, options, timing);
  room.addPlayer(createTestConnection({ playerId: SWIMMER }));
  room.start();
  const handle = room.getDebugHandle();
  if (
    handle?.setPlayer === undefined ||
    handle.patchBalance === undefined ||
    handle.getPlayerDebugState === undefined
  ) {
    throw new Error('the Evolution debug handle implements setPlayer, patchBalance and getPlayerDebugState');
  }
  const debug = handle as Required<SimulationDebugHandle>;
  debug.setPlayer(SWIMMER, { traits: [CILIA], position: START });
  return {
    room,
    timing,
    patch: () => debug.patchBalance(CILIA_SPEED_PATCH) as BalanceConfig,
    speedMultiplier: () =>
      (debug.getPlayerDebugState(SWIMMER) as { modifiers: { speedMultiplier: number } }).modifiers.speedMultiplier,
  };
}

/** How far east the swimmer gets in `SWIM_TICKS`, read off the broadcast snapshot, with or without the tier patch. */
function swimDistance(isPatched: boolean): { distance: number; balance: BalanceConfig | undefined } {
  const { room, timing, patch } = startRoom();
  const balance = isPatched ? patch() : undefined;
  for (let sequence = 1; sequence <= SWIM_TICKS; sequence += 1) {
    room.submitInput(SWIMMER, createTestGameInput({ sequence, targetX: TARGET.x, targetY: TARGET.y }));
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    timing.ticker.fire();
  }
  const snapshot: GameSnapshot = room.getFullState().snapshot;
  const cell = snapshot.cells.find((candidate) => candidate.playerId === SWIMMER);
  room.stop();
  if (cell === undefined) throw new Error('the swimmer has a cell on the snapshot');
  return { distance: cell.x - START.x, balance };
}

describe('a trait tier patched live', () => {
  it('refolds at once: a paused room reads the new number before it steps', () => {
    const { room, patch, speedMultiplier } = startRoom();
    room.pause();
    expect(speedMultiplier()).toBe(TIER_I_SPEED);
    patch();
    expect(speedMultiplier()).toBe(PATCHED_SPEED);
    room.stop();
  });

  it('speeds up a cell that already owns the trait, and the balance the room sends carries the new number', () => {
    const unpatched = swimDistance(false);
    const patched = swimDistance(true);
    expect(unpatched.distance).toBeGreaterThan(0);
    expect(patched.distance / unpatched.distance).toBeGreaterThan((PATCHED_SPEED / TIER_I_SPEED) * RAMP_SLACK);
    // The room's balance is a clone of the aliased DEFAULT_BALANCE, so this holds without the re-alias; the re-alias is
    // pinned by the JSON round-trip unit test in balance-patch.test.ts.
    const catalogCilia = patched.balance?.traits.TRAIT_CATALOG.find((row) => row.id === CILIA);
    expect(catalogCilia?.tiers[TIER_I_ROW]?.speedMultiplier).toBe(PATCHED_SPEED);
  });
});
