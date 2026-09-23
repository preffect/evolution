import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, createTestPlayerProgressView, entityId, type CellView } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { FAKE_LABEL_CHAR_PX } from '../../../../testing/fake-indicator-text';
import { RELATION_LABEL_RIM } from '../../hud/format/relation-labels';
import { RELATION_RING, relationsFor } from '../../hud/format/relations-for';
import { ownCellIndicatorsFor } from '../../state/own-cell-indicators';
import {
  LABEL_PILL_HEIGHT_PX,
  RELATION_RING_LINE_PITCH_PX,
  RELATION_RING_RADII,
  THREAT_LABEL_GAP_PX,
  WHITE,
} from '../constants';
import { labelPillWidthPx } from '../textures/label-pill-bake';
import { relationLabelPlacements, relationLabelSceneFor, type RelationLabelFrame } from './relation-label-placements';
import { HALF, boxIntersectsDisc } from '../geometry';

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
const viewOfAll = (cells: readonly CellView[]) => (id: string) => [OWN, ...cells].find((cell) => cell.id === id);

describe('relationLabelSceneFor', () => {
  it('lists every drawn ring and anchors the toxic label on its outer line, the edible one on its only line', () => {
    const scene = relationLabelSceneFor({ indicators: indicatorsWith([PREY, TOXIC]), viewOf, zoom: 2 });
    const innerPx = RELATION_RING_RADII * 20;
    expect(scene.rings).toHaveLength(2);
    expect(scene.anchors.map((anchor) => [anchor.label.cellId, anchor.x, anchor.ringPx])).toEqual([
      [TOXIC.id, -120, innerPx + RELATION_RING_LINE_PITCH_PX],
      [PREY.id, 120, innerPx],
    ]);
  });

  it('anchors nothing without a record, for a cell no longer in view, or for a ring the far LOD does not draw', () => {
    const indicators = indicatorsWith([PREY]);
    expect(relationLabelSceneFor({ indicators: null, viewOf, zoom: 2 }).anchors).toEqual([]);
    expect(relationLabelSceneFor({ indicators, viewOf: () => undefined, zoom: 2 }).anchors).toEqual([]);
    expect(relationLabelSceneFor({ indicators, viewOf, zoom: 0.1 })).toEqual({ rings: [], anchors: [] });
    expect(indicators.relationRings.get(PREY.id)).toBe(RELATION_RING.edible);
  });
});

describe('relationLabelPlacements', () => {
  const zoom = 2;
  const measureLabelPx = (text: string) => text.length * FAKE_LABEL_CHAR_PX;

  function placementsOf(cells: readonly CellView[], overrides: Partial<RelationLabelFrame> = {}) {
    const scene = relationLabelSceneFor({ indicators: indicatorsWith(cells), viewOf: viewOfAll(cells), zoom });
    return relationLabelPlacements({
      scene,
      ownCell: OWN,
      zoom,
      threat: null,
      placedLabel: null,
      cueColumn: null,
      measureLabelPx,
      ...overrides,
    });
  }

  it('with nothing near, puts each label facing the own cell on its own ring, uppercased, on its role’s pill', () => {
    const placements = placementsOf([PREY, TOXIC]);
    expect(placements.map((placement) => [placement.text, placement.rim])).toEqual([
      ['TOXIC', RELATION_LABEL_RIM.danger],
      ['EDIBLE', RELATION_LABEL_RIM.gain],
    ]);
    const edible = placements[1]!;
    const ringPx = RELATION_RING_RADII * 20;
    expect(edible.y).toBe(0);
    expect(edible.x * zoom + edible.pillWidthPx * HALF).toBeCloseTo(120 * zoom - ringPx - THREAT_LABEL_GAP_PX, 6);
    expect(edible).toMatchObject({ tint: WHITE, pillWidthPx: labelPillWidthPx(measureLabelPx('EDIBLE')) });
  });

  it('moves a label off a neighbour’s ring that sits where it would have gone', () => {
    const lone = placementsOf([PREY])[0]!;
    // A toxic cell the own cell cannot eat, sitting where the lone label went: it takes the toxic label, and EDIBLE
    // stays on PREY but must leave that side.
    const neighbour = createTestCellView({ ...TOXIC, id: entityId('next'), x: lone.x, y: lone.y });
    const crowded = placementsOf([PREY, neighbour]);
    const moved = crowded.find((placement) => placement.text === 'EDIBLE')!;
    expect(moved.y).not.toBe(0);
    expect(moved.x).not.toBeCloseTo(lone.x, 3);
    const neighbourDisc = { x: neighbour.x * zoom, y: neighbour.y * zoom, radius: RELATION_RING_RADII * 20 };
    const box = {
      x: moved.x * zoom,
      y: moved.y * zoom,
      halfWidth: moved.pillWidthPx * HALF,
      halfHeight: LABEL_PILL_HEIGHT_PX * HALF,
    };
    expect(boxIntersectsDisc(box, neighbourDisc)).toBe(false);
  });

  it('keeps off the resting cue column, so the chip never has to rise over a cell for it', () => {
    const lone = placementsOf([PREY])[0]!;
    const column = {
      x: lone.x * zoom,
      y: lone.y * zoom,
      halfWidth: lone.pillWidthPx * HALF,
      halfHeight: LABEL_PILL_HEIGHT_PX * HALF,
    };
    const moved = placementsOf([PREY], { cueColumn: column })[0]!;
    expect(moved.y).not.toBe(lone.y);
  });

  it('yields to the threat label placed first', () => {
    const lone = placementsOf([PREY])[0]!;
    const moved = placementsOf([PREY], { placedLabel: { ...lone, text: 'BOT CAN ENGULF YOU' } })[0]!;
    expect(moved.x).not.toBeCloseTo(lone.x, 3);
  });
});
