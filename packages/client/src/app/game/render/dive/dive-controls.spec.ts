// @vitest-environment node
// The dive's controls (docs/rendering/opening-dive.md §5): play, pause and resume, scrub, skip, and reduced motion
// jumping straight to the stop. Every call takes its time as a plain number, so the specs are tables of moments.

import { describe, expect, it } from 'vitest';
import { DIVE_PHASE_STOPS, DIVE_PLAY_HOLD_MS, DIVE_ZOOM_BOTTOM, DIVE_ZOOM_TOP, type DivePhaseStop } from '../constants';
import { DIVE_FIRST_PHASE, DiveControls, diveEase, diveFallMs } from './dive-controls';

const DISH = DIVE_FIRST_PHASE;
const SHORE = DIVE_PHASE_STOPS[4] as DivePhaseStop;
const DIGITS = 9;

function playing(stop: DivePhaseStop = DISH): DiveControls {
  const controls = new DiveControls();
  controls.playPhase(stop, 0, false);
  return controls;
}

describe('diveEase', () => {
  it('is a cubic in-out: still at both ends, half way at the middle, symmetric', () => {
    expect(diveEase(0)).toBe(0);
    expect(diveEase(1)).toBe(1);
    expect(diveEase(0.5)).toBeCloseTo(0.5, DIGITS);
    expect(diveEase(0.25)).toBeCloseTo(1 - diveEase(0.75), DIGITS);
    expect(diveEase(0.25)).toBeCloseTo(4 * 0.25 ** 3, DIGITS);
  });

  it('clamps outside [0, 1]', () => {
    expect(diveEase(-1)).toBe(0);
    expect(diveEase(2)).toBe(1);
  });
});

describe('diveFallMs', () => {
  it('takes 900 ms per power of ten: phase 1 falls 11.7 steps in 10.53 s', () => {
    expect(diveFallMs(DISH)).toBeCloseTo((7.4 + 4.3) * 900, DIGITS);
  });
});

describe('DiveControls: a phase’s opening', () => {
  it('starts at the top, holds there, then falls to the stop and arrives', () => {
    const controls = playing();
    expect(controls.tick(0)).toBe(DIVE_ZOOM_TOP);
    expect(controls.tick(DIVE_PLAY_HOLD_MS)).toBe(DIVE_ZOOM_TOP);
    const middle = controls.tick(DIVE_PLAY_HOLD_MS + diveFallMs(DISH) / 2);
    expect(middle).toBeCloseTo((DIVE_ZOOM_TOP + DISH.zoom) / 2, DIGITS);
    expect(controls.stopReached).toBeNull();
    expect(controls.tick(DIVE_PLAY_HOLD_MS + diveFallMs(DISH))).toBe(DISH.zoom);
    expect(controls.isPlaying).toBe(false);
    expect(controls.stopReached).toBe(DISH);
  });

  it('shows the stop it plays toward before it arrives, for the flag’s colour', () => {
    const controls = playing(SHORE);
    expect(controls.stopShown).toBe(SHORE);
    expect(controls.stopReached).toBeNull();
  });

  it('jumps straight to the stop under reduced motion', () => {
    const controls = new DiveControls();
    controls.playPhase(SHORE, 0, true);
    expect(controls.isPlaying).toBe(false);
    expect(controls.zoom).toBe(SHORE.zoom);
    expect(controls.stopReached).toBe(SHORE);
  });

  it('restarts from the top when another phase is played mid-fall', () => {
    const controls = playing();
    controls.tick(5000);
    controls.playPhase(SHORE, 5000, false);
    expect(controls.zoom).toBe(DIVE_ZOOM_TOP);
    expect(controls.stopShown).toBe(SHORE);
  });
});

describe('DiveControls.togglePause', () => {
  it('holds the zoom while paused and never plays the paused span', () => {
    const controls = playing();
    const atPause = controls.tick(3000);
    controls.togglePause(3000);
    expect(controls.isPaused).toBe(true);
    expect(controls.tick(60_000)).toBe(atPause);
    controls.togglePause(60_000);
    expect(controls.isPaused).toBe(false);
    expect(controls.tick(60_000)).toBeCloseTo(atPause, DIGITS);
    const unpaused = playing();
    expect(controls.tick(61_000)).toBeCloseTo(unpaused.tick(4000), DIGITS);
  });

  it('does nothing while no opening plays', () => {
    const controls = new DiveControls();
    controls.togglePause(0);
    expect(controls.isPaused).toBe(false);
  });
});

describe('DiveControls.skip', () => {
  it('jumps a playing opening to its stop', () => {
    const controls = playing(SHORE);
    controls.tick(2000);
    expect(controls.skip()).toBe(true);
    expect(controls.zoom).toBe(SHORE.zoom);
    expect(controls.stopReached).toBe(SHORE);
  });

  it('leaves a paused opening and a still dive alone', () => {
    const paused = playing();
    paused.tick(2000);
    paused.togglePause(2000);
    const zoom = paused.zoom;
    expect(paused.skip()).toBe(false);
    expect(paused.zoom).toBe(zoom);
    expect(new DiveControls().skip()).toBe(false);
  });
});

describe('DiveControls.scrub', () => {
  it('stops the opening where the hand is, clears the flag and keeps to the range', () => {
    const controls = playing();
    controls.tick(2000);
    controls.scrub(-1);
    expect(controls.isPlaying).toBe(false);
    expect(controls.zoom).toBe(-1);
    expect(controls.tick(9000)).toBe(-1);
    expect(controls.stopShown).toBeNull();
    controls.scrub(-100);
    expect(controls.zoom).toBe(DIVE_ZOOM_BOTTOM);
  });

  it('clears an arrival’s flag', () => {
    const controls = new DiveControls();
    controls.playPhase(DISH, 0, true);
    controls.scrub(0);
    expect(controls.stopReached).toBeNull();
  });
});

describe('DiveControls.autoplay', () => {
  it('plays phase 1’s opening once, when its time comes', () => {
    const controls = new DiveControls();
    controls.scheduleAutoplay(900);
    controls.autoplay(899, false, true);
    expect(controls.isPlaying).toBe(false);
    controls.autoplay(900, false, true);
    expect(controls.stopShown).toBe(DISH);
    controls.scrub(0);
    controls.autoplay(5000, false, true);
    expect(controls.isPlaying).toBe(false);
  });

  it('never plays on its own under reduced motion, once cancelled, or once the dive has left the top', () => {
    const reduced = new DiveControls();
    reduced.scheduleAutoplay(0);
    reduced.autoplay(1, true, true);
    const cancelled = new DiveControls();
    cancelled.scheduleAutoplay(0);
    cancelled.cancelAutoplay();
    cancelled.autoplay(1, false, true);
    const moved = new DiveControls();
    moved.scheduleAutoplay(0);
    moved.scrub(3);
    moved.autoplay(1, false, true);
    for (const controls of [reduced, cancelled, moved]) expect(controls.isPlaying).toBe(false);
  });
});

describe('DiveControls: waiting and reduced motion', () => {
  it('holds the autoplay until the bands it falls through are ready, then plays it', () => {
    const controls = new DiveControls();
    controls.scheduleAutoplay(900);
    controls.autoplay(5000, false, false);
    expect(controls.isPlaying).toBe(false);
    controls.autoplay(9000, false, true);
    expect(controls.stopShown).toBe(DISH);
  });

  it('finishes a playing opening at its stop, paused or not, and leaves a still dive alone', () => {
    const paused = playing(SHORE);
    paused.tick(3000);
    paused.togglePause(3000);
    paused.finishPlay();
    expect(paused.isPlaying).toBe(false);
    expect(paused.zoom).toBe(SHORE.zoom);
    expect(paused.stopReached).toBe(SHORE);
    const still = new DiveControls();
    still.scrub(2);
    still.finishPlay();
    expect(still.zoom).toBe(2);
    expect(still.stopReached).toBeNull();
  });
});
