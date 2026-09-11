import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  MOTION_CLIPS,
  SEAT_MARK_BEADS,
  createSeededRandom,
  entityId,
} from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  CELL_QUAD_EXTENT_RADII,
  CILIA_BEAT_HZ,
  CILIA_BEAT_IDLE_HZ,
  ENGULF_WARNING_RING_MIN_PX,
  HALO_KIND,
} from '../constants';
import { buildNoiseStrip } from '../noise/noise-strip';
import { CellRenderState, type CellFrameContext } from './cell-render-state';
import { ORGANELLE_KIND } from './organelle-kinds';

const TEST_SEED = 42;
const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));

function context(overrides: Partial<CellFrameContext> = {}): CellFrameContext {
  return {
    timeSeconds: 1,
    nowMs: 1000,
    zoom: 1,
    balance: DEFAULT_BALANCE,
    ownCell: null,
    strip,
    previewTraitId: null,
    contactDent: null,
    absorbedSealByPredator: new Map(),
    preyProgressByPredator: new Map(),
    ...overrides,
  };
}

const eukaryote = () =>
  createTestCellView({
    id: entityId('e'),
    radius: 40,
    mass: 100,
    stage: CELL_STAGE.eukaryote,
    traits: [
      { traitId: 'nuclear_envelope', tier: 1 },
      { traitId: 'mitochondrion', tier: 2 },
      { traitId: 'cilia', tier: 1 },
    ],
  });

describe('CellRenderState', () => {
  it('builds an instance at the view with the palette, the beads and the resting terms', () => {
    const state = new CellRenderState(entityId('e'), createSeededRandom(TEST_SEED));
    const view = eukaryote();
    const output = state.update({ ...view, avatarIndex: 3 }, context());
    expect(output.instance).toMatchObject({
      x: 0,
      y: 0,
      radius: 40,
      paletteIndex: 3,
      speedRatio: 0,
      alpha: 1,
      pulse: 1,
    });
    expect(output.instance.beadCount).toBe(SEAT_MARK_BEADS[3]);
    expect(output.instance.ciliaCount).toBe(24);
    expect(output.instance.ciliaBeatHz).toBe(CILIA_BEAT_IDLE_HZ);
    expect(output.instance.quadExtentRadii).toBeGreaterThanOrEqual(1);
    expect(output.instance.quadExtentRadii).toBeLessThanOrEqual(CELL_QUAD_EXTENT_RADII);
    expect(output.lod.level).toBe('full');
    expect(state.lastView).toMatchObject({ id: 'e' });
  });

  it('places the organelles through the profile and points the nucleus offset at the nucleus sprite', () => {
    const state = new CellRenderState(entityId('e'), createSeededRandom(TEST_SEED));
    const output = state.update(eukaryote(), context());
    const kinds = output.organelles.map((placement) => placement.kind);
    expect(kinds.filter((kind) => kind === ORGANELLE_KIND.mitochondrion)).toHaveLength(2);
    const nucleus = output.organelles.find((placement) => placement.kind === ORGANELLE_KIND.nucleus)!;
    expect(output.instance.nucleusOffsetX).toBeCloseTo(nucleus.point.x / 40, 9);
    expect(Math.hypot(nucleus.point.x, nucleus.point.y) / 40).toBeCloseTo(0.12, 1);
  });

  it('reads the heading and the cilia beat from the velocity and holds the heading at rest', () => {
    const state = new CellRenderState(entityId('e'), createSeededRandom(TEST_SEED));
    const moving = state.update({ ...eukaryote(), velocityX: 0, velocityY: 50 }, context());
    expect(moving.instance.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(moving.instance.speedRatio).toBeGreaterThan(0);
    expect(moving.instance.ciliaBeatHz).toBe(CILIA_BEAT_HZ);
    const resting = state.update(eukaryote(), context());
    expect(resting.instance.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(resting.instance.speedRatio).toBe(0);
  });

  it('draws the warning ring around a cell that can engulf the own cell, floored, and the self ring on the own cell', () => {
    const state = new CellRenderState(entityId('e'), createSeededRandom(TEST_SEED));
    const own = createTestCellView({ id: entityId('me'), mass: 10, radius: 20 });
    const threat = state.update({ ...eukaryote(), mass: 100, radius: 10 }, context({ ownCell: own, zoom: 1 }));
    expect(threat.instance.warningRingPx).toBe(ENGULF_WARNING_RING_MIN_PX);
    expect(threat.instance.isOwn).toBe(false);
    expect(threat.instance.quadExtentRadii).toBeGreaterThan(CELL_QUAD_EXTENT_RADII - 1);
    const self = new CellRenderState(entityId('me'), createSeededRandom(TEST_SEED)).update(
      own,
      context({ ownCell: own }),
    );
    expect(self.instance.isOwn).toBe(true);
    expect(self.instance.warningRingPx).toBe(0);
  });

  it('drops the tells, the sprites and the interior at the far dot', () => {
    const state = new CellRenderState(entityId('e'), createSeededRandom(TEST_SEED));
    const far = state.update(eukaryote(), context({ zoom: 0.1 }));
    expect(far.lod.isFarDot).toBe(true);
    expect(far.instance.isFarDot).toBe(true);
    expect(far.instance.beadCount).toBe(0);
    expect(far.organelles).toEqual([]);
  });

  it('plays clips into the instance: an eat pulse and a protocell halo kind', () => {
    const state = new CellRenderState(entityId('p'), createSeededRandom(TEST_SEED));
    state.clips.play(MOTION_CLIPS.eat, 1000);
    const output = state.update(createTestCellView({ id: entityId('p'), radius: 20 }), context({ nowMs: 1160 }));
    expect(output.instance.pulse).toBeCloseTo(1.09, 9);
    expect(output.instance.haloKind).toBe(HALO_KIND.protocell);
    expect(output.instance.isProtocell).toBe(true);
    expect(output.instance.haloRadiiScale).toBeCloseTo(1.5, 9);
  });
});
