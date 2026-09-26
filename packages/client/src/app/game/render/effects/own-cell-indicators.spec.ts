import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  CELL_STATE,
  DEFAULT_BALANCE,
  ENGULF_SEAL_PROGRESS,
  createTestPlayerProgressView,
  entityId,
  type CellView,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { FAKE_LABEL_CHAR_PX } from '../../../../testing/fake-indicator-text';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { CALLOUT_BACKING, DANGER, DNA, ESCAPE_ARC_TRACK_ALPHA, LEVEL_GOLD, WHITE } from '../constants';
import { paletteFor } from '../palette';
import { ESCAPE_LABEL, ownCellIndicatorsFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import { labelPillWidthPx } from '../textures/label-pill-bake';
import { endosymbiontTallies } from '../textures/pip-block-bake';
import { orbitLayout } from './orbit-layout';
import {
  ownCellIndicatorPlacements,
  threatAnchorFor,
  type OwnCellIndicatorsFrame,
  type ThreatAnchor,
} from './own-cell-indicators';
import { dnaRingRadiusPx, ladderOrbitRadiusPx } from './own-cell-geometry';
import { threatLabelPlacement } from './threat-label-placement';

const textures = createTestRenderTextures().indicators;
const REQUIRED = endosymbiontTallies()[0]!.required;
const SEAL = ENGULF_SEAL_PROGRESS;
const THREAT_LABEL = 'Amoeboid can engulf you';

function recordFor(cell: CellView, eaten = 0, level = 4): OwnCellIndicators {
  const base = createTestPlayerProgressView();
  const ownProgress = createTestPlayerProgressView({
    level,
    bacteriaEatenByVariant: { ...base.bacteriaEatenByVariant, aerobic: eaten, photosynthetic: eaten },
  });
  return ownCellIndicatorsFor({
    ownCell: cell,
    ownProgress,
    balance: DEFAULT_BALANCE,
    threats: [],
    previewTraitId: null,
  });
}

function frameOf(cell: CellView, overrides: Partial<OwnCellIndicatorsFrame> = {}): OwnCellIndicatorsFrame {
  return {
    indicators: recordFor(cell),
    ownCell: cell,
    zoom: 1,
    dnaFill: 0.3,
    ringFlash: 0,
    threat: null,
    textures,
    measureLabelPx: (text) => text.length * FAKE_LABEL_CHAR_PX,
    ...overrides,
  };
}

describe('ownCellIndicatorPlacements', () => {
  it('draws the worst case within §10’s budget: 5 sprites with the pill, 6 arc rows, 2 texts', () => {
    // A prokaryote with both counters full and a threat on screen (docs/rendering/own-cell-indicators.md §10).
    const cell = createTestCellView({ stage: CELL_STAGE.prokaryote, radius: 45 });
    const indicators = { ...recordFor(cell, REQUIRED), nearestThreat: { cellId: entityId('t'), label: THREAT_LABEL } };
    const threat: ThreatAnchor = { x: 400, y: 0, warningRingPx: 60 };
    const placements = ownCellIndicatorPlacements(frameOf(cell, { indicators, threat }));
    // Two ghosts and two pip blocks, plus the label pill.
    expect(placements.sprites).toHaveLength(4);
    expect(placements.label).not.toBeNull();
    // The DNA track and fill, two backings, two unlock rings.
    expect(placements.arcs).toHaveLength(6);
    expect(placements.numeral.text).toBe('4');
  });

  it('draws the DNA ring as a track in the callout backing and the tweened share in DNA', () => {
    const cell = createTestCellView({ radius: 30 });
    const [track, fill] = ownCellIndicatorPlacements(frameOf(cell, { zoom: 2, dnaFill: 0.45 })).arcs;
    expect(track).toMatchObject({ colour: CALLOUT_BACKING, sweep: 1, radiusPx: dnaRingRadiusPx(60) });
    expect(fill).toMatchObject({ colour: DNA, sweep: 0.45, alpha: 1, radiusPx: dnaRingRadiusPx(60) });
  });

  it('fills the ring gold at the top level, and flashes ring and numeral gold with the level-up', () => {
    const cell = createTestCellView();
    const top = { ...recordFor(cell), isMaxLevel: true };
    expect(ownCellIndicatorPlacements(frameOf(cell, { indicators: top })).arcs[1]).toMatchObject({
      colour: LEVEL_GOLD,
      sweep: 1,
    });
    const flashing = ownCellIndicatorPlacements(frameOf(cell, { ringFlash: 0.6 }));
    expect(flashing.arcs[1]).toMatchObject({ colour: LEVEL_GOLD, sweep: 1, alpha: 0.6 });
    expect(flashing.numeral.tint).toBe(LEVEL_GOLD);
    expect(ownCellIndicatorPlacements(frameOf(cell)).numeral.tint).toBe(WHITE);
  });

  it('places the orbit sprites in world units around the cell, the rung ghost in the rim colour', () => {
    const cell = createTestCellView({ x: 100, y: 50, radius: 20, avatarIndex: 3 });
    const zoom = 2;
    const placements = ownCellIndicatorPlacements(frameOf(cell, { zoom }));
    const layout = orbitLayout(recordFor(cell).ladder, cell.radius * zoom);
    const ghost = layout.ghosts[0]!;
    const texture = textures.ghosts[ghost.key]!;
    expect(placements.sprites[0]).toMatchObject({
      x: 100 + ghost.x / zoom,
      y: 50 + ghost.y / zoom,
      widthWu: texture.widthPx / zoom,
      rotation: ghost.rotation,
      tint: paletteFor(3).rim,
    });
    expect(placements.numeral).toMatchObject({ x: 100, y: 50 });
  });

  it('draws a counter ghost in its own colour and every counter’s pip block', () => {
    const cell = createTestCellView({ stage: CELL_STAGE.prokaryote, radius: 45 });
    const placements = ownCellIndicatorPlacements(frameOf(cell, { indicators: recordFor(cell, 3) }));
    expect(placements.sprites.map((sprite) => sprite.tint)).toEqual([WHITE, WHITE, WHITE, WHITE]);
    expect(placements.arcs).toHaveLength(4);
  });

  it('replaces the orbit and the threat label with the escape window and its label while being engulfed', () => {
    const held = createTestCellView({
      y: 10,
      radius: 30,
      states: [CELL_STATE.beingEngulfed],
      engulfedByCellId: entityId('predator'),
      engulfProgress: SEAL / 2,
    });
    const placements = ownCellIndicatorPlacements(frameOf(held, { indicators: recordFor(held) }));
    expect(placements.sprites).toEqual([]);
    const [, , track, arc] = placements.arcs;
    expect(track).toMatchObject({
      colour: DANGER,
      sweep: 1,
      alpha: ESCAPE_ARC_TRACK_ALPHA,
      radiusPx: ladderOrbitRadiusPx(30),
    });
    expect(arc).toMatchObject({ colour: DANGER, alpha: 1 });
    expect(arc!.sweep).toBeCloseTo(0.5, 9);
    const text = ESCAPE_LABEL.window.toUpperCase();
    expect(placements.label).toMatchObject({
      text,
      x: 0,
      pillWidthPx: labelPillWidthPx(text.length * FAKE_LABEL_CHAR_PX),
    });
    expect(placements.label!.y).toBeLessThan(10 - ladderOrbitRadiusPx(30));
  });

  it('locks the escape ring solid and reads SEALED from the seal on', () => {
    const sealed = createTestCellView({
      states: [CELL_STATE.beingEngulfed],
      engulfedByCellId: entityId('predator'),
      engulfProgress: Math.min(1, SEAL + 0.01),
    });
    const placements = ownCellIndicatorPlacements(frameOf(sealed, { indicators: recordFor(sealed) }));
    expect(placements.arcs).toHaveLength(3);
    expect(placements.arcs[2]).toMatchObject({ colour: DANGER, sweep: 1, alpha: 1 });
    expect(placements.label?.text).toBe(ESCAPE_LABEL.sealed.toUpperCase());
  });

  it('puts the threat label where threatLabelPlacement says, back in world units, and none without an anchor', () => {
    const cell = createTestCellView({ x: 10, y: 0, radius: 20 });
    const indicators = { ...recordFor(cell), nearestThreat: { cellId: entityId('t'), label: THREAT_LABEL } };
    const threat: ThreatAnchor = { x: 160, y: 40, warningRingPx: 50 };
    const zoom = 1.5;
    const label = ownCellIndicatorPlacements(frameOf(cell, { indicators, threat, zoom })).label!;
    const text = THREAT_LABEL.toUpperCase();
    const expected = threatLabelPlacement({
      threatCentre: { x: 160 * zoom, y: 40 * zoom },
      warningRingPx: 50,
      ownCentre: { x: 10 * zoom, y: 0 },
      ownRadiusPx: 20 * zoom,
      pillWidthPx: labelPillWidthPx(text.length * FAKE_LABEL_CHAR_PX),
    });
    expect(label.text).toBe(text);
    expect(label.x).toBeCloseTo(expected.x / zoom, 9);
    expect(label.y).toBeCloseTo(expected.y / zoom, 9);
    expect(ownCellIndicatorPlacements(frameOf(cell, { indicators })).label).toBeNull();
  });
});

describe('threatAnchorFor', () => {
  const own = createTestCellView({ radius: 10, mass: 20 });
  const giant = createTestCellView({ id: entityId('giant'), playerId: null, x: 90, y: -20, radius: 40, mass: 200 });
  const peer = createTestCellView({ id: entityId('peer'), playerId: null, x: 50, radius: 10, mass: 20 });
  const viewOf = (id: string) => [giant, peer].find((view) => view.id === id);
  const threatening = (cellId: string): OwnCellIndicators => ({
    ...recordFor(own),
    nearestThreat: { cellId: entityId(cellId), label: THREAT_LABEL },
  });

  it('anchors to the nearest threat’s view and the warning ring the cell layer draws on it', () => {
    const anchor = threatAnchorFor({
      indicators: threatening('giant'),
      viewOf,
      ownCell: own,
      balance: DEFAULT_BALANCE,
      zoom: 1,
    });
    expect(anchor).toMatchObject({ x: 90, y: -20 });
    expect(anchor!.warningRingPx).toBeGreaterThan(0);
  });

  it('has nothing to anchor to without a record, a threat, its view, an own cell, or a drawn ring', () => {
    expect(threatAnchorFor({ indicators: null, viewOf, ownCell: own, balance: DEFAULT_BALANCE, zoom: 1 })).toBeNull();
    expect(
      threatAnchorFor({ indicators: recordFor(own), viewOf, ownCell: own, balance: DEFAULT_BALANCE, zoom: 1 }),
    ).toBeNull();
    expect(
      threatAnchorFor({ indicators: threatening('gone'), viewOf, ownCell: own, balance: DEFAULT_BALANCE, zoom: 1 }),
    ).toBeNull();
    expect(
      threatAnchorFor({ indicators: threatening('giant'), viewOf, ownCell: null, balance: DEFAULT_BALANCE, zoom: 1 }),
    ).toBeNull();
    expect(
      threatAnchorFor({ indicators: threatening('peer'), viewOf, ownCell: own, balance: DEFAULT_BALANCE, zoom: 1 }),
    ).toBeNull();
  });
});
