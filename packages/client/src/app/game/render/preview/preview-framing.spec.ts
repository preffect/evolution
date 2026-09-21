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
import { summariseCellTraits } from '../cells/cell-traits';
import { buildShapeTerms, headingOf } from '../cells/shape-terms';
import { appendageReachRadii } from '../cells/cell-draw-extent';
import {
  NOISE_STRIP_ROWS,
  PREVIEW_CELL_BODY_FILL_FRACTION,
  PREVIEW_CELL_DRAWN_FILL_FRACTION,
  PREVIEW_LENS_RIM_RADIUS_FRACTION,
  PREVIEW_LENS_SAFE_RADIUS_FRACTION,
  PREVIEW_SEED,
} from '../constants';
import { buildNoiseStrip } from '../noise/noise-strip';
import { previewSceneFor, type PreviewScene } from './preview-scene';
import { PREVIEW_SCENE, type PreviewSpec } from './preview-spec';
import { SUBJECT_SPECS } from './preview-subject-specs';

const BALANCE = DEFAULT_BALANCE;

interface CellDraw {
  readonly phase: number;
  readonly stripRow: number;
}

/**
 * The cosmetic phase and strip row `CellRenderState` would draw this cell with, in its order.
 *
 * **Cached by cell id, and it caches only what that key is valid for.** Both draws come from
 * `createSeededRandom(PREVIEW_SEED).fork(cosmetic).fork(cell:<id>)`, whose sole variable is the id, so the id is
 * the whole key — and those two string-hashing forks were the cost that put this spec on vitest's RPC timeout.
 *
 * The trait summary is deliberately **not** in here. It is pure in the cell's stage and traits, not its identity,
 * and every preview cell shares the id `'preview-cell'` (`cell-scene.ts`), so caching it under the id handed every
 * cell spec the first one's traits: all eleven collapsed to two measurements, split by motion alone. It is cheap
 * (a small map and some table lookups, next to two seeded forks), so it is recomputed rather than re-keyed —
 * a compound key would work today and break again the moment something with a third purity is added to the record.
 */
const cellDraws = new Map<string, CellDraw>();

function cellDrawOf(cell: CellView): CellDraw {
  const cached = cellDraws.get(cell.id);
  if (cached !== undefined) return cached;
  const cosmetic: RandomSource = createSeededRandom(PREVIEW_SEED)
    .fork(RANDOM_STREAM.cosmetic)
    .fork(`${COSMETIC_SUB_STREAM.cell}:${cell.id}`);
  const built: CellDraw = { phase: cosmetic.nextFloat(), stripRow: cosmetic.nextInt(0, NOISE_STRIP_ROWS - 1) };
  cellDraws.set(cell.id, built);
  return built;
}

const PREVIEW_STRIP = buildNoiseStrip(createSeededRandom(PREVIEW_SEED).fork(RANDOM_STREAM.cosmetic));

/**
 * How much of the fill fraction the **measured** worst tick must reach.
 *
 * It sits just under 1 rather than well under, because the bound a cell scene frames by turns out to be **tight**:
 * the only term `maxReachRadii` samples rather than bounds is the breathing sine, and every scene's loop is
 * hundreds of ticks long, so some tick of it lands on that sine's peak. Measured across every cell spec in
 * `SUBJECT_SPECS`, at both motions, the binding band came in at 1.0000 of its fill fraction every time; the
 * remaining hundredth is for a loop whose tick spacing straddles the peak less exactly.
 *
 * **Why it is this high and not a comfortable 0.9.** The framing it replaced — one `PREVIEW_CELL_VIEW_RADII` of
 * 4.4 — scores 0.333 on its worst row, but **0.9433** on its best: a tier-III flagellate, which is the case that
 * constant was sized for and so the one it got nearly right. A floor under about 0.95 would let a revert to 4.4
 * through on exactly the row it was tuned for, and catch it only elsewhere. That is the mistake this file exists
 * to refuse, so the floor sits above it.
 */
const MEASURED_FILL_FLOOR = 0.99;

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
  const { phase, stripRow } = cellDrawOf(cell);
  const traits = summariseCellTraits(cell);
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
    // The membrane is **measured** — the reach the renderer actually built this tick — and only the appendages
    // hanging off it come from `cell-draw-extent.ts`, the module the scene frames by. Taking the whole extent from
    // there would leave this file checking a bound against itself; taking the tail's length from a local copy
    // would leave the two free to drift apart.
    drawnWu: Math.max(terms.maxRadii, appendageReachRadii(traits, bodyRadii, terms.isSprinting)) * cell.radius,
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
      expect(drawn.fraction, `${spec.scene}: ${report(drawn)}`).toBeLessThanOrEqual(PREVIEW_LENS_RIM_RADIUS_FRACTION);
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

  /**
   * The other half of the bands, and the one ticket #364 exists for: a lens no **looser** than its subject needs.
   *
   * Staying inside 0.8 and 1.0 is satisfied perfectly by a subject drawn at a twentieth of the lens, which is very
   * nearly what the family had — one `PREVIEW_CELL_VIEW_RADII` of 4.4, sized for a tier-III flagellate's tail, put a
   * bare protocell's body at 0.26 of the lens radius. So this measures the gap between the lens a cell scene asks
   * for and the tightest one its own contents allow, and fails when the reader is being shown a speck.
   *
   * **Cell scenes only, and that is the claim, not a hedge.** They are the family that derives its lens from the
   * subject (`cell-scene.ts`); `food`, `dna_fragment` and `zone` are composed to fixed world radii, where the
   * cluster's spread and the dish texture — not a body — set what fills the lens.
   */
  it('frame every cell scene no looser than its own contents need', () => {
    for (const spec of SUBJECT_SPECS) {
      if (spec.scene !== PREVIEW_SCENE.cell) continue;
      const { body, drawn } = worstBandsOf(spec);
      const fill = Math.max(
        body.fraction / PREVIEW_CELL_BODY_FILL_FRACTION,
        drawn.fraction / PREVIEW_CELL_DRAWN_FILL_FRACTION,
      );
      expect(
        fill,
        `${spec.scene} (${spec.motion}) is framed ${(1 / fill).toFixed(2)}× looser than its contents need: ` +
          `${report(body)}, and ${report(drawn)}. A cell scene's lens comes from cellDrawExtentRadii, which bounds ` +
          'every term the renderer samples, so the measured worst tick lands a little inside the fill fractions — ' +
          `but only a little. ${MEASURED_FILL_FLOOR} is the gap measured across SUBJECT_SPECS with room to spare; ` +
          'a number far under it means the framing stopped following the subject, not that the bound loosened.',
      ).toBeGreaterThanOrEqual(MEASURED_FILL_FLOOR);
    }
  });
});
