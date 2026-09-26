// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, createTestTraitOfferView, type TraitOfferView } from '@evolution/shared';
import { buildGameInput, steerTargetFor, traitChoiceFor, type InputWorldContext } from './game-input-builder';
import { IDLE_INPUT_STATE, withAction, withPickQueued, withPointerAt, type InputState } from './input-state';
import { INPUT_ACTION } from './keyboard-action';
import type { PointerProjection } from '../render/render-session';

const CONTROLS = DEFAULT_BALANCE.controls;
const OWN_CELL = { x: 100, y: 50, radiusWu: 4 };

function offer(overrides: Partial<TraitOfferView> = {}): TraitOfferView {
  return createTestTraitOfferView({
    offerId: 7,
    cards: [
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'simple_flagellum', tier: 1 },
    ],
    expiresAtTick: 600,
    ...overrides,
  });
}

function world(overrides: Partial<InputWorldContext> = {}): InputWorldContext {
  return { ownCell: OWN_CELL, offer: null, controls: CONTROLS, appliedInputSequence: 0, ...overrides };
}

/**
 * A pointer the camera projects to `worldPoint`, sitting `offsetFromViewCentre` from the middle of
 * the view. The two disagree on purpose: the camera trails the authoritative cell, and the target
 * must follow the offset, not the projection.
 */
function pointerAt(offsetX: number, offsetY: number, cameraCentre = { x: -40, y: 25 }): PointerProjection {
  return {
    offsetFromViewCentre: { x: offsetX, y: offsetY },
    worldPoint: { x: cameraCentre.x + offsetX, y: cameraCentre.y + offsetY },
  };
}

function options(state: InputState, pointer: PointerProjection | null = null, context = world()) {
  return { state, sequence: 3, world: context, pointer };
}

describe('steerTargetFor', () => {
  it("hangs the pointer's offset on the own cell, not on the camera's projection of it", () => {
    const state = withPointerAt(IDLE_INPUT_STATE, { x: 640, y: 400 });
    expect(steerTargetFor(options(state, pointerAt(30, -18)))).toEqual({
      x: OWN_CELL.x + 30,
      y: OWN_CELL.y - 18,
    });
  });

  it('has no target without an own cell, whatever the pointer or the keys say (#346)', () => {
    const noCell = world({ ownCell: null });
    const pointed = withPointerAt(IDLE_INPUT_STATE, { x: 640, y: 400 });
    const steered = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.steer, direction: 'right', isPressed: true });
    expect(steerTargetFor(options(pointed, pointerAt(30, -18), noCell))).toBeNull();
    expect(steerTargetFor(options(steered, pointerAt(30, -18), noCell))).toBeNull();
    expect(steerTargetFor(options(IDLE_INPUT_STATE, null, noCell))).toBeNull();
  });

  it('synthesises a full-throttle target ahead of the cell for a held key', () => {
    const state = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.steer, direction: 'right', isPressed: true });
    const reachWu = CONTROLS.STEER_FULL_THROTTLE_RADII * OWN_CELL.radiusWu;
    expect(steerTargetFor(options(state, pointerAt(30, -18)))).toEqual({ x: OWN_CELL.x + reachWu, y: OWN_CELL.y });
  });

  it('stands still on the cell itself when nothing steers it', () => {
    expect(steerTargetFor(options(IDLE_INPUT_STATE))).toEqual({ x: OWN_CELL.x, y: OWN_CELL.y });
  });
});

describe('traitChoiceFor', () => {
  const queued = withPickQueued(IDLE_INPUT_STATE, { offerId: 7, cardIndex: 1, sentAtSequence: null });

  it('answers the offer the press was made against', () => {
    expect(traitChoiceFor(queued, world({ offer: offer() }))).toEqual({ offerId: 7, cardIndex: 1 });
  });

  it('is null with nothing queued', () => {
    expect(traitChoiceFor(IDLE_INPUT_STATE, world({ offer: offer() }))).toBeNull();
  });

  it('is null once the offer it answers is gone', () => {
    expect(traitChoiceFor(queued, world({ offer: null }))).toBeNull();
  });

  it('is null while the send is still in flight', () => {
    const sent = withPickQueued(IDLE_INPUT_STATE, { offerId: 7, cardIndex: 1, sentAtSequence: 9 });
    expect(traitChoiceFor(sent, world({ offer: offer(), appliedInputSequence: 8 }))).toBeNull();
  });
});

describe('buildGameInput', () => {
  it('carries the sequence, the target, the sprint flag and the pick', () => {
    let state = withPointerAt(IDLE_INPUT_STATE, { x: 1, y: 2 });
    state = withAction(state, { kind: INPUT_ACTION.sprint });
    state = withPickQueued(state, { offerId: 7, cardIndex: 0, sentAtSequence: null });
    const input = buildGameInput(options(state, pointerAt(20, 30), world({ offer: offer() })));
    expect(input).toEqual({
      sequence: 3,
      targetX: OWN_CELL.x + 20,
      targetY: OWN_CELL.y + 30,
      shouldSprint: true,
      traitChoice: { offerId: 7, cardIndex: 0 },
    });
  });

  it('sends no target and no sprint while spectating, but still the pick (#346)', () => {
    let state = withPointerAt(IDLE_INPUT_STATE, { x: 1, y: 2 });
    state = withAction(state, { kind: INPUT_ACTION.sprint });
    state = withPickQueued(state, { offerId: 7, cardIndex: 0, sentAtSequence: null });
    const input = buildGameInput(options(state, pointerAt(20, 30), world({ ownCell: null, offer: offer() })));
    expect(input).toEqual({
      sequence: 3,
      targetX: null,
      targetY: null,
      shouldSprint: false,
      traitChoice: { offerId: 7, cardIndex: 0 },
    });
  });

  it('sends no sprint and no pick when neither is queued', () => {
    const input = buildGameInput(options(IDLE_INPUT_STATE));
    expect(input.shouldSprint).toBe(false);
    expect(input.traitChoice).toBeNull();
  });
});
