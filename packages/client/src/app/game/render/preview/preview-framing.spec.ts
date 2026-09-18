// The framing bands (docs/architecture/encyclopedia.md §12.7, §12.9): every **body** inside
// `PREVIEW_LENS_SAFE_RADIUS_FRACTION` of the lens radius, every **drawn** extent inside the rim, so the round crop
// never cuts a subject off.
//
// The extents measured are the ones the renderer itself would draw — `buildShapeTerms`'s `maxRadii`, over the same
// cosmetic fork `CellRenderState` draws its phase and strip row from — rather than numbers copied out of a scene.
// Retuning `FLAGELLUM_LENGTH_RADII`, the halo, the preview mass or a view radius therefore fails this file.

import {
  COSMETIC_SUB_STREAM,
  DEFAULT_BALANCE,
  RANDOM_STREAM,
  TICK_INTERVAL_S,
  createSeededRandom,
  maxSpeedForMass,
  type CellView,
  type RandomSource,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { REST_DEFORMATION } from '../cells/cell-deformation';
import { summariseCellTraits, type CellTraitSummary } from '../cells/cell-traits';
import { buildShapeTerms, headingOf } from '../cells/shape-terms';
import {
  CILIA_OUTER_RADII,
  FLAGELLUM_AMPLITUDE_BY_TIER,
  FLAGELLUM_AMPLITUDE_RADII,
  FLAGELLUM_LENGTH_RADII,
  FLAGELLUM_SPRINT_AMPLITUDE_SCALE,
  NOISE_STRIP_ROWS,
  PREVIEW_LENS_SAFE_RADIUS_FRACTION,
  PREVIEW_SEED,
} from '../constants';
import { buildNoiseStrip } from '../noise/noise-strip';
import { previewSceneFor, type PreviewScene } from './preview-scene';
import { PREVIEW_SCENE, type PreviewSpec } from './preview-spec';
import { SUBJECT_SPECS } from './preview-subject-specs';

const BALANCE = DEFAULT_BALANCE;

interface CellCosmetic {
  readonly phase: number;
  readonly stripRow: number;
  readonly traits: CellTraitSummary;
}

/**
 * The cosmetic phase, strip row and trait summary `CellRenderState` would hold for this cell, in its order.
 *
 * **Cached by cell id, which is what keeps this spec off vitest's RPC timeout.** All three are pure in the cell's
 * identity and its traits, neither of which changes across the ticks of a loop, so recomputing them per tick was
 * the same two stream forks and the same trait walk thousands of times over. Nothing about the coverage changes:
 * every tick is still walked, and everything that *does* vary with time is still recomputed below.
 */
const cellCosmetics = new Map<string, CellCosmetic>();

function cosmeticOf(cell: CellView): CellCosmetic {
  const cached = cellCosmetics.get(cell.id);
  if (cached !== undefined) return cached;
  const cosmetic: RandomSource = createSeededRandom(PREVIEW_SEED)
    .fork(RANDOM_STREAM.cosmetic)
    .fork(`${COSMETIC_SUB_STREAM.cell}:${cell.id}`);
  const built: CellCosmetic = {
    phase: cosmetic.nextFloat(),
    stripRow: cosmetic.nextInt(0, NOISE_STRIP_ROWS - 1),
    traits: summariseCellTraits(cell),
  };
  cellCosmetics.set(cell.id, built);
  return built;
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
  const speedRatio = Math.min(
    1,
    Math.hypot(cell.velocityX, cell.velocityY) / maxSpeedForMass(cell.mass, BALANCE.growth),
  );
  const { phase, stripRow, traits } = cosmeticOf(cell);
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

interface WorstBand {
  /** The largest fraction of the lens radius anything reached, and the tick it reached it at. */
  readonly fraction: number;
  readonly atTick: number;
  readonly what: string;
}

interface WorstBands {
  readonly body: WorstBand;
  readonly drawn: WorstBand;
}

const NOTHING_DRAWN: WorstBand = { fraction: 0, atTick: 0, what: 'nothing drawn' };

function worse(current: WorstBand, fraction: number, atTick: number, what: string): WorstBand {
  return fraction > current.fraction ? { fraction, atTick, what } : current;
}

function walkWorstBands(spec: PreviewSpec): WorstBands {
  const scene = previewSceneFor(spec);
  const { target, viewRadiusWu } = scene.framing(BALANCE);
  let body = NOTHING_DRAWN;
  let drawn = NOTHING_DRAWN;
  for (const tick of loopTicks(scene)) {
    const frame = scene.frameAt(tick, tick, BALANCE);
    for (const cell of frame.cells) {
      const extents = cellExtents(cell, tick * TICK_INTERVAL_S);
      const centre = distanceFrom(target, cell);
      body = worse(body, (centre + extents.bodyWu) / viewRadiusWu, tick, `the body of ${cell.id}`);
      drawn = worse(drawn, (centre + extents.drawnWu) / viewRadiusWu, tick, `the drawn extent of ${cell.id}`);
    }
    for (const mote of frame.motes) {
      drawn = worse(drawn, distanceFrom(target, mote) / viewRadiusWu, tick, `the mote ${mote.id}`);
    }
    for (const fragment of frame.fragments) {
      drawn = worse(drawn, distanceFrom(target, fragment) / viewRadiusWu, tick, `the fragment ${fragment.id}`);
    }
  }
  return { body, drawn };
}

/** Keyed on the spec's identity, which is safe because `SUBJECT_SPECS` holds one stable object per subject. */
const worstBandsBySpec = new Map<PreviewSpec, WorstBands>();

/**
 * The worst body and worst drawn reach over **every tick of one loop**, as fractions of the lens radius.
 *
 * The walk is plain arithmetic and the assertions are two per scene rather than two per body per tick. That is
 * not a coverage cut — every tick is still measured — it is what keeps the spec off vitest's RPC timeout: at one
 * `expect` per body per tick this ran ~50 000 assertions and tipped over 5 s under load. The message it now
 * fails with is also the more useful one, since it names the worst tick and what was at it. The memo is the other
 * half of that: both tests below want the same walk for the same specs, and walking twice was twice the cost.
 */
function worstBandsOf(spec: PreviewSpec): WorstBands {
  const cached = worstBandsBySpec.get(spec);
  if (cached !== undefined) return cached;
  const walked = walkWorstBands(spec);
  worstBandsBySpec.set(spec, walked);
  return walked;
}

function report(band: WorstBand): string {
  return `${band.what} reached ${band.fraction.toFixed(3)} of the lens radius at tick ${band.atTick}`;
}

describe('the framing bands', () => {
  /**
   * §12.7's two bands, measured from `framing` in the canvas's square: every **body** inside
   * `PREVIEW_LENS_SAFE_RADIUS_FRACTION` of the lens radius, and every **drawn** extent — halo, flagellum, cilia,
   * and the motes and fragments — inside the rim, so the round crop never cuts anything off.
   *
   * **Coverage is `SUBJECT_SPECS`, and that is deliberate, not an omission.** Those are the scenes that exist: the
   * four families ticket #363 built, spread across the ladder's real trait sets. The five action families have no
   * bodies to measure until ticket #364 builds them, and the stand-in test above fails the moment one of them
   * does — which is what brings it into this list.
   */
  it('keep every body inside the safe radius and everything drawn inside the rim', () => {
    for (const spec of SUBJECT_SPECS) {
      const { body, drawn } = worstBandsOf(spec);
      expect(body.fraction, `${spec.scene}: ${report(body)}`).toBeLessThanOrEqual(PREVIEW_LENS_SAFE_RADIUS_FRACTION);
      expect(drawn.fraction, `${spec.scene}: ${report(drawn)}`).toBeLessThanOrEqual(1);
    }
  });

  /** A scene that drew nothing would pass both bands trivially, so every subject scene must put something on screen. */
  it('draw something in every subject scene, so the bands above are not vacuous', () => {
    for (const spec of SUBJECT_SPECS) {
      if (spec.scene === PREVIEW_SCENE.zone) continue;
      const { drawn } = worstBandsOf(spec);
      expect(drawn.fraction, `${spec.scene} drew nothing`).toBeGreaterThan(0);
    }
  });
});
