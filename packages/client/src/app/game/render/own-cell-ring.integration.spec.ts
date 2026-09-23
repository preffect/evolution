// The cross-module wiring of the sprint ring and the escape (docs/rendering/own-cell-indicators.md §10, #295, #187): the
// HUD's own-cell record reaches the own cell's packed `selfRingFill` through the renderer, the fill reaching ready
// plays `sprint_ready` into `selfRingBrightness` off the render clock, and while the own cell is being engulfed the
// escape arc replaces the engulfing predator's warning ring — the bystanders keep theirs — until the release, when
// the predator's ring comes back. Frames and the record come through the renderer's real contract, never its parts.

import { describe, expect, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  MILLISECONDS_PER_SECOND,
  MOTION_CLIPS,
  createTestPlayerProgressView,
  entityId,
  secondsToTicks,
  type CellView,
} from '@evolution/shared';
import { TEST_OWN_PLAYER_ID, createTestCellView, createTestRenderFrame } from '../../../testing/builders';
import { createFakeCueText } from '../../../testing/fake-cue-text';
import { createFakeIndicatorText } from '../../../testing/fake-indicator-text';
import { createFakePixiApp, createTestRenderTextures } from '../../../testing/fake-pixi-app';
import { peakKeyframe } from '../../../testing/motion-keyframes';
import { ownCellIndicatorsFor } from '../state/own-cell-indicators';
import {
  CELL_INSTANCE_FLOATS,
  TEXEL_FLOATS,
  instanceFieldLocation,
  type CellInstanceScalar,
} from './cells/cell-instance';
import { SELF_RING_ALPHA } from './constants';
import { SHOULD_HIDE_PREDATOR_RING_DURING_ESCAPE } from './effects/own-cell-ring';
import { OWN_CELL_CHROME } from './effects/own-cell-indicators-layer';
import { GameRenderer, NO_HUD_INPUTS, type RenderInputs } from './game-renderer';

const VIEWPORT = { width: 800, height: 600 };
const NO_SUBMIT = (): undefined => undefined;
const COOLDOWN_TICKS = secondsToTicks(DEFAULT_BALANCE.controls.SPRINT_COOLDOWN_SECONDS);
/** `sprint_ready`'s peak, read from the clip table (docs/rendering/contents-and-motion.md §4). */
const READY_PEAK = peakKeyframe(MOTION_CLIPS.sprint_ready.tracks['selfRingBrightness']);

function renderer(): GameRenderer {
  const pixi = createFakePixiApp(VIEWPORT);
  const textures = createTestRenderTextures({ seed: 13, baker: pixi.textures });
  const subject = new GameRenderer(pixi.stage, textures, VIEWPORT);
  subject.useIndicatorText(createFakeIndicatorText().factory);
  subject.useCueText(createFakeCueText().factory);
  return subject;
}

function packed(subject: GameRenderer, row: number, field: CellInstanceScalar): number {
  const [texel, channel] = instanceFieldLocation(field);
  return subject.cellInstances[row * CELL_INSTANCE_FLOATS + texel * TEXEL_FLOATS + channel] ?? Number.NaN;
}

/** The HUD's inputs for this own view: the record `GameStateService` derives from it. */
function inputsFor(ownCell: CellView): RenderInputs {
  const ownCellIndicators = ownCellIndicatorsFor({
    ownCell,
    ownProgress: createTestPlayerProgressView(),
    balance: DEFAULT_BALANCE,
    threats: [],
    previewTraitId: null,
  });
  return { ...NO_HUD_INPUTS, ownCellIndicators };
}

function renderAt(subject: GameRenderer, nowMs: number, cells: readonly CellView[]): void {
  const frame = createTestRenderFrame({ timeSeconds: nowMs / MILLISECONDS_PER_SECOND, cells });
  subject.render(frame, TEST_OWN_PLAYER_ID, inputsFor(cells[0]!), NO_SUBMIT);
}

describe('the sprint ring and the escape through the renderer', () => {
  it('packs the own cell’s recharged share from the record, then brightens the ring as the cooldown ends', () => {
    const subject = renderer();
    const cooling = createTestCellView({ sprintCooldownRemainingTicks: COOLDOWN_TICKS / 2, radius: 20 });
    renderAt(subject, 0, [cooling]);
    expect(packed(subject, 0, 'isOwn')).toBe(1);
    expect(packed(subject, 0, 'selfRingFill')).toBeCloseTo(0.5, 6);
    expect(packed(subject, 0, 'selfRingBrightness')).toBeCloseTo(SELF_RING_ALPHA, 6);
    const ready = { ...cooling, sprintCooldownRemainingTicks: 0 };
    renderAt(subject, 1000, [ready]);
    expect(packed(subject, 0, 'selfRingFill')).toBe(1);
    renderAt(subject, 1000 + READY_PEAK.at, [ready]);
    expect(packed(subject, 0, 'selfRingBrightness')).toBeCloseTo(READY_PEAK.value, 6);
    subject.destroy();
  });

  it('hides only the engulfing predator’s warning ring while the escape arc shows, and brings it back on release', () => {
    expect(SHOULD_HIDE_PREDATOR_RING_DURING_ESCAPE).toBe(true);
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
    const released = { ...held, states: [], engulfedByCellId: null, engulfProgress: 0 };
    renderAt(subject, 16, [released, predator, bystander]);
    expect(packed(subject, 1, 'warningRingPx')).toBeGreaterThan(0);
    subject.destroy();
  });

  it('draws the escape window and its label in the effects layer while being engulfed', () => {
    const subject = renderer();
    const predator = createTestCellView({ id: entityId('predator'), playerId: null, x: 30, mass: 200, radius: 40 });
    const held = createTestCellView({
      radius: 10,
      mass: 20,
      states: [CELL_STATE.beingEngulfed],
      engulfedByCellId: predator.id,
      engulfProgress: 0.2,
    });
    const frame = createTestRenderFrame({ cells: [held, predator] });
    // The escape replaces the orbit: no atlas sprites, only the label pill — plus the mass chip's pill, which the
    // legibility cues draw whenever the own cell is alive (docs/ui/hud.md §3.1.5), and no cue glyph while steady.
    expect(subject.render(frame, TEST_OWN_PLAYER_ID, inputsFor(held), NO_SUBMIT).effectSprites).toBe(2);
    subject.destroy();
  });

  it('draws the legibility cues from the same record, after the indicators and under the effects (#385)', () => {
    const pixi = createFakePixiApp(VIEWPORT);
    const subject = new GameRenderer(
      pixi.stage,
      createTestRenderTextures({ seed: 13, baker: pixi.textures }),
      VIEWPORT,
    );
    const cueText = createFakeCueText();
    subject.useIndicatorText(createFakeIndicatorText().factory);
    subject.useCueText(cueText.factory);
    const own = createTestCellView({ radius: 20, mass: 312.7 });
    subject.render(createTestRenderFrame({ cells: [own] }), TEST_OWN_PLAYER_ID, inputsFor(own), NO_SUBMIT);
    expect(cueText.drawn.texts.map((text) => text.text)).toEqual(['312']);
    subject.render(createTestRenderFrame({ cells: [own] }), TEST_OWN_PLAYER_ID, NO_HUD_INPUTS, NO_SUBMIT);
    expect(cueText.drawn.texts).toEqual([]);
    subject.destroy();
  });

  it('draws the escape arc and the self ring as a lens, and none of the HUD chrome (#505)', () => {
    const pixi = createFakePixiApp(VIEWPORT);
    const subject = new GameRenderer(
      pixi.stage,
      createTestRenderTextures({ seed: 13, baker: pixi.textures }),
      VIEWPORT,
    );
    const indicatorText = createFakeIndicatorText();
    const cueText = createFakeCueText();
    subject.useIndicatorText(indicatorText.factory);
    subject.useCueText(cueText.factory);
    const predator = createTestCellView({ id: entityId('predator'), playerId: null, x: 30, mass: 200, radius: 40 });
    const held = createTestCellView({
      radius: 10,
      mass: 20,
      sprintCooldownRemainingTicks: COOLDOWN_TICKS / 2,
      states: [CELL_STATE.beingEngulfed],
      engulfedByCellId: predator.id,
      engulfProgress: 0.2,
    });
    const frame = createTestRenderFrame({ cells: [held, predator] });
    const hud = subject.render(frame, TEST_OWN_PLAYER_ID, inputsFor(held), NO_SUBMIT);
    expect(hud.effectSprites).toBeGreaterThan(0);
    expect(indicatorText.shown.label?.text).toBe('SPRINT TO ESCAPE');

    const lensInputs = { ...inputsFor(held), ownCellChrome: OWN_CELL_CHROME.lens };
    const lens = subject.render(frame, TEST_OWN_PLAYER_ID, lensInputs, NO_SUBMIT);
    expect(lens.effectSprites, 'a pill, an orbit sprite or a cue was drawn in the lens').toBe(0);
    expect(indicatorText.shown).toEqual({ numeral: null, label: null, relationLabels: [] });
    expect(cueText.drawn.texts).toEqual([]);
    expect(packed(subject, 0, 'selfRingFill')).toBeCloseTo(0.5, 6);
    subject.destroy();
  });
});
