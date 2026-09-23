import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, SEAT_MARK_BEADS, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import {
  CELL_QUAD_EXTENT_RADII,
  ENGULF_WARNING_RING_MIN_PX,
  FAR_DOT_HALO_RADII,
  FORM_ID,
  HALO_KIND,
  NUCLEUS_RADIUS,
  PREY_UNDER_FILM_ALPHA,
  RELATION_RING_MIN_GAP_PX,
  RELATION_RING_RADII,
  RELATION_RING_STROKE_PX,
  SELF_RING_ALPHA,
  SPRINT_RIM_BRIGHTNESS,
  TOXIC_RING_LINE_GAP_PX,
  WARNING_RING_STROKE_PX,
} from '../constants';
import { REST_DEFORMATION } from './cell-deformation';
import { cellLodFor } from './cell-lod';
import {
  buildCellInstance,
  quadExtentRadii,
  relationRingPackingFor,
  warningRingPxFor,
  type CellInstanceInput,
} from './cell-instance-builder';
import { summariseCellTraits } from './cell-traits';
import { REST_OWN_CELL_RING } from './self-ring';
import { buildShapeTerms } from './shape-terms';
import { RELATION_RING } from '../../hud/format/relations-for';

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
    cosmetic: { stripRow: 2, phase: 0.25, speckleSeed: 0.6 },
    alpha: 1,
    warningRingPx: 0,
    ciliaPhase: 0.3,
    rimDash: 0,
    ownCellRing: REST_OWN_CELL_RING,
    relationRing: RELATION_RING.none,
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
      ciliaCount: 0,
      wallScale: 0,
      speckleDensity: 0,
      filamentCount: 0,
      tintMix: 0,
      warningRingPx: 0,
      formId: FORM_ID.blob,
      passBAlpha: 1,
      rimDash: 0,
      ciliaPhase: 0.3,
      nucleusDiscRadii: 0,
      speckleSeed: 0.6,
      selfRingFill: 1,
      selfRingBrightness: SELF_RING_ALPHA,
      relationRingPx: 0,
      relationRingLines: RELATION_RING.none,
    });
    expect(instance.beadCount).toBe(SEAT_MARK_BEADS[2]);
    expect(instance.bumps).toHaveLength(8);
  });

  it('carries the trait tells and the form, snapping the membrane tells off with the far dot', () => {
    const view = createTestCellView({
      radius: 40,
      stage: CELL_STAGE.specialised,
      traits: [
        { traitId: 'cilia', tier: 1 },
        { traitId: 'cell_wall', tier: 2 },
        { traitId: 'ribosomes', tier: 3 },
        { traitId: 'cytoskeleton', tier: 1 },
        { traitId: 'chloroplast', tier: 1 },
        { traitId: 'diatom_shell', tier: 1 },
      ],
    });
    const traits = summariseCellTraits(view);
    const full = buildCellInstance(input({ view, traits }));
    expect(full).toMatchObject({
      ciliaCount: 24,
      wallScale: 2,
      speckleDensity: 60,
      filamentCount: 11,
      tintMix: 0.2,
      formId: FORM_ID.diatom,
      haloKind: HALO_KIND.chloroplast,
    });
    const far = buildCellInstance(input({ view, traits, lod: cellLodFor(4) }));
    expect(far).toMatchObject({ ciliaCount: 0, wallScale: 0, warningRingPx: 0 });
  });

  it('sizes the nucleus ramp disc to NUCLEUS_RADIUS with a nucleus and to 0 for a nucleoid or protocell (#231)', () => {
    const withNucleus = createTestCellView({
      radius: 40,
      stage: CELL_STAGE.eukaryote,
      traits: [{ traitId: 'nuclear_envelope', tier: 1 }],
    });
    const traits = summariseCellTraits(withNucleus);
    expect(buildCellInstance(input({ view: withNucleus, traits })).nucleusDiscRadii).toBe(NUCLEUS_RADIUS);
    const mid = buildCellInstance(input({ view: withNucleus, traits, lod: cellLodFor(12) }));
    expect(mid.nucleusDiscRadii).toBe(NUCLEUS_RADIUS);
    expect(mid.lodBlend).toBe(0);
    expect(buildCellInstance(input()).nucleusDiscRadii).toBe(0);
    const protocell = createTestCellView({ radius: 40, stage: CELL_STAGE.protocell });
    expect(buildCellInstance(input({ view: protocell, traits: summariseCellTraits(protocell) })).nucleusDiscRadii).toBe(
      0,
    );
  });

  it('films a prey under its predator and a ghost, and keeps the warning ring only with the tells', () => {
    const prey = createTestCellView({ radius: 40, engulfedByCellId: entityId('p') });
    expect(buildCellInstance(input({ view: prey })).passBAlpha).toBe(PREY_UNDER_FILM_ALPHA);
    expect(buildCellInstance(input({ rimDash: 1 })).passBAlpha).toBe(PREY_UNDER_FILM_ALPHA);
    const ringed = buildCellInstance(input({ warningRingPx: 200 }));
    expect(ringed.warningRingPx).toBe(200);
    expect(ringed.quadExtentRadii).toBeCloseTo((200 + WARNING_RING_STROKE_PX) / 40, 9);
    expect(buildCellInstance(input({ warningRingPx: 60 })).quadExtentRadii).toBe(CELL_QUAD_EXTENT_RADII);
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

  it('packs the sprint ring on the own cell only; every other cell carries the full rest ring (#295)', () => {
    const cooling = { fill: 0.4, brightness: 0.95, escapePredatorCellId: null, shouldHidePredatorRing: false };
    expect(buildCellInstance(input({ isOwn: true, ownCellRing: cooling }))).toMatchObject({
      selfRingFill: 0.4,
      selfRingBrightness: 0.95,
    });
    expect(buildCellInstance(input({ isOwn: false, ownCellRing: cooling }))).toMatchObject({
      selfRingFill: 1,
      selfRingBrightness: SELF_RING_ALPHA,
    });
  });

  it('sizes the quad to the §2 floor at rest and to the far-dot halo when the LOD asks', () => {
    const base = input();
    expect(quadExtentRadii(base.terms, base.lod)).toBe(CELL_QUAD_EXTENT_RADII);
    expect(quadExtentRadii(base.terms, cellLodFor(4))).toBe(Math.max(CELL_QUAD_EXTENT_RADII, FAR_DOT_HALO_RADII));
    const wide = { ...base.terms, maxRadii: CELL_QUAD_EXTENT_RADII + 1 };
    expect(quadExtentRadii(wide, base.lod)).toBe(CELL_QUAD_EXTENT_RADII + 1);
  });
});

describe('warningRingPxFor', () => {
  const own = createTestCellView({ id: entityId('own'), mass: 20, radius: 10 });
  const giant = createTestCellView({ id: entityId('giant'), mass: 200, radius: 40 });

  it('is the predator’s screen radius × 1.3 with the 24 px floor when it can engulf the own cell', () => {
    expect(warningRingPxFor(giant, own, DEFAULT_BALANCE, cellLodFor(40))).toBe(52);
    expect(warningRingPxFor(giant, own, DEFAULT_BALANCE, cellLodFor(10))).toBe(ENGULF_WARNING_RING_MIN_PX);
  });

  it('is 0 for the own cell itself, for a cell that cannot engulf it and with no own cell', () => {
    expect(warningRingPxFor(own, own, DEFAULT_BALANCE, cellLodFor(40))).toBe(0);
    expect(warningRingPxFor(own, giant, DEFAULT_BALANCE, cellLodFor(40))).toBe(0);
    expect(warningRingPxFor(giant, null, DEFAULT_BALANCE, cellLodFor(40))).toBe(0);
  });

  it('gates the ring on the LOD itself, so a far dot never grows its quad for an undrawn ring (#243)', () => {
    const far = cellLodFor(4);
    expect(warningRingPxFor(giant, own, DEFAULT_BALANCE, far)).toBe(0);
    const base = input({ lod: far, warningRingPx: warningRingPxFor(giant, own, DEFAULT_BALANCE, far) });
    expect(buildCellInstance(base).quadExtentRadii).toBe(quadExtentRadii(base.terms, far));
  });
});

describe('relationRingPackingFor', () => {
  it('packs the edible single line at RELATION_RING_RADII × r_px, and nothing for a cell with no relation', () => {
    expect(relationRingPackingFor(RELATION_RING.edible, cellLodFor(40), 0)).toEqual({
      relationRingPx: RELATION_RING_RADII * 40,
      relationRingLines: 1,
    });
    expect(relationRingPackingFor(RELATION_RING.none, cellLodFor(40), 0)).toEqual({
      relationRingPx: 0,
      relationRingLines: 0,
    });
  });

  it('packs the toxic double line, and floors the radius RELATION_RING_MIN_GAP_PX past a small membrane', () => {
    const small = cellLodFor(12);
    expect(RELATION_RING_RADII * 12).toBeLessThan(12 + RELATION_RING_MIN_GAP_PX);
    expect(relationRingPackingFor(RELATION_RING.toxic, small, 0)).toEqual({
      relationRingPx: 12 + RELATION_RING_MIN_GAP_PX,
      relationRingLines: 2,
    });
  });

  it('packs no relation ring on a threat or below the far LOD threshold', () => {
    expect(relationRingPackingFor(RELATION_RING.toxic, cellLodFor(40), 52).relationRingPx).toBe(0);
    expect(relationRingPackingFor(RELATION_RING.edible, cellLodFor(4), 0).relationRingPx).toBe(0);
  });

  it('grows the quad to the toxic ring’s outer line, one stroke plus the gap past the inner', () => {
    const { terms, lod } = input();
    const ringPx = 10;
    const tiny = { ...lod, screenRadiusPx: 1 };
    const edible = quadExtentRadii(terms, tiny, { warningRingPx: 0, relationRingPx: ringPx, relationRingLines: 1 });
    const toxic = quadExtentRadii(terms, tiny, { warningRingPx: 0, relationRingPx: ringPx, relationRingLines: 2 });
    expect(edible).toBe(ringPx + RELATION_RING_STROKE_PX);
    expect(toxic).toBe(ringPx + RELATION_RING_STROKE_PX + TOXIC_RING_LINE_GAP_PX + RELATION_RING_STROKE_PX);
    const built = buildCellInstance(input({ relationRing: RELATION_RING.toxic }));
    expect(built.quadExtentRadii).toBe(CELL_QUAD_EXTENT_RADII);
  });
});
