// The cross-module wiring of the cell tells (docs/rendering/files-and-tests.md §9): the warning ring agrees with
// the shared `canEngulf` on the live balance, an absorbed prey draws as a ghost from the
// `cell_absorbed` effect through the packed rows and leaves at 600 ms, and the predator wears the
// ghost's seal meanwhile; the relation rings `relationsFor` decides are the rings packed. Frames come through the
// layer's real contract, not its parts.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, MOTION_CLIPS, canEngulf, entityId } from '@evolution/shared';
import {
  TEST_OTHER_CELL_ID,
  createTestCellAbsorbedEffect,
  createTestCellView,
  createTestRenderFrame,
} from '../../../../testing/builders';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import {
  ENGULF_WARNING_RING_MIN_PX,
  ENGULF_WARNING_RING_RADII,
  PREY_UNDER_FILM_ALPHA,
  RELATION_RING_RADII,
} from '../constants';
import { RELATION_RING, relationRingsOf, relationsFor } from '../../hud/format/relations-for';
import { NO_DEFORMATIONS } from './cell-deformation';
import {
  BUMP_TEXEL_START,
  CELL_INSTANCE_FLOATS,
  TEXEL_FLOATS,
  instanceFieldLocation,
  type CellInstanceScalar,
} from './cell-instance';
import { CellLayer } from './cell-layer';
import type { CellLayerFrame } from './cell-layer-frame';
import { REST_OWN_CELL_RING } from './self-ring';
import { starvedOutMassAt, witherOf } from './starving-wither';

const textures = createTestRenderTextures({ seed: 5 });
const EXTENT = { minX: -500, minY: -500, maxX: 500, maxY: 500 };

function input(overrides: Partial<CellLayerFrame>): CellLayerFrame {
  return {
    frame: createTestRenderFrame(),
    extent: EXTENT,
    zoom: 1,
    nowMs: 0,
    ownCell: null,
    previewTraitId: null,
    deformations: NO_DEFORMATIONS,
    ownCellRing: REST_OWN_CELL_RING,
    ...overrides,
  };
}

function packed(subject: CellLayer, row: number, field: CellInstanceScalar): number {
  const [texel, channel] = instanceFieldLocation(field);
  return subject.instances[row * CELL_INSTANCE_FLOATS + texel * TEXEL_FLOATS + channel] ?? Number.NaN;
}

describe('cell tells through the layer', () => {
  it('withers the starving wild cell by the world clock at the render tick, and no other cell (#635)', () => {
    const subject = new CellLayer(textures);
    const healthy = createTestCellView({ mass: 60, radius: 20 });
    const starving = createTestCellView({ id: TEST_OTHER_CELL_ID, x: 100, mass: 60, radius: 30, isStarving: true });
    const early = createTestRenderFrame({ cells: [healthy, starving] });
    subject.update(input({ frame: early }));
    const starvedOutEarly = starvedOutMassAt(early.renderTick, early.latest.roundStartTick, early.balance);
    expect(packed(subject, 0, 'wither')).toBe(0);
    expect(packed(subject, 0, 'wrinkleAmplitude')).toBe(0);
    expect(packed(subject, 1, 'wither')).toBeCloseTo(witherOf(starving, starvedOutEarly), 6);
    expect(packed(subject, 1, 'wrinkleAmplitude')).toBeGreaterThan(0);
    // Later in the round the world's newborns are bigger, so the same cell is nearer its burst.
    const late = createTestRenderFrame({ cells: [healthy, starving], renderTick: 60 * 60 });
    subject.update(input({ frame: late }));
    expect(packed(subject, 1, 'wither')).toBeGreaterThan(witherOf(starving, starvedOutEarly) + 1e-3);
    subject.destroy();
  });

  it('rings every cell that canEngulf the own cell on the live balance, and only those', () => {
    const subject = new CellLayer(textures);
    const own = createTestCellView({ mass: 20, radius: 10 });
    const giant = createTestCellView({ id: entityId('giant'), x: 100, mass: 200, radius: 40 });
    const peer = createTestCellView({ id: TEST_OTHER_CELL_ID, x: -100, mass: 22, radius: 10 });
    expect(canEngulf(giant, own, DEFAULT_BALANCE.absorption)).toBe(true);
    expect(canEngulf(peer, own, DEFAULT_BALANCE.absorption)).toBe(false);
    const frame = createTestRenderFrame({ cells: [own, giant, peer] });
    subject.update(input({ frame, ownCell: own, zoom: 2 }));
    expect(packed(subject, 2, 'warningRingPx')).toBe(
      Math.max(ENGULF_WARNING_RING_RADII * 80, ENGULF_WARNING_RING_MIN_PX),
    );
    expect(packed(subject, 0, 'warningRingPx')).toBe(0);
    expect(packed(subject, 1, 'warningRingPx')).toBe(0);
    expect(packed(subject, 2, 'quadExtentRadii')).toBeGreaterThanOrEqual(
      (packed(subject, 2, 'warningRingPx') + 2) / 80,
    );
    subject.destroy();
  });

  it('packs the relation ring relationsFor decides: edible on prey, the double line on toxic, none on the rest', () => {
    const subject = new CellLayer(textures);
    const own = createTestCellView({ mass: 100, radius: 20 });
    const ratio = DEFAULT_BALANCE.absorption.ENGULF_MASS_RATIO;
    // Rows are packed smallest radius first: prey, toxic, peer, own.
    const prey = createTestCellView({ id: entityId('prey'), x: 100, mass: (100 / ratio) * 0.9, radius: 10 });
    const toxic = createTestCellView({
      id: entityId('toxic'),
      x: -100,
      mass: (100 / ratio) * 1.1,
      radius: 11,
      traits: [{ traitId: 'toxin_vacuole', tier: 1 }],
    });
    const peer = createTestCellView({ id: TEST_OTHER_CELL_ID, y: 100, mass: (100 / ratio) * 1.1, radius: 12 });
    const cells = [own, prey, toxic, peer];
    const relations = relationsFor({ cells, ownCell: own, cameraExtent: EXTENT, balance: DEFAULT_BALANCE });
    subject.update(
      input({
        frame: createTestRenderFrame({ cells }),
        ownCell: own,
        zoom: 2,
        relationRings: relationRingsOf(relations),
      }),
    );
    expect(packed(subject, 0, 'relationRingPx')).toBe(RELATION_RING_RADII * 20);
    expect(packed(subject, 0, 'relationRingLines')).toBe(RELATION_RING.edible);
    expect(packed(subject, 1, 'relationRingLines')).toBe(RELATION_RING.toxic);
    expect(packed(subject, 2, 'relationRingPx')).toBe(0);
    expect(packed(subject, 3, 'relationRingPx')).toBe(0);
    subject.destroy();
  });

  it('ghosts an absorbed prey from its last drawn view, seals the predator, and drops both at 600 ms', () => {
    const subject = new CellLayer(textures);
    const predator = createTestCellView({ id: entityId('pred'), x: 0, y: 0, mass: 200, radius: 40 });
    const prey = createTestCellView({ id: entityId('prey'), x: 50, y: 0, mass: 20, radius: 10, avatarIndex: 3 });
    subject.update(input({ frame: createTestRenderFrame({ cells: [prey, predator] }), nowMs: 0 }));
    const absorbed = createTestCellAbsorbedEffect({ cellId: prey.id, predatorCellId: predator.id, x: 50, y: 0 });
    const payout = subject.update(
      input({ frame: createTestRenderFrame({ cells: [predator], effects: [absorbed] }), nowMs: 100 }),
    );
    expect(payout).toMatchObject({ visibleCells: 1, ghosts: 1 });
    // Row order is draw order: the ghost's row comes right before its predator's so the predator paints over it.
    expect(packed(subject, 0, 'paletteIndex')).toBe(3);
    expect(packed(subject, 0, 'x')).toBe(50);
    expect(packed(subject, 0, 'passBAlpha')).toBeCloseTo(PREY_UNDER_FILM_ALPHA, 6);
    expect(packed(subject, 1, 'x')).toBe(0);
    const sealSlot = CELL_INSTANCE_FLOATS + BUMP_TEXEL_START * TEXEL_FLOATS;
    expect(subject.instances[sealSlot]).toBeCloseTo(0.6, 6);
    expect(subject.instances[sealSlot + 1]).toBeCloseTo(0, 6);
    subject.update(input({ frame: createTestRenderFrame({ cells: [predator] }), nowMs: 300 }));
    expect(packed(subject, 0, 'rimDash')).toBe(1);
    expect(packed(subject, 0, 'alpha')).toBeCloseTo(0.5, 6);
    expect(subject.instances[sealSlot]).toBeCloseTo(0.42, 6);
    const done = subject.update(
      input({ frame: createTestRenderFrame({ cells: [predator] }), nowMs: 100 + MOTION_CLIPS.absorbed.duration }),
    );
    expect(done.ghosts).toBe(0);
    expect(subject.instances[BUMP_TEXEL_START * TEXEL_FLOATS]).toBe(0);
    subject.destroy();
  });
});
