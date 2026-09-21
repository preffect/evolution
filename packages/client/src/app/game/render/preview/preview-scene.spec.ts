// @vitest-environment node
// The preview scenes (docs/architecture/encyclopedia.md §12.7, §12.9): that `previewSceneFor` is total over
// `PREVIEW_SCENE`, which families ticket #364 still owes, that a scene is a pure function of its tick, and that
// each zone scene parks where the simulation agrees that zone is.
//
// The framing bands are `preview-framing.spec.ts` and the loop is `preview-loop.spec.ts`; both walk the same
// `SUBJECT_SPECS` this file does, so a family added here is covered there too.

import {
  CELL_KIND,
  CELL_STAGE,
  DEFAULT_BALANCE,
  ZONE_ID,
  maxSpeedForMass,
  zoneAt,
  type ZoneId,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { PREVIEW_GEL_PATCHES } from '../constants';
import { PREVIEW_SCENES_AWAITING_BUILDERS, previewSceneFor, type PreviewScene } from './preview-scene';
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

  /**
   * Ticket #364 owes the five action families a builder. Until it lands they share the open-broth stand-in; when
   * one gets its own scene this expectation fails, which is the point — the list cannot quietly go stale.
   */
  it('shows the stand-in for exactly the families ticket #364 still owes', () => {
    const standInFraming = previewSceneFor({ scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth }).framing(BALANCE);
    /**
     * A scene is "the stand-in" when its framing is indistinguishable from the open-broth zone scene's. It compares
     * exactly three numbers — `framing.viewRadiusWu` and `framing.target.x` / `.y` — and nothing else, which is why
     * the failure messages below have to offer both causes: it cannot tell an unreached builder from a builder that
     * is reached and framed like the stand-in.
     */
    const isStandIn = (spec: PreviewSpec): boolean => {
      const framing = previewSceneFor(spec).framing(BALANCE);
      return (
        framing.viewRadiusWu === standInFraming.viewRadiusWu &&
        framing.target.x === standInFraming.target.x &&
        framing.target.y === standInFraming.target.y
      );
    };
    for (const scene of PREVIEW_SCENES_AWAITING_BUILDERS) {
      expect(
        isStandIn({ scene }),
        `"${scene}" no longer frames like ticket #364's stand-in, which means one of two things. Either it has a ` +
          'builder of its own now, in which case nothing is broken: drop it from PREVIEW_SCENES_AWAITING_BUILDERS ' +
          'in preview-scene.ts and add a spec for it to SUBJECT_SPECS, so preview-framing.spec.ts starts covering ' +
          'it. Or the stand-in itself moved — this compares only viewRadiusWu and target.x/target.y against the ' +
          'openBroth zone scene, so retuning PREVIEW_ZONE_VIEW_RADIUS_WU or PREVIEW_ZONE_CENTRE_WU[openBroth] ' +
          'shows up here too.',
      ).toBe(true);
    }
    for (const spec of SUBJECT_SPECS) {
      if (spec.scene === PREVIEW_SCENE.zone && spec.zone === ZONE_ID.openBroth) continue;
      expect(
        isStandIn(spec),
        `"${spec.scene}" is a scene ticket #363 built, but its framing is now indistinguishable from ticket #364's ` +
          'stand-in. Two causes, and this check cannot separate them because it compares only viewRadiusWu and ' +
          'target.x/target.y: either previewSceneFor no longer reaches its builder (check the switch in ' +
          'preview-scene.ts), or the builder is reached perfectly normally and its framing has drifted onto the ' +
          "stand-in's. Drift is the likelier one for the cell family, whose SUBJECT_CENTRE is already the openBroth " +
          'centre the stand-in parks on — so viewRadiusWu is the only number separating them, and a cell scene ' +
          'derives that from its subject (cellDrawExtentRadii, the fill fractions, the preview mass), so retuning ' +
          'any of those alone will fire this.',
      ).toBe(false);
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
  it('swims at the full speed ratio at every tick, and holds still at rest', () => {
    const scene = previewSceneFor(swimming);
    for (const tick of loopTicks(scene)) {
      const [cell] = scene.frameAt(tick, tick, BALANCE).cells;
      const speed = Math.hypot(cell!.velocityX, cell!.velocityY);
      expect(speed / maxSpeedForMass(cell!.mass, BALANCE.growth), `tick ${tick}`).toBeCloseTo(1, 9);
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
