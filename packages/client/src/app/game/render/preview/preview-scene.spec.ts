// The preview scenes (docs/architecture/encyclopedia.md §12.7, §12.9). Two things are pinned here that nothing
// else can see: the **loop**, which must emit each of its effects once and must not replay every loop a hidden
// tab slept through, and the **framing bands**, which are what stops the lens cropping a subject.
//
// The framing check measures the extents the renderer itself would draw — `buildShapeTerms`'s `maxRadii`, over
// the same cosmetic fork `CellRenderState` draws its phase and strip row from — rather than a number copied out
// of the scene, so retuning `FLAGELLUM_LENGTH_RADII`, the halo, the preview mass or a view radius fails it.

import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  CELL_KIND,
  CELL_STAGE,
  COSMETIC_SUB_STREAM,
  DEFAULT_BALANCE,
  DNA_TAG,
  FOOD_KIND,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  ZONE_ID,
  createSeededRandom,
  maxSpeedForMass,
  zoneAt,
  type CellView,
  type RandomSource,
  type ZoneId,
} from '@evolution/shared';
import { BENCH_STAGE_TRAITS } from '../bench/bench-traits';
import { buildNoiseStrip } from '../noise/noise-strip';
import { REST_DEFORMATION } from '../cells/cell-deformation';
import { summariseCellTraits } from '../cells/cell-traits';
import { buildShapeTerms, headingOf } from '../cells/shape-terms';
import {
  CILIA_OUTER_RADII,
  NOISE_STRIP_ROWS,
  FLAGELLUM_AMPLITUDE_BY_TIER,
  FLAGELLUM_AMPLITUDE_RADII,
  FLAGELLUM_LENGTH_RADII,
  FLAGELLUM_SPRINT_AMPLITUDE_SCALE,
  PREVIEW_GEL_PATCHES,
  PREVIEW_LENS_SAFE_RADIUS_FRACTION,
  PREVIEW_SEED,
} from '../constants';
import { PREVIEW_SCENES_AWAITING_BUILDERS, previewSceneFor, type PreviewScene } from './preview-scene';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from './preview-spec';

const BALANCE = DEFAULT_BALANCE;
const ZONE_IDS = Object.values(ZONE_ID);

/** One spec per family, plus a spread of the cell family across the ladder's real trait sets. */
const SUBJECT_SPECS: readonly PreviewSpec[] = [
  ...Object.values(CELL_STAGE).flatMap((stage): PreviewSpec[] =>
    Object.values(PREVIEW_MOTION).map((motion) => ({
      scene: PREVIEW_SCENE.cell,
      cellKind: CELL_KIND.player,
      traits: BENCH_STAGE_TRAITS[stage],
      motion,
    })),
  ),
  { scene: PREVIEW_SCENE.cell, cellKind: CELL_KIND.wild, traits: [], motion: PREVIEW_MOTION.resting },
  ...Object.values(FOOD_KIND).map((foodKind): PreviewSpec => ({
    scene: PREVIEW_SCENE.food,
    foodKind,
    bacteriumVariant: foodKind === FOOD_KIND.bacterium ? BACTERIUM_VARIANT.aerobic : null,
  })),
  ...Object.values(DNA_TAG).map((tag): PreviewSpec => ({ scene: PREVIEW_SCENE.dnaFragment, tag })),
  ...ZONE_IDS.map((zone): PreviewSpec => ({ scene: PREVIEW_SCENE.zone, zone })),
];

/** Every family in `PREVIEW_SCENE`, one spec each: what `previewSceneFor` must be total over. */
const EVERY_FAMILY_SPECS: readonly PreviewSpec[] = [
  ...SUBJECT_SPECS,
  ...PREVIEW_SCENES_AWAITING_BUILDERS.map((scene): PreviewSpec => ({ scene })),
];

/** The cosmetic phase and strip row `CellRenderState` would draw for this cell, in its order. */
function cosmeticOf(cell: CellView): { phase: number; stripRow: number } {
  const cosmetic: RandomSource = createSeededRandom(PREVIEW_SEED)
    .fork(RANDOM_STREAM.cosmetic)
    .fork(`${COSMETIC_SUB_STREAM.cell}:${cell.id}`);
  return { phase: cosmetic.nextFloat(), stripRow: cosmetic.nextInt(0, NOISE_STRIP_ROWS - 1) };
}

const PREVIEW_STRIP = buildNoiseStrip(createSeededRandom(PREVIEW_SEED).fork(RANDOM_STREAM.cosmetic));

/** The worst wave a flagellum can add, in radii: the top tier, sprinting. */
const WORST_FLAGELLUM_AMPLITUDE_RADII =
  FLAGELLUM_AMPLITUDE_RADII * Math.max(...FLAGELLUM_AMPLITUDE_BY_TIER) * FLAGELLUM_SPRINT_AMPLITUDE_SCALE;

interface CellExtentsWu {
  /** The membrane at its widest: `maxRadii` with the halo taken back out. */
  readonly bodyWu: number;
  /** The widest anything is drawn: the halo, or the flagellum's tip past the membrane, or the cilia. */
  readonly drawnWu: number;
}

function cellExtents(cell: CellView, timeSeconds: number): CellExtentsWu {
  const traits = summariseCellTraits(cell);
  const speedRatio = Math.min(
    1,
    Math.hypot(cell.velocityX, cell.velocityY) / maxSpeedForMass(cell.mass, BALANCE.growth),
  );
  const { phase, stripRow } = cosmeticOf(cell);
  const terms = buildShapeTerms({
    view: cell,
    traits,
    timeSeconds,
    speedRatio,
    heading: headingOf(cell, speedRatio, 0),
    phase,
    stripRow,
    strip: PREVIEW_STRIP,
    deformation: REST_DEFORMATION,
  });
  const bodyRadii = terms.maxRadii / terms.haloOuterRadii;
  return {
    bodyWu: bodyRadii * cell.radius,
    drawnWu:
      Math.max(
        terms.maxRadii,
        CILIA_OUTER_RADII,
        bodyRadii + FLAGELLUM_LENGTH_RADII + WORST_FLAGELLUM_AMPLITUDE_RADII,
      ) * cell.radius,
  };
}

function distanceFrom(target: { readonly x: number; readonly y: number }, point: { x: number; y: number }): number {
  return Math.hypot(point.x - target.x, point.y - target.y);
}

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
    const standIn = previewSceneFor({ scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth });
    const isStandIn = (spec: PreviewSpec): boolean => {
      const framing = previewSceneFor(spec).framing(BALANCE);
      return (
        framing.viewRadiusWu === standIn.framing(BALANCE).viewRadiusWu &&
        framing.target.x === standIn.framing(BALANCE).target.x &&
        framing.target.y === standIn.framing(BALANCE).target.y
      );
    };
    for (const scene of PREVIEW_SCENES_AWAITING_BUILDERS) {
      expect(
        isStandIn({ scene }),
        `"${scene}" now draws a scene of its own, so ticket #364 has built it. Nothing is broken: drop "${scene}" ` +
          'from PREVIEW_SCENES_AWAITING_BUILDERS in preview-scene.ts and add it to SUBJECT_SPECS, so the framing ' +
          'bands below start covering it.',
      ).toBe(true);
    }
    for (const spec of SUBJECT_SPECS) {
      if (spec.scene === PREVIEW_SCENE.zone && spec.zone === ZONE_ID.openBroth) continue;
      expect(
        isStandIn(spec),
        `"${spec.scene}" is a scene ticket #363 built, but it is drawing ticket #364's stand-in: its builder is ` +
          'not reached by previewSceneFor.',
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

describe('the framing bands', () => {
  /**
   * §12.7's two bands, measured from `framing` in the canvas's square: every **body** inside
   * `PREVIEW_LENS_SAFE_RADIUS_FRACTION` of the lens radius, and every **drawn** extent — halo, flagellum, cilia,
   * and the motes and fragments — inside the rim, so the round crop never cuts anything off.
   *
   * **Coverage is `SUBJECT_SPECS`, and that is deliberate, not an omission.** Those are the scenes that exist: the
   * four families ticket #363 built, spread across the ladder's real trait sets. The five action families have no
   * bodies to measure until ticket #364 builds them, and the test above fails the moment one of them does — which
   * is what brings it into this list.
   */
  it('keep every body inside the safe radius and everything drawn inside the rim', () => {
    for (const spec of SUBJECT_SPECS) {
      const scene = previewSceneFor(spec);
      const { target, viewRadiusWu } = scene.framing(BALANCE);
      const safeWu = viewRadiusWu * PREVIEW_LENS_SAFE_RADIUS_FRACTION;
      for (const tick of loopTicks(scene)) {
        const frame = scene.frameAt(tick, tick, BALANCE);
        for (const cell of frame.cells) {
          const extents = cellExtents(cell, tick * TICK_INTERVAL_S);
          const centre = distanceFrom(target, cell);
          expect(centre + extents.bodyWu, `${spec.scene} body at tick ${tick}`).toBeLessThanOrEqual(safeWu);
          expect(centre + extents.drawnWu, `${spec.scene} drawn at tick ${tick}`).toBeLessThanOrEqual(viewRadiusWu);
        }
        for (const mote of frame.motes) {
          expect(distanceFrom(target, mote), `${spec.scene} mote at tick ${tick}`).toBeLessThanOrEqual(viewRadiusWu);
        }
        for (const fragment of frame.fragments) {
          expect(distanceFrom(target, fragment), `${spec.scene} fragment`).toBeLessThanOrEqual(viewRadiusWu);
        }
      }
    }
  });
});
