import { describe, expect, it } from 'vitest';
import { CELL_STAGE, SEAT_MARK_BEADS } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { CELL_QUAD_EXTENT_RADII, FAR_DOT_HALO_RADII, HALO_KIND, SPRINT_RIM_BRIGHTNESS } from '../constants';
import { REST_DEFORMATION } from './cell-deformation';
import { cellLodFor } from './cell-lod';
import { buildCellInstance, quadExtentRadii, type CellInstanceInput } from './cell-instance-builder';
import { summariseCellTraits } from './cell-traits';
import { buildShapeTerms } from './shape-terms';

function input(overrides: Partial<CellInstanceInput> = {}): CellInstanceInput {
  const view = createTestCellView({ x: 5, y: 6, radius: 40, avatarIndex: 2, stage: CELL_STAGE.prokaryote });
  const traits = summariseCellTraits(view);
  const terms = buildShapeTerms({
    view,
    traits,
    timeSeconds: 0,
    speedRatio: 0,
    heading: 0,
    phase: 0,
    stripRow: 2,
    strip: null,
    deformation: REST_DEFORMATION,
  });
  return {
    view,
    traits,
    terms,
    lod: cellLodFor(40),
    speedRatio: 0,
    nucleusOffset: { x: -0.1, y: -0.1 },
    isOwn: false,
    cosmetic: { stripRow: 2, phase: 0.25 },
    alpha: 1,
    ...overrides,
  };
}

describe('buildCellInstance', () => {
  it('copies the view, the terms, the cosmetic values and the palette into the record', () => {
    const instance = buildCellInstance(input());
    expect(instance).toMatchObject({
      x: 5,
      y: 6,
      radius: 40,
      paletteIndex: 2,
      speedRatio: 0,
      lodBlend: 1,
      pulse: 1,
      alpha: 1,
      rimBrightness: 1,
      haloKind: HALO_KIND.default,
      isProtocell: false,
      isFarDot: false,
      isOwn: false,
      nucleusOffsetX: -0.1,
      stripRow: 2,
      stripPhase: 0.25,
      lobesScale: 0,
      jitterAmplitude: 0,
    });
    expect(instance.beadCount).toBe(SEAT_MARK_BEADS[2]);
    expect(instance.bumps).toHaveLength(8);
  });

  it('brightens the rim on sprint and marks the own cell only while the tells are drawn', () => {
    const base = input();
    const sprinting = { ...base, terms: { ...base.terms, isSprinting: true } };
    expect(buildCellInstance(sprinting).rimBrightness).toBe(SPRINT_RIM_BRIGHTNESS);
    expect(buildCellInstance({ ...base, isOwn: true }).isOwn).toBe(true);
    expect(buildCellInstance({ ...base, alpha: 0.5 }).alpha).toBe(0.5);
    const far = { ...base, isOwn: true, lod: cellLodFor(4) };
    const farInstance = buildCellInstance(far);
    expect(farInstance.isOwn).toBe(false);
    expect(farInstance.isFarDot).toBe(true);
    expect(farInstance.beadCount).toBe(0);
  });

  it('sizes the quad to the §2 floor at rest and to the far-dot halo when the LOD asks', () => {
    const base = input();
    expect(quadExtentRadii(base.terms, base.lod)).toBe(CELL_QUAD_EXTENT_RADII);
    expect(quadExtentRadii(base.terms, cellLodFor(4))).toBe(Math.max(CELL_QUAD_EXTENT_RADII, FAR_DOT_HALO_RADII));
    const wide = { ...base.terms, maxRadii: CELL_QUAD_EXTENT_RADII + 1 };
    expect(quadExtentRadii(wide, base.lod)).toBe(CELL_QUAD_EXTENT_RADII + 1);
  });
});
