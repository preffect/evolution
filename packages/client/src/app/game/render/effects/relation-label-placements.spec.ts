import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, createTestPlayerProgressView, entityId, type CellView } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { FAKE_LABEL_CHAR_PX } from '../../../../testing/fake-indicator-text';
import { RELATION_LABEL_RIM } from '../../hud/format/relation-labels';
import { RELATION_RING, relationsFor } from '../../hud/format/relations-for';
import { ownCellIndicatorsFor } from '../../state/own-cell-indicators';
import { RELATION_RING_LINE_PITCH_PX, RELATION_RING_RADII, WHITE } from '../constants';
import { labelPillWidthPx } from '../textures/label-pill-bake';
import { relationLabelAnchorsFor, relationLabelPlacements } from './relation-label-placements';
import { threatLabelPlacement } from './threat-label-placement';

const OWN = createTestCellView({ id: entityId('own'), mass: 100, radius: 20, x: 0, y: 0 });
const RATIO = DEFAULT_BALANCE.absorption.ENGULF_MASS_RATIO;
const PREY = createTestCellView({ id: entityId('prey'), mass: (100 / RATIO) * 0.9, radius: 10, x: 120, y: 0 });
const TOXIC = createTestCellView({
  id: entityId('toxic'),
  mass: (100 / RATIO) * 1.1,
  radius: 10,
  x: -120,
  y: 0,
  traits: [{ traitId: 'toxin_vacuole', tier: 1 }],
});
const EXTENT = { minX: -500, minY: -500, maxX: 500, maxY: 500 };

function indicatorsWith(cells: readonly CellView[]) {
  const all = [OWN, ...cells];
  return ownCellIndicatorsFor({
    ownCell: OWN,
    ownProgress: createTestPlayerProgressView(),
    balance: DEFAULT_BALANCE,
    threats: [],
    relations: relationsFor({ cells: all, ownCell: OWN, cameraExtent: EXTENT, balance: DEFAULT_BALANCE }),
    previewTraitId: null,
  });
}

const viewOf = (id: string) => [OWN, PREY, TOXIC].find((cell) => cell.id === id);

describe('relationLabelAnchorsFor', () => {
  it('anchors the toxic label on its outer line and the edible label on its only line', () => {
    const anchors = relationLabelAnchorsFor({ indicators: indicatorsWith([PREY, TOXIC]), viewOf, zoom: 2 });
    const innerPx = RELATION_RING_RADII * 20;
    expect(anchors.map((anchor) => [anchor.label.cellId, anchor.x, anchor.ringPx])).toEqual([
      [TOXIC.id, -120, innerPx + RELATION_RING_LINE_PITCH_PX],
      [PREY.id, 120, innerPx],
    ]);
  });

  it('anchors nothing without a record, for a cell no longer in view, or for a ring the far LOD does not draw', () => {
    const indicators = indicatorsWith([PREY]);
    expect(relationLabelAnchorsFor({ indicators: null, viewOf, zoom: 2 })).toEqual([]);
    expect(relationLabelAnchorsFor({ indicators, viewOf: () => undefined, zoom: 2 })).toEqual([]);
    expect(relationLabelAnchorsFor({ indicators, viewOf, zoom: 0.1 })).toEqual([]);
    expect(indicators.relationRings.get(PREY.id)).toBe(RELATION_RING.edible);
  });
});

describe('relationLabelPlacements', () => {
  it('places each label by the threat label rule on its ring, uppercased, on its role’s pill', () => {
    const zoom = 2;
    const anchors = relationLabelAnchorsFor({ indicators: indicatorsWith([PREY, TOXIC]), viewOf, zoom });
    const measureLabelPx = (text: string) => text.length * FAKE_LABEL_CHAR_PX;
    const placements = relationLabelPlacements({ anchors, ownCell: OWN, zoom, measureLabelPx });
    expect(placements.map((placement) => [placement.text, placement.rim])).toEqual([
      ['TOXIC', RELATION_LABEL_RIM.danger],
      ['EDIBLE', RELATION_LABEL_RIM.gain],
    ]);
    const edible = placements[1]!;
    const expected = threatLabelPlacement({
      threatCentre: { x: 120 * zoom, y: 0 },
      warningRingPx: anchors[1]!.ringPx,
      ownCentre: { x: 0, y: 0 },
      ownRadiusPx: 20 * zoom,
      pillWidthPx: labelPillWidthPx(measureLabelPx('EDIBLE')),
    });
    expect(edible).toMatchObject({ x: expected.x / zoom, y: expected.y / zoom, tint: WHITE });
    expect(edible.pillWidthPx).toBe(labelPillWidthPx(measureLabelPx('EDIBLE')));
  });
});
