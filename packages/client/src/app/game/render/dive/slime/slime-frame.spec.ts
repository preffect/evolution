// @vitest-environment node
// One frame of the slime band (docs/rendering/opening-dive.md §4, ticket #803): each part's switch by the test the
// mockup gave it — its size on screen, its grid's cell cap, the dark field — the fades, the caustics' drift, and the
// pocket's and the skin's widths, at the zooms the mockup's own shots were taken at.

import { describe, expect, it } from 'vitest';
import { KELP_DROP } from '../../constants/dive-kelp-drop';
import { SLIME_FLOOR, SLIME_POCKET, SLIME_POCKET_RADIUS_M } from '../../constants/dive-slime';
import { diveViewAt } from '../dive-view';
import { SLIME_MESH_NAMES, SLIME_NOTHING_SHOWN, slimeFrameOf, slimeShownOf } from './slime-frame';

const STAGE = { width: 830, height: 467 };
const frameAt = (zoom: number, timeSeconds = 0, viewport = STAGE) =>
  slimeFrameOf(diveViewAt({ zoom, viewport, timeSeconds, isMoving: false, globeIdleSpinDegrees: 0 }));

describe('slimeFrameOf', () => {
  it('shows the slime from just under its fade’s top down to inside the dish, over the drop while it shows', () => {
    expect(frameAt(-1.9).isShown).toBe(false);
    const inDrop = frameAt(-2.1);
    expect(inDrop.isShown).toBe(true);
    expect(inDrop.isOverTheDrop).toBe(true);
    expect(inDrop.slimeAlpha).toBeGreaterThan(0);
    expect(inDrop.slimeAlpha).toBeLessThan(1);
    expect(frameAt(-3.3).isOverTheDrop).toBe(false);
    expect(frameAt(-4.75).isShown).toBe(false);
  });

  it('clips to the drop and darkens the blade outside it only while the drop’s edge can be in view', () => {
    expect(frameAt(-3.6).isEdgeShown).toBe(true);
    expect(frameAt(-3.75).isEdgeShown).toBe(false);
    expect(frameAt(-2.4).isSkinShown).toBe(true);
    expect(frameAt(-3.75).isSkinShown).toBe(false);
  });

  it('brings the cells and the caustics up by the mockup’s fades, and takes the caustics away as the dark field comes', () => {
    expect(frameAt(-2.3).cellAlpha).toBe(0);
    expect(frameAt(-2.7).cellAlpha).toBeGreaterThan(0);
    expect(frameAt(-3).cellAlpha).toBe(1);
    expect(frameAt(-1.98).causticAlpha).toBe(0);
    expect(frameAt(-2.6).causticAlpha).toBe(1);
    const handoff = frameAt(-4);
    expect(handoff.darkField).toBeGreaterThan(0);
    expect(handoff.causticAlpha).toBeCloseTo(1 - handoff.darkField, 9);
  });

  it('drifts each caustic sheet by its own rate on the ambient clock', () => {
    const later = frameAt(-2.6, 10);
    const [sheet] = SLIME_FLOOR.caustic.sheets;
    const drift = 10 * sheet.tileM * SLIME_FLOOR.caustic.driftShare;
    expect(Array.from(later.caustics.slice(0, 4))).toEqual(
      [drift * sheet.driftX, drift * sheet.driftY, sheet.tileM, sheet.alpha].map((value) => Math.fround(value)),
    );
    expect(Array.from(frameAt(-2.6, 0).caustics.slice(0, 2))).toEqual([0, 0]);
  });

  it('draws each scatter while it is big enough on screen and its grid is under its cell cap', () => {
    // the clouds want 25 µm over 3 px; the diatoms 40 µm over 3 px; the bacteria a micrometre over 1.2 px
    expect(frameAt(-1.96).hasClouds).toBe(false);
    expect(frameAt(-2.6).hasClouds).toBe(true);
    expect(frameAt(-1.96).hasDiatoms).toBe(true);
    expect(frameAt(-2.9).hasRods).toBe(false);
    expect(frameAt(-3.6).hasRods).toBe(true);
    expect(frameAt(-3.6).hasMotes).toBe(false);
    expect(frameAt(-3.9).hasMotes).toBe(true);
    // a stage twice as tall sees twice the cells at the same zoom: the cap stops the clouds there
    const tall = { width: STAGE.width, height: STAGE.width * 2 };
    expect(frameAt(-2.6, 0, tall).hasClouds).toBe(false);
  });

  it('hands the pocket over to the game’s dish: drawn until the dark field is whole, the dark past its wall after', () => {
    const before = frameAt(-3.6);
    expect(before.isPocketShown).toBe(true);
    expect(before.isOutsideShown).toBe(false);
    expect(before.pocket.alpha).toBe(1);
    const during = frameAt(-4);
    expect(during.isPocketShown).toBe(true);
    expect(during.isOutsideShown).toBe(true);
    expect(during.pocket.alpha).toBeCloseTo(1 - during.darkField, 9);
    expect(frameAt(-4.3).isPocketShown).toBe(false);
  });

  it('widens the pocket’s ring, rim and arc to their least px close out, and sizes its quad round them', () => {
    const far = frameAt(-2.6);
    const radiusPx = SLIME_POCKET_RADIUS_M * far.pixelsPerMetre;
    expect(far.pocket.ringRadii).toBeCloseTo(SLIME_POCKET.ring.widthPx / radiusPx, 9);
    const near = frameAt(-4.1);
    expect(near.pocket.ringRadii).toBe(SLIME_POCKET.ring.width);
    expect(near.pocket.accentRadii).toBe(SLIME_POCKET.accent.width);
    expect(near.pocket.reachM).toBeGreaterThan(SLIME_POCKET_RADIUS_M * (1 + near.pocket.accentRadii));
  });

  it('draws the skin’s line and band at their least px far out, and at their share of the drop close in', () => {
    const far = frameAt(-2);
    expect(far.skin.lineM * far.pixelsPerMetre).toBeCloseTo(
      Math.max(3, KELP_DROP.radiusM * 0.006 * far.pixelsPerMetre),
      6,
    );
    const near = frameAt(-3.5);
    expect(near.skin.bandM).toBeCloseTo(KELP_DROP.radiusM * 0.03, 12);
    expect(near.skin.reachM).toBeGreaterThan(KELP_DROP.radiusM + near.skin.bandM / 2);
  });
});

describe('slimeShownOf', () => {
  it('shows nothing past the band, and the rods and specks only once their atlas is bound', () => {
    expect(slimeShownOf(frameAt(-1.9), true)).toBe(SLIME_NOTHING_SHOWN);
    const atTheDish = frameAt(-3.9);
    expect(slimeShownOf(atTheDish, false)).toMatchObject({ floor: true, plankton: true, rods: false, motes: false });
    expect(slimeShownOf(atTheDish, true)).toMatchObject({ rods: true, motes: true });
    expect(Object.keys(SLIME_NOTHING_SHOWN)).toEqual([...SLIME_MESH_NAMES]);
  });
});
