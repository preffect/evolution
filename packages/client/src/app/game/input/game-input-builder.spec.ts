import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, type TraitOfferView } from '@evolution/shared';
import { buildGameInput, steerTargetFor, traitChoiceFor, type InputWorldContext } from './game-input-builder';
import { IDLE_INPUT_STATE, withAction, withPointerAt, type InputState } from './input-state';
import { INPUT_ACTION } from './keyboard-action';

const CONTROLS = DEFAULT_BALANCE.controls;
const OWN_CELL = { x: 100, y: 50, radiusWu: 4 };

function offer(overrides: Partial<TraitOfferView> = {}): TraitOfferView {
  return {
    offerId: 7,
    cards: [
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'simple_flagellum', tier: 1 },
    ],
    expiresAtTick: 600,
    ...overrides,
  };
}

function world(overrides: Partial<InputWorldContext> = {}): InputWorldContext {
  return { ownCell: OWN_CELL, offer: null, controls: CONTROLS, ...overrides };
}

function options(state: InputState, pointerWorldPoint: { x: number; y: number } | null = null, context = world()) {
  return { state, sequence: 3, world: context, pointerWorldPoint };
}

describe('steerTargetFor', () => {
  it('sends the pointer through as the target', () => {
    const state = withPointerAt(IDLE_INPUT_STATE, { x: 640, y: 400 });
    expect(steerTargetFor(options(state, { x: -12, y: 8 }))).toEqual({ x: -12, y: 8 });
  });

  it('synthesises a full-throttle target ahead of the cell for a held key', () => {
    const state = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.steer, direction: 'right', isPressed: true });
    const reachWu = CONTROLS.STEER_FULL_THROTTLE_RADII * OWN_CELL.radiusWu;
    expect(steerTargetFor(options(state, { x: -12, y: 8 }))).toEqual({ x: OWN_CELL.x + reachWu, y: OWN_CELL.y });
  });

  it('falls back to the pointer when a held key has no cell to steer from', () => {
    const state = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.steer, direction: 'right', isPressed: true });
    const target = steerTargetFor(options(state, { x: -12, y: 8 }, world({ ownCell: null })));
    expect(target).toEqual({ x: -12, y: 8 });
  });

  it('stands still on the cell itself when nothing steers it', () => {
    expect(steerTargetFor(options(IDLE_INPUT_STATE))).toEqual({ x: OWN_CELL.x, y: OWN_CELL.y });
  });

  it('points at the dish centre before there is a cell or a pointer', () => {
    expect(steerTargetFor(options(IDLE_INPUT_STATE, null, world({ ownCell: null })))).toEqual({ x: 0, y: 0 });
  });
});

describe('traitChoiceFor', () => {
  it('answers the open offer with the queued card', () => {
    const state = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    expect(traitChoiceFor(state, offer())).toEqual({ offerId: 7, cardIndex: 1 });
  });

  it('is null with no card queued', () => {
    expect(traitChoiceFor(IDLE_INPUT_STATE, offer())).toBeNull();
  });

  it('is null with no offer open', () => {
    const state = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.pickCard, cardIndex: 1 });
    expect(traitChoiceFor(state, null)).toBeNull();
  });

  it('drops a card the offer does not have', () => {
    const state = withAction(IDLE_INPUT_STATE, { kind: INPUT_ACTION.pickCard, cardIndex: 2 });
    expect(traitChoiceFor(state, offer())).toBeNull();
  });
});

describe('buildGameInput', () => {
  it('carries the sequence, the target, the sprint flag and the pick', () => {
    let state = withPointerAt(IDLE_INPUT_STATE, { x: 1, y: 2 });
    state = withAction(state, { kind: INPUT_ACTION.sprint });
    state = withAction(state, { kind: INPUT_ACTION.pickCard, cardIndex: 0 });
    const input = buildGameInput(options(state, { x: 20, y: 30 }, world({ offer: offer() })));
    expect(input).toEqual({
      sequence: 3,
      targetX: 20,
      targetY: 30,
      shouldSprint: true,
      traitChoice: { offerId: 7, cardIndex: 0 },
    });
  });

  it('sends no sprint and no pick when neither is queued', () => {
    const input = buildGameInput(options(IDLE_INPUT_STATE));
    expect(input.shouldSprint).toBe(false);
    expect(input.traitChoice).toBeNull();
  });
});
