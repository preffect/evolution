import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { SERVER_MESSAGE_TYPE, type StateHash } from '@evolution/shared';
import { DebugRequestError } from '../../game/debug/debug-request-error.js';
import { createActiveRoomFixture, createDebugCapableGameModule, parseToolJson } from '../../testing/builders.js';
import {
  GAME_ID_ARGUMENT,
  registerCapabilityTool,
  requireRoom,
  runDebugRequest,
  type CapabilityToolDefinition,
} from './capability-tool.js';

const TOOL_NAME = 'debug_probe';
const PROBE_SCHEMA = { gameId: GAME_ID_ARGUMENT, extra: z.string().optional() };
type ProbeRun = CapabilityToolDefinition<'computeStateHash', typeof PROBE_SCHEMA>['run'];

function registerProbe(
  fixture: ReturnType<typeof createActiveRoomFixture>,
  run: ProbeRun = () => 'ok',
  isWorldMutation = false,
) {
  registerCapabilityTool(fixture.mcp, fixture.context, {
    name: TOOL_NAME,
    description: 'probe',
    capability: 'computeStateHash',
    schema: PROBE_SCHEMA,
    run,
    isWorldMutation,
  });
}

function snapshotsSentTo(fixture: ReturnType<typeof createActiveRoomFixture>, playerId: string): number {
  return fixture.sent[playerId]!.filter(
    (message) => (message as { type: string }).type === SERVER_MESSAGE_TYPE.gameSnapshot,
  ).length;
}

function hashingHandle() {
  return { computeStateHash: vi.fn(() => 'abc' as StateHash) };
}

describe('registerCapabilityTool', () => {
  it('runs the tool against the handle when the module offers the capability', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(hashingHandle()) });
    registerProbe(fixture, (handle, input, room) => ({
      hash: handle.computeStateHash(),
      gameId: input.gameId,
      isRoom: room === fixture.room,
    }));
    const result = await fixture.call(TOOL_NAME, { gameId: fixture.gameId });
    expect(parseToolJson(result)).toEqual({ hash: 'abc', gameId: fixture.gameId, isRoom: true });
    fixture.stop();
  });

  it('answers "not supported" when the module has no debug handle', async () => {
    const fixture = createActiveRoomFixture();
    registerProbe(fixture);
    const result = await fixture.call(TOOL_NAME, { gameId: fixture.gameId });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('not supported by this game module') });
    fixture.stop();
  });

  it('answers "not supported" when the handle lacks that one capability', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule({ spawn: vi.fn() }) });
    registerProbe(fixture);
    const result = await fixture.call(TOOL_NAME, { gameId: fixture.gameId });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('"computeStateHash"') });
    fixture.stop();
  });

  it('is an error for an unknown game', async () => {
    const fixture = createActiveRoomFixture();
    registerProbe(fixture);
    expect((await fixture.call(TOOL_NAME, { gameId: 'nope' })).isError).toBe(true);
    fixture.stop();
  });

  it('republishes the paused room’s frame after a mutating tool without stepping', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(hashingHandle()) });
    fixture.room.pause();
    registerProbe(fixture, () => 'written', true);
    await fixture.call(TOOL_NAME, { gameId: fixture.gameId });
    expect(snapshotsSentTo(fixture, 'alice')).toBe(1);
    expect(fixture.room.getTickCount()).toBe(0);
    fixture.stop();
  });

  it('does not republish after a read', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(hashingHandle()) });
    fixture.room.pause();
    registerProbe(fixture, () => 'read');
    await fixture.call(TOOL_NAME, { gameId: fixture.gameId });
    expect(snapshotsSentTo(fixture, 'alice')).toBe(0);
    fixture.stop();
  });

  it('does not republish after a refused mutation', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(hashingHandle()) });
    fixture.room.pause();
    registerProbe(
      fixture,
      () => {
        throw new DebugRequestError('refused');
      },
      true,
    );
    expect((await fixture.call(TOOL_NAME, { gameId: fixture.gameId })).isError).toBe(true);
    expect(snapshotsSentTo(fixture, 'alice')).toBe(0);
    fixture.stop();
  });

  it('turns a refused request into an error result', async () => {
    const fixture = createActiveRoomFixture({ gameFactory: () => createDebugCapableGameModule(hashingHandle()) });
    registerProbe(fixture, () => {
      throw new DebugRequestError('no such thing');
    });
    expect(await fixture.call(TOOL_NAME, { gameId: fixture.gameId })).toEqual({
      content: [{ type: 'text', text: 'no such thing' }],
      isError: true,
    });
    fixture.stop();
  });
});

describe('runDebugRequest', () => {
  it('lets an unexpected error propagate: it is a bug, not a refusal', () => {
    expect(() =>
      runDebugRequest(() => {
        throw new TypeError('bug');
      }),
    ).toThrow(TypeError);
  });
});

describe('requireRoom', () => {
  it('finds an active room and rejects a pending or unknown one', () => {
    const fixture = createActiveRoomFixture();
    expect(requireRoom(fixture.context, fixture.gameId).room).toBe(fixture.room);
    expect(requireRoom(fixture.context, 'nope').result?.isError).toBe(true);
    fixture.stop();
  });
});
