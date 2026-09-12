import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BALANCE, ManualClock, TICK_INTERVAL_MS, type GameInput, type TraitOfferView } from '@evolution/shared';
import type { InputWorldContext } from './game-input-builder';
import { InputController } from './input-controller';
import { INPUT_ACTION } from './keyboard-action';

const OWN_CELL = { x: 10, y: 20, radiusWu: 4 };
const OFFER: TraitOfferView = {
  offerId: 5,
  cards: [
    { traitId: 'nucleoid', tier: 1 },
    { traitId: 'simple_flagellum', tier: 1 },
  ],
  expiresAtTick: 900,
};

function createHarness(worldOverrides: Partial<InputWorldContext> | null = {}) {
  const clock = new ManualClock();
  const sent: GameInput[] = [];
  const state = {
    world:
      worldOverrides === null
        ? null
        : {
            ownCell: OWN_CELL,
            offer: null,
            controls: DEFAULT_BALANCE.controls,
            appliedInputSequence: 0,
            ...worldOverrides,
          },
  };
  const onMenuKey = vi.fn();
  const controller = new InputController({
    clock,
    send: (input) => sent.push(input),
    screenToWorld: (point) => ({ x: point.x, y: point.y }),
    world: () => state.world,
    onMenuKey,
  });
  /** Moves the clock one client tick and runs one animation frame. */
  const tick = (ticks = 1): void => {
    clock.advanceMilliseconds(TICK_INTERVAL_MS * ticks);
    controller.pump();
  };
  return { clock, sent, state, controller, onMenuKey, tick };
}

describe('the input controller', () => {
  it('sends one input per client tick, with a monotonic sequence', () => {
    const harness = createHarness();
    harness.tick();
    harness.tick();
    expect(harness.sent.map((input) => input.sequence)).toEqual([1, 2]);
  });

  it('resumes above what the server has already applied, so a reconnect is not dropped as stale', () => {
    const harness = createHarness({ appliedInputSequence: 440 });
    harness.tick();
    harness.tick();
    expect(harness.sent.map((input) => input.sequence)).toEqual([441, 442]);
  });

  it('sends nothing before a frame is due', () => {
    const harness = createHarness();
    harness.controller.pump();
    expect(harness.sent).toEqual([]);
  });

  it('sends every tick a slow frame owed', () => {
    const harness = createHarness();
    harness.tick(3);
    expect(harness.sent).toHaveLength(3);
  });

  it('sends nothing while there is no world to steer in', () => {
    const harness = createHarness(null);
    harness.tick();
    expect(harness.sent).toEqual([]);
  });

  it('steers at the latched pointer in world units', () => {
    const harness = createHarness();
    harness.controller.pointerMovedTo({ x: 33, y: 44 });
    harness.tick();
    expect(harness.sent[0]).toMatchObject({ targetX: 33, targetY: 44 });
  });

  it('keeps the latched pointer after the pointer leaves the canvas', () => {
    const harness = createHarness();
    harness.controller.pointerMovedTo({ x: 33, y: 44 });
    harness.tick();
    harness.tick();
    expect(harness.sent[1]).toMatchObject({ targetX: 33, targetY: 44 });
  });

  it('sprints exactly once per press', () => {
    const harness = createHarness();
    harness.controller.apply({ kind: INPUT_ACTION.sprint });
    harness.tick();
    harness.tick();
    expect(harness.sent.map((input) => input.shouldSprint)).toEqual([true, false]);
  });

  it('sends one pick per offer, however often the key is pressed', () => {
    const harness = createHarness({ offer: OFFER });
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 0 });
    harness.tick();
    expect(harness.sent[0]?.traitChoice).toEqual({ offerId: 5, cardIndex: 1 });
    expect(harness.sent[1]?.traitChoice).toBeNull();
  });

  it('answers the next offer after the first was picked', () => {
    const harness = createHarness({ offer: OFFER });
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 0 });
    harness.tick();
    harness.state.world = {
      ownCell: OWN_CELL,
      offer: { ...OFFER, offerId: 6 },
      controls: DEFAULT_BALANCE.controls,
      appliedInputSequence: 0,
    };
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    expect(harness.sent[1]?.traitChoice).toEqual({ offerId: 6, cardIndex: 1 });
  });

  it('drops a card press that no offer can answer', () => {
    const harness = createHarness();
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    harness.state.world = {
      ownCell: OWN_CELL,
      offer: OFFER,
      controls: DEFAULT_BALANCE.controls,
      appliedInputSequence: 0,
    };
    harness.tick();
    expect(harness.sent[1]?.traitChoice).toBeNull();
  });

  it('reports the Tab hold to the HUD without sending anything for it', () => {
    const harness = createHarness();
    expect(harness.controller.isFullLeaderboardHeld()).toBe(false);
    harness.controller.apply({ kind: INPUT_ACTION.holdFullLeaderboard });
    expect(harness.controller.isFullLeaderboardHeld()).toBe(true);
    harness.controller.apply({ kind: INPUT_ACTION.releaseFullLeaderboard });
    expect(harness.controller.isFullLeaderboardHeld()).toBe(false);
  });

  it('hands Escape to its handler', () => {
    const harness = createHarness();
    harness.controller.apply({ kind: INPUT_ACTION.menuKey });
    expect(harness.onMenuKey).toHaveBeenCalledOnce();
  });

  it('releases the held keys when the window loses focus', () => {
    const harness = createHarness();
    harness.controller.apply({ kind: INPUT_ACTION.steer, direction: 'right', isPressed: true });
    harness.controller.releaseAllKeys();
    harness.tick();
    expect(harness.sent[0]).toMatchObject({ targetX: OWN_CELL.x, targetY: OWN_CELL.y });
  });

  it('reports what it last sent and what it holds, for the debug hook', () => {
    const harness = createHarness();
    harness.controller.pointerMovedTo({ x: 3, y: 4 });
    harness.controller.apply({ kind: INPUT_ACTION.steer, direction: 'down', isPressed: true });
    harness.controller.apply({ kind: INPUT_ACTION.menuKey });
    harness.tick();
    expect(harness.controller.debugState()).toMatchObject({
      heldSteerDirections: ['down'],
      isFullLeaderboardHeld: false,
      menuKeyPressCount: 1,
      pointerWorldPoint: { x: 3, y: 4 },
    });
    expect(harness.controller.debugState().lastSentInput?.sequence).toBe(1);
  });
});

describe('the keyboard steer target', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  it('wins over the latched pointer', () => {
    harness.controller.pointerMovedTo({ x: 900, y: 900 });
    harness.controller.apply({ kind: INPUT_ACTION.steer, direction: 'up', isPressed: true });
    harness.tick();
    const reachWu = DEFAULT_BALANCE.controls.STEER_FULL_THROTTLE_RADII * OWN_CELL.radiusWu;
    expect(harness.sent[0]).toMatchObject({ targetX: OWN_CELL.x, targetY: OWN_CELL.y - reachWu });
  });
});
