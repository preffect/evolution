// docs/RENDERING.md §9: the ghost draws the last view at rest under the film, its organelle sprites
// at their rest slots fading with the body (#243), its nucleus disc at the rest slot (#231).
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, MOTION_CLIPS, createSeededRandom, entityId } from '@evolution/shared';
import { createTestCellView, createTestGhostSource } from '../../../../testing/builders';
import { NUCLEUS_RADIUS, ORGANELLE_KIND, PREY_UNDER_FILM_ALPHA, PROTOCELL_GRANULE_COUNT } from '../constants';
import { NUCLEUS_REST_OFFSET } from '../light-direction';
import { summariseCellTraits } from './cell-traits';
import { GhostRegistry, type Ghost } from './ghost-cells';
import { ghostFrame } from './ghost-instance';
import { NUCLEUS_KINDS } from './organelle-kinds';
import { layoutOrganelles } from './organelle-layout';
import { mapSlot } from './organelle-mapper';

const TEST_SEED = 7;
const TEST_RADIUS = 30;
const TEST_SPECKLE_SEED = 0.41;
const predator = { id: entityId('p'), x: 40, y: 0 };

const eukaryote = () =>
  createTestCellView({
    id: entityId('e'),
    radius: TEST_RADIUS,
    stage: CELL_STAGE.eukaryote,
    traits: [
      { traitId: 'nuclear_envelope', tier: 1 },
      { traitId: 'mitochondrion', tier: 2 },
    ],
  });

/** A ghost midway through the dissolve, its slots laid out as the living cell's would be. */
function midwayGhost(view = eukaryote()): Ghost {
  const registry = new GhostRegistry();
  const slots = layoutOrganelles(summariseCellTraits(view), createSeededRandom(TEST_SEED));
  registry.add(createTestGhostSource({ view, slots, speckleSeed: TEST_SPECKLE_SEED }), predator, 0);
  return registry.active(MOTION_CLIPS.absorbed.duration / 2)[0]!;
}

describe('ghostFrame', () => {
  it('draws the last view dissolving under the film with a dashed rim, at rest and without tells', () => {
    const prey = createTestCellView({
      id: entityId('g'),
      radius: 30,
      avatarIndex: 2,
      traits: [{ traitId: 'cilia', tier: 1 }],
    });
    const { instance, organelles } = ghostFrame(midwayGhost(prey), 1);
    expect(instance).toMatchObject({
      radius: 30,
      paletteIndex: 2,
      isOwn: false,
      warningRingPx: 0,
      passBAlpha: PREY_UNDER_FILM_ALPHA,
      speedRatio: 0,
      pulse: 1,
      ciliaCount: 24,
      speckleSeed: TEST_SPECKLE_SEED,
    });
    expect(instance.alpha).toBeCloseTo(0.5, 6);
    expect(instance.rimDash).toBe(1);
    expect(instance.bumps.every((slot) => slot.amplitude === 0)).toBe(true);
    expect(instance.nucleusDiscRadii).toBe(0);
    expect(organelles.map((placement) => placement.kind)).toEqual(
      Array.from({ length: PROTOCELL_GRANULE_COUNT }, () => ORGANELLE_KIND.protocellGranule),
    );
  });

  it('keeps a eukaryote’s organelle sprites and nucleus disc at their rest slots, fading with the cytoplasm (#243)', () => {
    const ghost = midwayGhost();
    const { instance, organelles, lod, terms } = ghostFrame(ghost, 1);
    expect(instance.nucleusDiscRadii).toBe(NUCLEUS_RADIUS);
    expect(instance.alpha).toBeCloseTo(0.5, 6);
    expect(lod.nucleusBlend).toBe(1);
    expect(organelles.map((placement) => placement.slot)).toEqual(ghost.slots);
    // At rest and drift-free: the slot mapped through the ghost's own profile, never the living
    // path's lag. That holds for any `B(Δ)`, not only today's circle.
    for (const placement of organelles) {
      expect(placement.point).toEqual(mapSlot(placement.slot.x, placement.slot.y, terms));
    }
    const nucleus = organelles.find((placement) => NUCLEUS_KINDS.has(placement.kind))!;
    expect(nucleus.slot.x).toBeCloseTo(NUCLEUS_REST_OFFSET.x, 12);
    expect(nucleus.slot.y).toBeCloseTo(NUCLEUS_REST_OFFSET.y, 12);
    // The shader's ramp disc anchors on the mapped nucleus sprite, so the two cannot separate.
    expect(instance.nucleusOffsetX).toBeCloseTo(nucleus.point.x / TEST_RADIUS, 12);
    expect(instance.nucleusOffsetY).toBeCloseTo(nucleus.point.y / TEST_RADIUS, 12);
  });

  it('places no sprites for a ghost below the far threshold, and no disc for the shader to anchor', () => {
    const { organelles, instance } = ghostFrame(midwayGhost(), 0.1);
    expect(organelles).toEqual([]);
    expect(instance.isFarDot).toBe(true);
    expect(instance.nucleusOffsetX).toBe(0);
    expect(instance.nucleusOffsetY).toBe(0);
  });
});
