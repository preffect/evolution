// The cross-module wiring of the sprint ring and the escape (docs/RENDERING.md §10, #295): the own
// view's cooldown reaches the own cell's packed `selfRingFill` through the renderer, the fill reaching
// ready plays `sprint_ready` into `selfRingBrightness` off the render clock, and while the own cell is
// being engulfed its predator's warning ring is packed as 0 while another threat keeps its ring.
// Frames come through the renderer's real contract, never its parts.

import { describe, expect, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  entityId,
  secondsToTicks,
  type CellView,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView, createTestRenderFrame } from '../../../testing/builders';
import { createFakePixiApp, createTestRenderTextures } from '../../../testing/fake-pixi-app';
import {
  CELL_INSTANCE_FLOATS,
  TEXEL_FLOATS,
  instanceFieldLocation,
  type CellInstanceScalar,
} from './cells/cell-instance';
import { SELF_RING_ALPHA } from './constants';
import { GameRenderer, NO_RETICLE, type RenderInputs } from './game-renderer';

const INPUTS: RenderInputs = { previewTraitId: null, reticle: NO_RETICLE };
const VIEWPORT = { width: 800, height: 600 };
const NO_SUBMIT = (): undefined => undefined;
const COOLDOWN_TICKS = secondsToTicks(DEFAULT_BALANCE.controls.SPRINT_COOLDOWN_SECONDS);
/** `sprint_ready`'s peak (docs/RENDERING.md §4). */
const READY_PEAK_MS = 100;

function renderer(): GameRenderer {
  const pixi = createFakePixiApp(VIEWPORT);
  return new GameRenderer(pixi.stage, createTestRenderTextures({ seed: 13, baker: pixi.textures }), VIEWPORT);
}

function packed(subject: GameRenderer, row: number, field: CellInstanceScalar): number {
  const [texel, channel] = instanceFieldLocation(field);
  return subject.cellInstances[row * CELL_INSTANCE_FLOATS + texel * TEXEL_FLOATS + channel] ?? Number.NaN;
}

function renderAt(subject: GameRenderer, nowMs: number, cells: readonly CellView[]): void {
  const frame = createTestRenderFrame({ timeSeconds: nowMs / MILLISECONDS_PER_SECOND, cells });
  subject.render(frame, TEST_OWN_PLAYER_ID, INPUTS, NO_SUBMIT);
}

describe('the sprint ring and the escape through the renderer', () => {
  it('packs the own cell’s recharged share, then brightens the ring as the cooldown ends', () => {
    const subject = renderer();
    const cooling = createTestCellView({ sprintCooldownRemainingTicks: COOLDOWN_TICKS / 2, radius: 20 });
    renderAt(subject, 0, [cooling]);
    expect(packed(subject, 0, 'isOwn')).toBe(1);
    expect(packed(subject, 0, 'selfRingFill')).toBeCloseTo(0.5, 6);
    expect(packed(subject, 0, 'selfRingBrightness')).toBeCloseTo(SELF_RING_ALPHA, 6);
    const ready = { ...cooling, sprintCooldownRemainingTicks: 0 };
    renderAt(subject, 1000, [ready]);
    expect(packed(subject, 0, 'selfRingFill')).toBe(1);
    renderAt(subject, 1000 + READY_PEAK_MS, [ready]);
    expect(packed(subject, 0, 'selfRingBrightness')).toBeCloseTo(0.95, 6);
    subject.destroy();
  });

  it('hides the engulfing predator’s warning ring while the own cell is held, and keeps another threat’s', () => {
    const subject = renderer();
    const predator = createTestCellView({ id: entityId('predator'), playerId: null, x: 30, mass: 200, radius: 40 });
    const bystander = createTestCellView({ id: entityId('bystander'), playerId: null, x: -60, mass: 220, radius: 42 });
    const held = createTestCellView({
      radius: 10,
      mass: 20,
      states: [CELL_STATE.beingEngulfed],
      engulfedByCellId: predator.id,
      engulfProgress: 0.2,
    });
    // Rows are radius ascending: the own cell, the predator, the bystander.
    renderAt(subject, 0, [held, predator, bystander]);
    expect(packed(subject, 1, 'warningRingPx')).toBe(0);
    expect(packed(subject, 2, 'warningRingPx')).toBeGreaterThan(0);
    renderAt(subject, 16, [{ ...held, states: [], engulfedByCellId: null, engulfProgress: 0 }, predator, bystander]);
    expect(packed(subject, 1, 'warningRingPx')).toBeGreaterThan(0);
    subject.destroy();
  });
});
