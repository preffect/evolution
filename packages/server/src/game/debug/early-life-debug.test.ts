// The debug surface of the early-life contract (docs/architecture/debug-mcp.md §8, docs/game-design/early-life.md
// §15.10, §15.11): `debug_get_entities` shows a cell's held list, and `debug_set_balance` moves the swallow switch on a
// real Evolution room while refusing a value that is no stage.

import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  ENTITY_KIND,
  FOOD_KIND,
  type BalanceConfig,
  type CellView,
} from '@evolution/shared';
import { registerBalanceTools } from '../../mcp/handlers/balance.js';
import { createActiveRoomFixture, parseToolJson } from '../../testing/builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { createEvolutionBotRoster } from '../bots/evolution-bots.js';
import { evolutionModuleFactory } from '../evolution-module.js';
import { ReplayRecorder } from '../replay/replay-recorder.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import type { BacteriumMoteRecord } from '../world/entities.js';
import { createInputRejectionCounters } from '../world/world-state.js';
import type { DebugEntity } from './debug-entities.js';
import { createEvolutionDebugHandle } from './evolution-debug-handle.js';

/** Where on the rim the held bacterium sits, past the wire's two decimals so the exact read shows. */
const HELD_BEARING_RADIANS = 1.2345;
/** A real balance path, named through a constant because a patch is keyed by constant names. */
const SWALLOW_LEAF = 'SWALLOW_FROM_STAGE';

/** A handle over a one-player test world; nobody joins or leaves in these tests. */
function createHandle() {
  const world = createTestWorld();
  const handle = createEvolutionDebugHandle({
    world,
    recorder: new ReplayRecorder(world),
    rejections: createInputRejectionCounters(),
    bots: createEvolutionBotRoster(world),
    membership: { addPlayer: () => false, removePlayer: () => false },
  });
  return { world, handle };
}

describe('debug_get_entities and the held list', () => {
  it("lists a cell's held bacteria on its entity by the mote's id, at full precision", () => {
    const { world, handle } = createHandle();
    const mote = spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: 'aerobic', at: { x: 5, y: 0 } });
    world.food = [];
    world.cells[0]!.latchedBacteria.push({
      mote: mote as BacteriumMoteRecord,
      bearingRadians: HELD_BEARING_RADIANS,
      caughtAtTick: world.tick,
    });
    const [cell] = handle.listEntities({ kind: ENTITY_KIND.cell }) as (DebugEntity & CellView)[];
    expect(cell?.latchedBacteria).toEqual([
      { moteId: mote.id, variant: 'aerobic', bearingRadians: HELD_BEARING_RADIANS, caughtAtTick: world.tick },
    ]);
    expect(handle.listEntities({ kind: ENTITY_KIND.foodMote })).toEqual([]);
  });
});

describe('debug_set_balance and the swallow switch', () => {
  it('moves the switch to eukaryote on the live copy and refuses "amoeba" and a number', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: evolutionModuleFactory });
    registerBalanceTools(fixture.mcp, fixture.context);
    const setSwitch = (value: unknown) =>
      fixture.call('debug_set_balance', { gameId: fixture.gameId, patch: { absorption: { [SWALLOW_LEAF]: value } } });
    const patched = parseToolJson(await setSwitch(CELL_STAGE.eukaryote)) as BalanceConfig;
    expect(patched.absorption.SWALLOW_FROM_STAGE).toBe(CELL_STAGE.eukaryote);
    for (const refused of ['amoeba', 3]) {
      expect((await setSwitch(refused)).isError).toBe(true);
    }
    const live = parseToolJson(await fixture.call('debug_get_balance', { gameId: fixture.gameId })) as BalanceConfig;
    expect(live.absorption.SWALLOW_FROM_STAGE).toBe(CELL_STAGE.eukaryote);
    expect(DEFAULT_BALANCE.absorption.SWALLOW_FROM_STAGE).toBe(CELL_STAGE.protocell);
    fixture.stop();
  });
});
