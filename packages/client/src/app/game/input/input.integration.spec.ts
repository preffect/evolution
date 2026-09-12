// The input path end to end (docs/TESTING.md §2.2): a real pointer event and a real key press on
// the composed game, through the camera and the client tick, to the `player_input` the multiplayer
// service would send. What each piece decides is unit-tested; this pins that they are wired.

import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  ManualClock,
  SERVER_MESSAGE_TYPE,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  createTestSnapshot,
  gameId,
  type GameInput,
  type ServerMessage,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView } from '../../../testing/builders';
import { createFakePixiApp } from '../../../testing/fake-pixi-app';
import { EVOLUTION_DEBUG_KEY, type EvolutionDebugHost } from '../debug/evolution-debug';
import { setupGame, type GameTeardown } from '../game-setup';
import { SPRINT_KEY_CODE } from './input-constants';

const OWN_CELL = createTestCellView({ playerId: TEST_OWN_PLAYER_ID, x: 0, y: 0, radius: 4 });
const HOST_BOX = { left: 0, top: 0, width: 1280, height: 720 };

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createHost(): HTMLElement {
  const host = document.createElement('div');
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    ...HOST_BOX,
    right: HOST_BOX.width,
    bottom: HOST_BOX.height,
    x: HOST_BOX.left,
    y: HOST_BOX.top,
    toJSON: () => ({}),
  });
  document.body.append(host);
  return host;
}

function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { clientX, clientY, button: 0 });
  return event;
}

function gameState(): ServerMessage {
  return {
    type: SERVER_MESSAGE_TYPE.gameState,
    gameId: gameId('g'),
    playerId: TEST_OWN_PLAYER_ID,
    snapshot: createTestSnapshot({ cells: [OWN_CELL] }),
    balance: DEFAULT_BALANCE,
    config: createTestSessionConfig(),
    playerIds: [TEST_OWN_PLAYER_ID],
    avatarAssignments: {},
  };
}

interface Harness {
  readonly host: HTMLElement;
  readonly sent: GameInput[];
  readonly debugHost: EvolutionDebugHost;
  readonly pixi: ReturnType<typeof createFakePixiApp>;
  frame(): void;
  teardown: GameTeardown;
}

async function startGame(): Promise<Harness> {
  const clock = new ManualClock(0);
  const host = createHost();
  const sent: GameInput[] = [];
  const messages$ = new Subject<ServerMessage>();
  const pixi = createFakePixiApp({ width: HOST_BOX.width, height: HOST_BOX.height });
  const debugHost: EvolutionDebugHost = {};
  const audio = {
    ready: Promise.resolve(),
    observe: vi.fn(),
    updateOptions: vi.fn(),
    unlock: vi.fn(),
    disconnect: vi.fn(),
  };
  const teardown = setupGame(
    { send: (input) => sent.push(input), messages$, host },
    {
      clock,
      connectAudio: () => audio,
      createPixiApp: () => Promise.resolve(pixi),
      devicePixelRatio: 1,
      debugHost,
      isDevMode: true,
      previewTraitId: () => null,
      isReticleVisible: () => true,
    },
  );
  messages$.next(gameState());
  await flush();
  return {
    host,
    sent,
    debugHost,
    pixi,
    frame: () => {
      clock.advanceMilliseconds(TICK_INTERVAL_MS);
      pixi.tick();
    },
    teardown,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('the wired input path', () => {
  it('turns a pointer over the canvas into a world-space steer target', async () => {
    const harness = await startGame();
    // Half a screen right of centre: the camera is parked on the own cell at the origin.
    harness.host.dispatchEvent(pointerEvent('pointermove', HOST_BOX.width * 0.75, HOST_BOX.height / 2));
    harness.frame();
    const input = harness.sent.at(-1);
    expect(input?.targetX).toBeGreaterThan(0);
    expect(input?.targetY).toBeCloseTo(0);
    harness.teardown();
  });

  it('turns a click on the canvas into one sprint', async () => {
    const harness = await startGame();
    harness.host.dispatchEvent(pointerEvent('pointerdown', HOST_BOX.width / 2, HOST_BOX.height / 2));
    harness.frame();
    harness.frame();
    expect(harness.sent.map((input) => input.shouldSprint)).toEqual([true, false]);
    harness.teardown();
  });

  it('turns Space into one sprint', async () => {
    const harness = await startGame();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: SPRINT_KEY_CODE, bubbles: true, cancelable: true }));
    harness.frame();
    expect(harness.sent.at(-1)?.shouldSprint).toBe(true);
    harness.teardown();
  });

  it('steers with W without a pointer ever touching the canvas', async () => {
    const harness = await startGame();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true, cancelable: true }));
    harness.frame();
    const reachWu = DEFAULT_BALANCE.controls.STEER_FULL_THROTTLE_RADII * OWN_CELL.radius;
    expect(harness.sent.at(-1)).toMatchObject({ targetX: 0, targetY: -reachWu });
    harness.teardown();
  });

  it('reports the hotkeys through the debug hook', async () => {
    const harness = await startGame();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
    expect(harness.debugHost[EVOLUTION_DEBUG_KEY]?.input?.()).toMatchObject({
      isFullLeaderboardHeld: true,
      menuKeyPressCount: 1,
    });
    harness.teardown();
  });

  it('stops sending once the game is torn down', async () => {
    const harness = await startGame();
    harness.frame();
    const sentWhileLive = harness.sent.length;
    harness.teardown();
    harness.host.dispatchEvent(pointerEvent('pointermove', HOST_BOX.width, HOST_BOX.height));
    harness.frame();
    expect(harness.sent).toHaveLength(sentWhileLive);
  });
});
