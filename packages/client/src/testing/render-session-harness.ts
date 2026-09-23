// A `RenderSession` over a fake Pixi app, and the messages and waits its specs drive it with
// (`render-session.spec.ts`, `render-session-build.spec.ts`). A session builds its renderer one bake per ticker
// frame (ticket #479), so `settle` ticks until every queued build is in.

import { vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  type FoodMoteView,
  type ServerMessage,
} from '@evolution/shared';
import { NO_HUD_INPUTS } from '../app/game/render/game-renderer';
import { RenderSession, type RenderSessionDependencies } from '../app/game/render/render-session';
import { TEST_OWN_PLAYER_ID, createTestCellView } from './builders';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from './fake-pixi-app';

export function gameState(seed = 1): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: gameId('g'),
    playerId: TEST_OWN_PLAYER_ID,
    snapshot: createTestSnapshot({ seed, cells: [createTestCellView()] }),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig(),
    playerIds: [TEST_OWN_PLAYER_ID],
    avatarAssignments: {},
  };
}

export function renderSessionUnderTest(overrides: Partial<RenderSessionDependencies> = {}) {
  const clock = new ManualClock(0);
  const pixi: FakePixiApp = createFakePixiApp();
  const audio = {
    ready: Promise.resolve(),
    observe: vi.fn(),
    updateOptions: vi.fn(),
    unlock: vi.fn(),
    disconnect: vi.fn(),
  };
  const acknowledgeSnapshot = vi.fn();
  const dependencies: RenderSessionDependencies = {
    host: document.createElement('div'),
    acknowledgeSnapshot,
    clock,
    devicePixelRatio: 1,
    createPixiApp: vi.fn(() => Promise.resolve(pixi)),
    connectAudio: vi.fn(() => audio),
    hudInputs: () => NO_HUD_INPUTS,
    shouldPreserveDrawingBuffer: false,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    ...overrides,
  };
  const subject = new RenderSession(dependencies);
  return { subject, clock, pixi, audio, dependencies, acknowledgeSnapshot };
}

export function snapshotMessage(tick: number, spawned: FoodMoteView[] = [], seed = 1): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameSnapshot,
    snapshot: createTestSnapshot({
      tick,
      seed,
      cells: [createTestCellView()],
      food: { spawned, removedIds: [], moved: [] },
    }),
  };
}

/**
 * Enough microtask turns for a message's promise chain to have run: the Pixi app's creation, the renderer queue's
 * `then`, and a build's resolution each queue behind the one before (a timer would do it in one, but game-side
 * test support keeps to the injected clock, docs/CODE-STANDARDS.md §8).
 */
const MICROTASK_FLUSHES = 20;

export async function flush(): Promise<void> {
  for (let turn = 0; turn < MICROTASK_FLUSHES; turn += 1) await Promise.resolve();
}

/** The ticker's frames run a staged build one bake at a time (ticket #479): tick until every queued build is in. */
export async function settle(subject: RenderSession, pixi: FakePixiApp): Promise<void> {
  for (let frame = 0; frame < SETTLE_FRAMES_MAX; frame += 1) {
    await flush();
    if (!subject.isBuildingRenderer) return;
    pixi.tick();
  }
  throw new Error(`The renderer build did not settle in ${SETTLE_FRAMES_MAX} frames.`);
}

export const SETTLE_FRAMES_MAX = 100;
