import { describe, expect, it } from 'vitest';
import { CELL_STATE, DEFAULT_BALANCE, MOTION_CLIPS, entityId, secondsToTicks } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { sprintFillFor } from '../../hud/format/sprint-fill';
import { SELF_RING_ALPHA } from '../constants';
import { REST_OWN_CELL_RING } from '../cells/self-ring';
import { OwnCellRingTracker, ownCellRingSourceOf, type OwnCellRingSource } from './own-cell-ring';

const OWN = entityId('own');
const COOLDOWN_TICKS = secondsToTicks(DEFAULT_BALANCE.controls.SPRINT_COOLDOWN_SECONDS);
/** The `sprint_ready` peak: 0.70 → 0.95 at 100 ms → 0.70 at 200 ms (docs/RENDERING.md §4). */
const READY_PEAK_MS = 100;
const READY_PEAK_BRIGHTNESS = 0.95;

function source(overrides: Partial<OwnCellRingSource> = {}): OwnCellRingSource {
  return { sprintFill: 1, isSprinting: false, escapePredatorCellId: null, ...overrides };
}

describe('ownCellRingSourceOf', () => {
  it('reads the fill through the record’s own sprintFillFor, and nothing without an own cell', () => {
    const cooling = createTestCellView({ id: OWN, sprintCooldownRemainingTicks: COOLDOWN_TICKS / 4 });
    expect(ownCellRingSourceOf(cooling, DEFAULT_BALANCE)).toEqual({
      sprintFill: sprintFillFor(cooling, DEFAULT_BALANCE.controls),
      isSprinting: false,
      escapePredatorCellId: null,
    });
    expect(ownCellRingSourceOf(cooling, DEFAULT_BALANCE)?.sprintFill).toBeCloseTo(0.75, 9);
    expect(ownCellRingSourceOf(null, DEFAULT_BALANCE)).toBeNull();
  });

  it('marks a sprint and names the predator only while being engulfed', () => {
    const sprinting = createTestCellView({ id: OWN, sprintRemainingTicks: 5 });
    expect(ownCellRingSourceOf(sprinting, DEFAULT_BALANCE)?.isSprinting).toBe(true);
    const held = createTestCellView({
      id: OWN,
      states: [CELL_STATE.beingEngulfed],
      engulfedByCellId: entityId('predator'),
    });
    expect(ownCellRingSourceOf(held, DEFAULT_BALANCE)?.escapePredatorCellId).toBe('predator');
    const released = createTestCellView({ id: OWN, engulfedByCellId: entityId('predator') });
    expect(ownCellRingSourceOf(released, DEFAULT_BALANCE)?.escapePredatorCellId).toBeNull();
  });
});

describe('OwnCellRingTracker', () => {
  it('rests without an own cell', () => {
    expect(new OwnCellRingTracker().update(null, null, 0)).toBe(REST_OWN_CELL_RING);
  });

  it('draws the recharged share while cooling and a full ring while sprinting', () => {
    const tracker = new OwnCellRingTracker();
    expect(tracker.update(OWN, source({ sprintFill: 0.3 }), 0)).toMatchObject({
      fill: 0.3,
      brightness: SELF_RING_ALPHA,
    });
    expect(tracker.update(OWN, source({ sprintFill: 0.3, isSprinting: true }), 16).fill).toBe(1);
  });

  it('plays sprint_ready on the frame the fill reaches ready: peak at 100 ms, back to rest at the end', () => {
    const tracker = new OwnCellRingTracker();
    tracker.update(OWN, source({ sprintFill: 0.98 }), 1000);
    expect(tracker.update(OWN, source(), 1016).brightness).toBeCloseTo(SELF_RING_ALPHA, 9);
    expect(tracker.update(OWN, source(), 1016 + READY_PEAK_MS).brightness).toBeCloseTo(READY_PEAK_BRIGHTNESS, 9);
    const end = 1016 + MOTION_CLIPS.sprint_ready.duration;
    expect(tracker.update(OWN, source(), end).brightness).toBe(SELF_RING_ALPHA);
  });

  it('never flashes on a cell’s first frame, a ready ring that stays ready, or the frame a sprint starts', () => {
    const tracker = new OwnCellRingTracker();
    tracker.update(OWN, source(), 0);
    expect(tracker.update(OWN, source(), READY_PEAK_MS).brightness).toBe(SELF_RING_ALPHA);
    tracker.update(OWN, source({ isSprinting: true }), 200);
    expect(tracker.update(OWN, source({ isSprinting: true }), 300).brightness).toBe(SELF_RING_ALPHA);
  });

  it('forgets the last fill when the own cell changes (a respawn), so the new cell does not flash', () => {
    const tracker = new OwnCellRingTracker();
    tracker.update(OWN, source({ sprintFill: 0.2 }), 0);
    tracker.update(entityId('respawned'), source(), 16);
    expect(tracker.update(entityId('respawned'), source(), 16 + READY_PEAK_MS).brightness).toBe(SELF_RING_ALPHA);
  });

  it('carries the escape’s predator through', () => {
    const escaping = source({ escapePredatorCellId: entityId('predator') });
    expect(new OwnCellRingTracker().update(OWN, escaping, 0).escapePredatorCellId).toBe('predator');
  });
});
