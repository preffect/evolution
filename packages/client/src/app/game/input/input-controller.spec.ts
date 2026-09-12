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

function worldWith(overrides: Partial<InputWorldContext> = {}): InputWorldContext {
  return { ownCell: OWN_CELL, offer: null, controls: DEFAULT_BALANCE.controls, appliedInputSequence: 0, ...overrides };
}

function createHarness(worldOverrides: Partial<InputWorldContext> | null = {}) {
  const clock = new ManualClock();
  const sent: GameInput[] = [];
  const state: { world: InputWorldContext | null } = {
    world: worldOverrides === null ? null : worldWith(worldOverrides),
  };
  const onMenuKey = vi.fn();
  const controller = new InputController({
    clock,
    send: (input) => sent.push(input),
    // A camera parked at the origin: the projection and the offset agree, so a test that does
    // not care about the anchoring can read the pointer straight out of the target.
    projectPointer: (point) => ({ worldPoint: { ...point }, offsetFromViewCentre: { ...point } }),
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

  it("steers at the pointer's offset from the own cell", () => {
    const harness = createHarness();
    harness.controller.pointerMovedTo({ x: 33, y: 44 });
    harness.tick();
    expect(harness.sent[0]).toMatchObject({ targetX: OWN_CELL.x + 33, targetY: OWN_CELL.y + 44 });
  });

  it('keeps the latched pointer after the pointer leaves the canvas', () => {
    const harness = createHarness();
    harness.controller.pointerMovedTo({ x: 33, y: 44 });
    harness.tick();
    harness.tick();
    expect(harness.sent[1]).toMatchObject({ targetX: OWN_CELL.x + 33, targetY: OWN_CELL.y + 44 });
  });

  it('sprints exactly once per press', () => {
    const harness = createHarness();
    harness.controller.apply({ kind: INPUT_ACTION.sprint });
    harness.tick();
    harness.tick();
    expect(harness.sent.map((input) => input.shouldSprint)).toEqual([true, false]);
  });

  it('sends the pick once while the send is still in flight', () => {
    const harness = createHarness({ offer: OFFER });
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    harness.tick();
    expect(harness.sent[0]?.traitChoice).toEqual({ offerId: 5, cardIndex: 1 });
    expect(harness.sent[1]?.traitChoice).toBeNull();
  });

  it('stops sending once the offer it answered has closed', () => {
    const harness = createHarness({ offer: OFFER });
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    harness.state.world = worldWith({ offer: null, appliedInputSequence: harness.sent[0]?.sequence ?? 0 });
    harness.tick();
    expect(harness.sent[1]?.traitChoice).toBeNull();
  });

  it('sends the pick again when the server answered past it and the offer is still open', () => {
    const harness = createHarness({ offer: OFFER });
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    harness.state.world = worldWith({ offer: OFFER, appliedInputSequence: harness.sent[0]?.sequence ?? 0 });
    harness.tick();
    expect(harness.sent[1]?.traitChoice).toEqual({ offerId: 5, cardIndex: 1 });
  });

  it('never spends a press on a later offer than the one it was made against', () => {
    const harness = createHarness({ offer: OFFER });
    // `3` on a two-card offer is unanswerable, so it is discarded where it was pressed...
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 2 });
    harness.tick();
    expect(harness.sent[0]?.traitChoice).toBeNull();
    // ...and a three-card offer opening next must not inherit it.
    const threeCards: TraitOfferView = {
      ...OFFER,
      offerId: 9,
      cards: [...OFFER.cards, { traitId: 'cell_wall', tier: 1 }],
    };
    harness.state.world = worldWith({ offer: threeCards });
    harness.tick();
    expect(harness.sent[1]?.traitChoice).toBeNull();
  });

  it('drops a card press made with no offer open', () => {
    const harness = createHarness();
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    harness.state.world = worldWith({ offer: OFFER });
    harness.tick();
    expect(harness.sent.every((input) => input.traitChoice === null)).toBe(true);
  });

  it('answers the next offer after the first was picked', () => {
    const harness = createHarness({ offer: OFFER });
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 0 });
    harness.tick();
    harness.state.world = worldWith({ offer: { ...OFFER, offerId: 6 } });
    harness.controller.apply({ kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    harness.tick();
    expect(harness.sent[1]?.traitChoice).toEqual({ offerId: 6, cardIndex: 1 });
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

  it('owes nothing for the time it had no world to steer in', () => {
    const harness = createHarness(null);
    harness.tick(600);
    harness.state.world = worldWith();
    harness.tick();
    expect(harness.sent).toHaveLength(1);
  });

  it('drops a press made while there was nothing to steer', () => {
    const harness = createHarness(null);
    harness.controller.apply({ kind: INPUT_ACTION.sprint });
    harness.tick();
    harness.state.world = worldWith();
    harness.tick();
    expect(harness.sent[0]?.shouldSprint).toBe(false);
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
      queuedPick: null,
      openOfferId: null,
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
