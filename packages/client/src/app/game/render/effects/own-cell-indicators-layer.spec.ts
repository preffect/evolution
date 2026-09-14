import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  MOTION_CLIPS,
  RADIANS_PER_FULL_TURN,
  createTestPlayerProgressView,
  entityId,
  type CellView,
  type GameEffect,
} from '@evolution/shared';
import { createTestCellView, createTestLevelUpEffect } from '../../../../testing/builders';
import { createFakeIndicatorText } from '../../../../testing/fake-indicator-text';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { peakKeyframe } from '../../../../testing/motion-keyframes';
import { hexToNumber, hexToRgb } from '../colour';
import { ARC_INSTANCE_FIELD, INDICATOR_FILL_TWEEN_MS, LEVEL_GOLD, WHITE } from '../constants';
import { ownCellIndicatorsFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import { endosymbiontTallies } from '../textures/pip-block-bake';
import { ARC_INSTANCE_FLOATS } from './arc-instance';
import { OwnCellIndicatorsLayer, type OwnCellIndicatorsLayerFrame } from './own-cell-indicators-layer';

const textures = createTestRenderTextures().indicators;
const FLASH_PEAK = peakKeyframe(MOTION_CLIPS.level_up.tracks['ringFlash']);
const DNA_FILL_ROW = 1;

function recordFor(cell: CellView, overrides: Partial<OwnCellIndicators> = {}): OwnCellIndicators {
  const base = createTestPlayerProgressView();
  const full = endosymbiontTallies()[0]!.required;
  const ownProgress = createTestPlayerProgressView({
    level: 2,
    bacteriaEatenByVariant: { ...base.bacteriaEatenByVariant, aerobic: full, photosynthetic: full },
  });
  const record = ownCellIndicatorsFor({
    ownCell: cell,
    ownProgress,
    balance: DEFAULT_BALANCE,
    threats: [],
    previewTraitId: null,
  });
  return { ...record, ...overrides };
}

function layer() {
  const text = createFakeIndicatorText();
  return { subject: new OwnCellIndicatorsLayer(textures, text.factory), text };
}

function frameAt(
  nowMs: number,
  cell: CellView | null,
  indicators: OwnCellIndicators | null,
  effects: readonly GameEffect[] = [],
): OwnCellIndicatorsLayerFrame {
  return { indicators, ownCell: cell, zoom: 1, nowMs, threat: null, effects };
}

function rowValue(subject: OwnCellIndicatorsLayer, row: number, field: keyof typeof ARC_INSTANCE_FIELD): number {
  return subject.arcRows[row * ARC_INSTANCE_FLOATS + ARC_INSTANCE_FIELD[field]] ?? Number.NaN;
}

describe('OwnCellIndicatorsLayer', () => {
  it('draws nothing, and builds no text, without a record or an own cell', () => {
    const { subject, text } = layer();
    const cell = createTestCellView();
    expect(subject.update(frameAt(0, cell, null))).toEqual({ sprites: 0, arcs: 0, texts: 0 });
    expect(subject.update(frameAt(0, null, recordFor(cell)))).toEqual({ sprites: 0, arcs: 0, texts: 0 });
    expect(subject.container.children).toHaveLength(2);
    expect(text.shown.numeral).toBeNull();
    subject.destroy();
  });

  it('applies the placements: atlas sprites, arc rows in one mesh, the numeral and the label', () => {
    const { subject, text } = layer();
    const cell = createTestCellView({ stage: CELL_STAGE.prokaryote, radius: 45 });
    // Some DNA toward the next level: an empty fill draws no row (`packArcInstances` skips a zero sweep).
    const indicators = recordFor(cell, {
      dnaFraction: 0.5,
      nearestThreat: { cellId: entityId('t'), label: 'Amoeboid can engulf you' },
    });
    const outputs = subject.update({ ...frameAt(0, cell, indicators), threat: { x: 400, y: 0, warningRingPx: 60 } });
    expect(outputs).toEqual({ sprites: 5, arcs: 6, texts: 2 });
    expect(subject.sprites.filter((sprite) => sprite.visible)).toHaveLength(4);
    expect(subject.sprites[0]!.tint).toBe(hexToNumber(WHITE));
    expect(text.shown.numeral?.text).toBe('2');
    expect(text.shown.label?.text).toBe('AMOEBOID CAN ENGULF YOU');
    subject.destroy();
  });

  it('tweens the DNA fill toward a new share, snapping on the cell’s first frame', () => {
    const { subject } = layer();
    const cell = createTestCellView();
    subject.update(frameAt(0, cell, recordFor(cell, { dnaFraction: 0.2 })));
    expect(rowValue(subject, DNA_FILL_ROW, 'sweepRadians')).toBeCloseTo(0.2 * RADIANS_PER_FULL_TURN, 6);
    subject.update(frameAt(16, cell, recordFor(cell, { dnaFraction: 0.6 })));
    expect(rowValue(subject, DNA_FILL_ROW, 'sweepRadians')).toBeCloseTo(0.2 * RADIANS_PER_FULL_TURN, 6);
    subject.update(frameAt(16 + INDICATOR_FILL_TWEEN_MS, cell, recordFor(cell, { dnaFraction: 0.6 })));
    expect(rowValue(subject, DNA_FILL_ROW, 'sweepRadians')).toBeCloseTo(0.6 * RADIANS_PER_FULL_TURN, 6);
    subject.destroy();
  });

  it('flashes the ring and the numeral gold from the own cell’s level_up effect, never from a record diff', () => {
    const { subject, text } = layer();
    const cell = createTestCellView();
    subject.update(frameAt(0, cell, recordFor(cell, { level: 5 })));
    // The record rises and another cell levels up: neither is the own cell's moment.
    const otherLevelUp = createTestLevelUpEffect({ cellId: entityId('other'), level: 6 });
    subject.update(frameAt(16, cell, recordFor(cell, { level: 6 }), [otherLevelUp]));
    subject.update(frameAt(16 + FLASH_PEAK.at, cell, recordFor(cell, { level: 6 })));
    expect(text.shown.numeral?.tint).toBe(WHITE);
    const ownLevelUp = createTestLevelUpEffect({ cellId: cell.id, level: 7 });
    subject.update(frameAt(1000, cell, recordFor(cell, { level: 7 }), [ownLevelUp]));
    subject.update(frameAt(1000 + FLASH_PEAK.at, cell, recordFor(cell, { level: 7 })));
    expect(text.shown.numeral?.tint).toBe(LEVEL_GOLD);
    const [red, green, blue] = hexToRgb(LEVEL_GOLD);
    expect(rowValue(subject, DNA_FILL_ROW, 'red')).toBeCloseTo(red, 6);
    expect(rowValue(subject, DNA_FILL_ROW, 'green')).toBeCloseTo(green, 6);
    expect(rowValue(subject, DNA_FILL_ROW, 'blue')).toBeCloseTo(blue, 6);
    expect(rowValue(subject, DNA_FILL_ROW, 'alpha')).toBeCloseTo(FLASH_PEAK.value, 6);
    subject.update(frameAt(1000 + MOTION_CLIPS.level_up.duration, cell, recordFor(cell, { level: 7 })));
    expect(text.shown.numeral?.tint).toBe(WHITE);
    subject.destroy();
  });

  it('hides everything when the record goes, and starts the next cell fresh', () => {
    const { subject, text } = layer();
    const cell = createTestCellView({ stage: CELL_STAGE.prokaryote, radius: 45 });
    subject.update(frameAt(0, cell, recordFor(cell)));
    expect(subject.update(frameAt(16, cell, null))).toEqual({ sprites: 0, arcs: 0, texts: 0 });
    expect(subject.sprites.every((sprite) => !sprite.visible)).toBe(true);
    expect(text.shown).toEqual({ numeral: null, label: null });
    const respawned = createTestCellView({ id: entityId('respawned') });
    subject.update(frameAt(32, respawned, recordFor(respawned, { level: 9, dnaFraction: 0.9 })));
    expect(text.shown.numeral).toMatchObject({ text: '9', tint: WHITE });
    expect(rowValue(subject, DNA_FILL_ROW, 'sweepRadians')).toBeCloseTo(0.9 * RADIANS_PER_FULL_TURN, 6);
    subject.destroy();
  });
});
