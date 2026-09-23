// @vitest-environment node
// The preview scenes (docs/architecture/encyclopedia.md §12.7, §12.9): that `previewSceneFor` is total over
// `PREVIEW_SCENE`, that a scene is a pure function of its tick, and that each zone scene parks where the
// simulation agrees that zone is.
//
// The framing bands are `preview-framing.spec.ts` and the loop is `preview-loop.spec.ts`; both walk the same
// `SUBJECT_SPECS` this file does, so a family added here is covered there too.

import { CELL_KIND, CELL_STAGE, DEFAULT_BALANCE, maxSpeedForMass, zoneAt, type ZoneId } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { PREVIEW_GEL_PATCHES, PREVIEW_SWIM_SPEED_FRACTION } from '../constants';
import { previewSceneFor, type PreviewScene } from './preview-scene';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from './preview-spec';
import { EVERY_FAMILY_SPECS, SUBJECT_SPECS, ZONE_IDS } from './preview-subject-specs';

const BALANCE = DEFAULT_BALANCE;

/** Every tick of one loop, at whole ticks, plus the loop's last fractional tick. */
function loopTicks(scene: PreviewScene): number[] {
  const period = scene.periodTicks(BALANCE);
  return [...Array.from({ length: Math.ceil(period) }, (_unused, tick) => tick), period];
}

describe('previewSceneFor', () => {
  it('resolves every PREVIEW_SCENE family to a scene', () => {
    expect(EVERY_FAMILY_SPECS.map((spec) => spec.scene)).toEqual(expect.arrayContaining(Object.values(PREVIEW_SCENE)));
    for (const spec of EVERY_FAMILY_SPECS) {
      const scene = previewSceneFor(spec);
      expect(scene.framing(BALANCE).viewRadiusWu, spec.scene).toBeGreaterThan(0);
      expect(scene.periodTicks(BALANCE), spec.scene).toBeGreaterThan(0);
    }
  });

  it('draws the same frame for the same spec and tick', () => {
    for (const spec of SUBJECT_SPECS) {
      const first = previewSceneFor(spec).frameAt(37, 36, BALANCE);
      const second = previewSceneFor(spec).frameAt(37, 36, BALANCE);
      expect(second, spec.scene).toEqual(first);
    }
  });
});

describe('the zone scenes', () => {
  it('park inside the zone they are about, by the simulation’s own rule', () => {
    for (const zone of ZONE_IDS) {
      const target = previewSceneFor({ scene: PREVIEW_SCENE.zone, zone }).framing(BALANCE).target;
      expect(zoneAt(target, PREVIEW_GEL_PATCHES, BALANCE), zone).toBe<ZoneId>(zone);
    }
  });
});

describe('the cell scene', () => {
  const swimming: PreviewSpec = {
    scene: PREVIEW_SCENE.cell,
    cellKind: CELL_KIND.player,
    traits: BENCH_STAGE_TRAITS[CELL_STAGE.eukaryote],
    motion: PREVIEW_MOTION.swimming,
  };
  const resting: PreviewSpec = { ...swimming, motion: PREVIEW_MOTION.resting };

  /** The swim is the cell's own top speed, so the stretch, the tail and the cilia beat read as they do in play. */
  it('swims at PREVIEW_SWIM_SPEED_FRACTION of top speed at every tick, and holds still at rest', () => {
    const scene = previewSceneFor(swimming);
    for (const tick of loopTicks(scene)) {
      const [cell] = scene.frameAt(tick, tick, BALANCE).cells;
      const speed = Math.hypot(cell!.velocityX, cell!.velocityY);
      expect(speed / maxSpeedForMass(cell!.mass, BALANCE.growth), `tick ${tick}`).toBeCloseTo(PREVIEW_SWIM_SPEED_FRACTION, 9);
    }
    const [still] = previewSceneFor(resting).frameAt(12, 11, BALANCE).cells;
    expect(Math.hypot(still!.velocityX, still!.velocityY)).toBe(0);
  });

  it('closes its loop: the first tick of the next loop repeats the first tick of this one', () => {
    const scene = previewSceneFor(swimming);
    const period = scene.periodTicks(BALANCE);
    expect(scene.frameAt(period, period, BALANCE)).toEqual(scene.frameAt(0, 0, BALANCE));
  });
});
