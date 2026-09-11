// The handle through its class and through the MCP tools of docs/ARCHITECTURE.md §8: every
// game-specific tool answers real data on the Evolution module.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ENTITY_KIND,
  FOOD_KIND,
  playerId,
  type BalanceConfig,
  type PlayerId,
} from '@evolution/shared';
import { DebugRequestError } from './debug-request-error.js';
import { registerBalanceTools } from '../../mcp/handlers/balance.js';
import { registerDeterminismTools } from '../../mcp/handlers/determinism.js';
import { registerEntityTools } from '../../mcp/handlers/entities.js';
import { registerPlayerTools } from '../../mcp/handlers/player.js';
import { registerSpawnTools } from '../../mcp/handlers/spawn.js';
import { createActiveRoomFixture, parseToolJson } from '../../testing/builders.js';
import { evolutionModuleFactory } from '../evolution-module.js';
import { ReplayRecorder } from '../replay/replay-recorder.js';
import type { Replay } from '../replay/replay-format.js';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { createInputRejectionCounters } from '../world/world-state.js';
import { computeStateHash } from '../world/state-hash.js';
import { createEvolutionBotRoster } from '../bots/evolution-bots.js';
import { addPlayerToWorld, removePlayerFromWorld } from '../session/membership.js';
import { createEvolutionDebugHandle, type DebugEntity } from './evolution-debug-handle.js';

const ALICE = playerId('p1');
/** A real balance path, named through a constant because a patch is keyed by constant names. */
const DISH_RADIUS_LEAF = 'DISH_RADIUS';

function createHandle() {
  const world = createTestWorld();
  const recorder = new ReplayRecorder(world);
  const rejections = createInputRejectionCounters();
  const membership = {
    addPlayer: (playerId: PlayerId, avatarIndex: number, playerName: string) => {
      addPlayerToWorld(world, { playerId, playerName, avatarIndex }, rejections);
    },
    removePlayer: (playerId: PlayerId) => {
      removePlayerFromWorld(world, playerId);
    },
  };
  const bots = createEvolutionBotRoster(world);
  const handle = createEvolutionDebugHandle({ world, recorder, rejections, bots, membership });
  return { world, recorder, rejections, handle };
}

describe('EvolutionDebugHandle', () => {
  it('lists every entity tagged by kind, filtered by kind and by an inclusive bbox', () => {
    const { world, handle } = createHandle();
    const cell = world.cells[0]!;
    cell.x = 0;
    cell.y = 0;
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: 50, y: 50 } });
    spawnDnaFragment(world, { at: { x: 500, y: 500 }, tag: 'motile', driftTurn: 0 });
    const all = handle.listEntities({});
    expect(all.map((entity) => entity.entityKind)).toEqual([
      ENTITY_KIND.cell,
      ENTITY_KIND.foodMote,
      ENTITY_KIND.dnaFragment,
    ]);
    expect(handle.listEntities({ kind: ENTITY_KIND.dnaFragment })).toHaveLength(1);
    const near = handle.listEntities({ bbox: { minX: 0, minY: 0, maxX: 50, maxY: 50 } });
    expect(near.map((entity) => entity.entityKind)).toEqual([ENTITY_KIND.cell, ENTITY_KIND.foodMote]);
    expect(() => handle.listEntities({ kind: 'npc' })).toThrow(DebugRequestError);
  });

  it('reports a player state with progress, cell, modifiers, stage, traits, queue and rejections', () => {
    const { world, handle, rejections } = createHandle();
    rejections.staleSequence = 2;
    const state = handle.getPlayerDebugState(ALICE) as Record<string, unknown>;
    expect(state).toMatchObject({
      stage: 'protocell',
      ownedTraits: [],
      offerQueue: [],
      rejections: { staleSequence: 2 },
    });
    expect((state.cell as { id: string }).id).toBe(world.cells[0]!.id);
    expect(state.modifiers).toEqual(world.cells[0]!.modifiers);
    expect(handle.getPlayerDebugState(playerId('nobody'))).toBeUndefined();
    world.cells = [];
    expect(handle.getPlayerDebugState(ALICE)).toMatchObject({ cell: null, modifiers: null, stage: null });
  });

  it('applies and records grants, spawns, player patches and balance patches', () => {
    const { world, handle, recorder } = createHandle();
    handle.grantDna(ALICE, { dna: 5 });
    handle.spawn({ kind: ENTITY_KIND.foodMote, x: 1, y: 1, params: {} });
    handle.setPlayer(ALICE, { mass: 60 });
    const balance = handle.patchBalance({ world: { [DISH_RADIUS_LEAF]: 2000 } }) as BalanceConfig;
    expect(balance.world.DISH_RADIUS).toBe(2000);
    expect(handle.getBalance()).toBe(world.balance);
    expect(recorder.export(world).debugPatches.map((entry) => entry.patch.kind)).toEqual([
      'grant_dna',
      'spawn',
      'set_player',
      'set_balance',
    ]);
  });

  it('does not record a refused patch', () => {
    const { world, handle, recorder } = createHandle();
    expect(() => handle.spawn({ kind: 'npc', x: 0, y: 0, params: {} })).toThrow(DebugRequestError);
    expect(recorder.export(world).debugPatches).toEqual([]);
  });

  it('seats a bot before the module holds it, and keeps nothing when the seat is refused', () => {
    const { world, handle } = createHandle();
    const seated: string[] = [];
    const bot = handle.spawnBot({ behavior: 'idle', seed: 1 }, (candidate) => {
      seated.push(candidate.playerId);
    });
    expect(seated).toEqual([bot.playerId]);
    expect(world.players.map((player) => player.playerId)).toEqual([ALICE, bot.playerId]);
    expect(() =>
      handle.spawnBot({ behavior: 'idle', seed: 1 }, () => {
        throw new DebugRequestError('seat taken');
      }),
    ).toThrow('seat taken');
    expect(world.players).toHaveLength(2);
    expect(handle.removeBot(bot.playerId)).toEqual(bot);
    expect(world.players.map((player) => player.playerId)).toEqual([ALICE]);
    expect(() => handle.removeBot(ALICE)).toThrow(DebugRequestError);
  });

  it('hashes the world, exports the replay and starts a new recording on reseed', () => {
    const { world, handle, recorder } = createHandle();
    expect(handle.computeStateHash()).toBe(computeStateHash(world));
    expect((handle.exportReplay() as Replay).seed).toBe(world.seed);
    handle.reseed(11);
    expect(world.seed).toBe(11);
    expect(recorder.completedRounds).toHaveLength(1);
    expect((handle.exportReplay() as Replay).seed).toBe(11);
  });
});

describe('the game-specific MCP tools on the Evolution module', () => {
  function evolutionFixture() {
    const fixture = createActiveRoomFixture({ gameFactory: evolutionModuleFactory });
    registerEntityTools(fixture.mcp, fixture.context);
    registerPlayerTools(fixture.mcp, fixture.context);
    registerSpawnTools(fixture.mcp, fixture.context);
    registerDeterminismTools(fixture.mcp, fixture.context);
    registerBalanceTools(fixture.mcp, fixture.context);
    return fixture;
  }

  it('debug_get_entities and debug_get_player_progress answer the world', async () => {
    const fixture = evolutionFixture();
    const cells = parseToolJson(
      await fixture.call('debug_get_entities', { gameId: fixture.gameId, kind: 'cell' }),
    ) as DebugEntity[];
    expect(cells).toHaveLength(1);
    const motes = parseToolJson(
      await fixture.call('debug_get_entities', { gameId: fixture.gameId, kind: 'food_mote' }),
    ) as DebugEntity[];
    expect(motes.length).toBeGreaterThan(0);
    const progress = parseToolJson(
      await fixture.call('debug_get_player_progress', { gameId: fixture.gameId, playerId: 'alice' }),
    );
    expect(progress).toMatchObject({ progress: { playerId: 'alice', level: 1 }, stage: 'protocell' });
    fixture.stop();
  });

  it('debug_spawn, debug_grant_dna and debug_set_player mutate the world', async () => {
    const fixture = evolutionFixture();
    const spawned = parseToolJson(
      await fixture.call('debug_spawn', {
        gameId: fixture.gameId,
        kind: 'dna_fragment',
        x: 3,
        y: 4,
        params: { tag: 'photic' },
      }),
    );
    expect(spawned).toMatchObject({ x: 3, y: 4, tag: 'photic' });
    const granted = parseToolJson(
      await fixture.call('debug_grant_dna', { gameId: fixture.gameId, playerId: 'alice', dna: 12 }),
    );
    expect(granted).toMatchObject({ dnaCumulative: 12 });
    const patched = parseToolJson(
      await fixture.call('debug_set_player', {
        gameId: fixture.gameId,
        playerId: 'alice',
        level: 3,
        traits: ['nucleoid'],
      }),
    );
    expect(patched).toMatchObject({ level: 3 });
    fixture.stop();
  });

  it('debug_set_seed, debug_get_state_hash and debug_export_replay answer real data', async () => {
    const fixture = evolutionFixture();
    expect(parseToolJson(await fixture.call('debug_set_seed', { gameId: fixture.gameId, seed: 5 }))).toEqual({
      gameId: fixture.gameId,
      seed: 5,
    });
    const hashed = parseToolJson(await fixture.call('debug_get_state_hash', { gameId: fixture.gameId })) as {
      hash: string;
    };
    expect(hashed.hash).toMatch(/^[0-9a-f]{16}$/);
    const exported = parseToolJson(await fixture.call('debug_export_replay', { gameId: fixture.gameId })) as Replay;
    expect(exported.seed).toBe(5);
    fixture.stop();
  });

  it('debug_get_balance and debug_set_balance read and patch the live copy, never the default', async () => {
    const fixture = evolutionFixture();
    const before = parseToolJson(await fixture.call('debug_get_balance', { gameId: fixture.gameId })) as BalanceConfig;
    expect(before.world.DISH_RADIUS).toBe(DEFAULT_BALANCE.world.DISH_RADIUS);
    const patched = parseToolJson(
      await fixture.call('debug_set_balance', {
        gameId: fixture.gameId,
        patch: { world: { [DISH_RADIUS_LEAF]: 2500 } },
      }),
    ) as BalanceConfig;
    expect(patched.world.DISH_RADIUS).toBe(2500);
    expect(DEFAULT_BALANCE.world.DISH_RADIUS).toBe(3000);
    fixture.stop();
  });
});
