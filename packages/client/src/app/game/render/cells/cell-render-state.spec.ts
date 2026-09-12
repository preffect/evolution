import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, SEAT_MARK_BEADS, createSeededRandom, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { CELL_QUAD_EXTENT_RADII, HALO_KIND, NUCLEUS_OFFSET_TOWARD_LIGHT, ORGANELLE_KIND } from '../constants';
import { buildNoiseStrip } from '../noise/noise-strip';
import { REST_DEFORMATION } from './cell-deformation';
import { CellRenderState, type CellFrameContext } from './cell-render-state';
import { LOD_LEVEL } from './cell-lod';

const TEST_SEED = 42;
const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));

function context(overrides: Partial<CellFrameContext> = {}): CellFrameContext {
  return {
    timeSeconds: 1,
    zoom: 1,
    balance: DEFAULT_BALANCE,
    ownCell: null,
    strip,
    previewTraitId: null,
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
    ],
  });

const state = (id = 'e') => new CellRenderState(entityId(id), createSeededRandom(TEST_SEED));

describe('CellRenderState', () => {
  it('builds an instance at the view with the palette, the beads and the resting terms', () => {
    const output = state().update({ ...eukaryote(), avatarIndex: 3 }, context(), REST_DEFORMATION);
    expect(output.instance).toMatchObject({ x: 0, y: 0, radius: 40, paletteIndex: 3, speedRatio: 0, alpha: 1 });
    expect(output.instance.beadCount).toBe(SEAT_MARK_BEADS[3]);
    expect(output.instance.haloKind).toBe(HALO_KIND.default);
    expect(output.instance.quadExtentRadii).toBe(CELL_QUAD_EXTENT_RADII);
    expect(output.instance.jitterAmplitude).toBeGreaterThan(0);
    expect(output.lod.level).toBe(LOD_LEVEL.full);
  });

  it('places the organelles through the profile and points the nucleus offset at the nucleus sprite', () => {
    const output = state().update(eukaryote(), context(), REST_DEFORMATION);
    const kinds = output.organelles.map((placement) => placement.kind);
    expect(kinds.filter((kind) => kind === ORGANELLE_KIND.mitochondrion)).toHaveLength(2);
    const nucleus = output.organelles.find((placement) => placement.kind === ORGANELLE_KIND.nucleus)!;
    expect(output.instance.nucleusOffsetX).toBeCloseTo(nucleus.point.x / 40, 9);
    expect(output.instance.nucleusOffsetY).toBeCloseTo(nucleus.point.y / 40, 9);
    expect(Math.hypot(nucleus.point.x, nucleus.point.y) / 40).toBeCloseTo(NUCLEUS_OFFSET_TOWARD_LIGHT, 1);
  });

  it('keeps the slots across frames and appends on a tier-up', () => {
    const subject = state();
    const first = subject.update(eukaryote(), context(), REST_DEFORMATION);
    const second = subject.update(eukaryote(), context({ timeSeconds: 2 }), REST_DEFORMATION);
    expect(second.organelles.map((placement) => placement.slot)).toEqual(
      first.organelles.map((placement) => placement.slot),
    );
    const grown = {
      ...eukaryote(),
      traits: [...eukaryote().traits, { traitId: 'food_vacuole' as const, tier: 1 as const }],
    };
    const third = subject.update(grown, context(), REST_DEFORMATION);
    expect(third.organelles.length).toBeGreaterThan(second.organelles.length);
    const keptSlots = third.organelles.map((placement) => placement.slot);
    for (const placement of second.organelles) expect(keptSlots).toContain(placement.slot);
  });

  it('redraws the stack when the same cell climbs from protocell to eukaryote mid-session (#236)', () => {
    const subject = state();
    const protocell = { ...eukaryote(), level: 1, stage: CELL_STAGE.protocell, traits: [] };
    const before = subject.update(protocell, context(), REST_DEFORMATION);
    expect(before.instance.isProtocell).toBe(true);
    expect(before.instance.haloKind).toBe(HALO_KIND.protocell);
    expect(before.organelles.some((placement) => placement.kind === ORGANELLE_KIND.nucleus)).toBe(false);
    const after = subject.update({ ...eukaryote(), level: 5 }, context({ timeSeconds: 2 }), REST_DEFORMATION);
    expect(after.instance.isProtocell).toBe(false);
    expect(after.instance.haloKind).toBe(HALO_KIND.default);
    expect(after.organelles.some((placement) => placement.kind === ORGANELLE_KIND.nucleus)).toBe(true);
    expect(after.organelles.some((placement) => placement.kind === ORGANELLE_KIND.protocellGranule)).toBe(false);
  });

  it('reads the heading from the velocity and holds it at rest', () => {
    const subject = state();
    const moving = subject.update({ ...eukaryote(), velocityX: 0, velocityY: 50 }, context(), REST_DEFORMATION);
    expect(moving.instance.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(moving.instance.speedRatio).toBeGreaterThan(0);
    expect(moving.instance.speedRatio).toBeLessThanOrEqual(1);
    const resting = subject.update(eukaryote(), context(), REST_DEFORMATION);
    expect(resting.instance.heading).toBeCloseTo(Math.PI / 2, 9);
    expect(resting.instance.speedRatio).toBe(0);
  });

  it('marks the own cell and previews a trait on it', () => {
    const own = eukaryote();
    const output = state().update(own, context({ ownCell: own, previewTraitId: 'chloroplast' }), REST_DEFORMATION);
    expect(output.instance.isOwn).toBe(true);
    expect(output.traits.tierOf('chloroplast')).toBe(1);
    expect(output.organelles.some((placement) => placement.kind === ORGANELLE_KIND.chloroplast)).toBe(true);
    const other = { ...eukaryote(), id: entityId('other') };
    expect(state('other').update(other, context({ ownCell: own }), REST_DEFORMATION).instance.isOwn).toBe(false);
  });

  it('drops the tells, the sprites and the interior at the far dot', () => {
    const far = state().update(eukaryote(), context({ zoom: 0.1 }), REST_DEFORMATION);
    expect(far.lod.isFarDot).toBe(true);
    expect(far.instance.isFarDot).toBe(true);
    expect(far.instance.beadCount).toBe(0);
    expect(far.instance.lodBlend).toBe(0);
    expect(far.organelles).toEqual([]);
    expect(far.instance.nucleusOffsetX).toBe(0);
  });

  it('threads the cell’s deformation into the pulse, the alpha and the bump slots', () => {
    const dented = { bumps: [{ amplitude: -0.12, centre: 1, sigma: 0.4 }], pulse: 1.09, alpha: 0.5 };
    const output = state().update(eukaryote(), context(), dented);
    expect(output.instance.pulse).toBe(1.09);
    expect(output.instance.alpha).toBe(0.5);
    expect(output.instance.bumps[0]).toEqual(dented.bumps[0]);
    expect(output.instance.bumps).toHaveLength(8);
    expect(output.terms.pulse).toBe(1.09);
  });

  it('draws the same cosmetic phase and slots for the same seed and id', () => {
    const first = state().update(eukaryote(), context(), REST_DEFORMATION);
    const second = state().update(eukaryote(), context(), REST_DEFORMATION);
    expect(second.instance).toEqual(first.instance);
    expect(second.organelles).toEqual(first.organelles);
    expect(state('other').update(eukaryote(), context(), REST_DEFORMATION).instance.stripPhase).not.toBe(
      first.instance.stripPhase,
    );
  });
});
