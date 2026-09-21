// @vitest-environment node
// The framing bands (docs/architecture/encyclopedia.md §12.7, §12.9): every **body** inside
// `PREVIEW_LENS_SAFE_RADIUS_FRACTION` of the lens radius, every **drawn** extent inside the rim, so the round crop
// never cuts a subject off — and, the half ticket #364 added, a lens no **looser** than its subject needs.
//
// The measuring is `testing/preview-bands.ts`, which walks a scene tick by tick from the extents the renderer
// itself would draw. Retuning `FLAGELLUM_LENGTH_RADII`, the halo, the preview mass, the swim orbit or a fill
// fraction therefore fails this file.

import { describe, expect, it } from 'vitest';
import { reportBand, worstBandsOf } from '../../../../testing/preview-bands';
import { FLAGELLUM_TRAIT } from '../cells/flagellum-lines';
import {
  PREVIEW_CELL_BODY_FILL_FRACTION,
  PREVIEW_CELL_DRAWN_FILL_FRACTION,
  PREVIEW_LENS_RIM_RADIUS_FRACTION,
  PREVIEW_LENS_SAFE_RADIUS_FRACTION,
} from '../constants';
import { PREVIEW_SCENE } from './preview-spec';
import { SUBJECT_SPECS } from './preview-subject-specs';

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

/**
 * How much looser than its drawing a **tailed** cell's lens is allowed to be.
 *
 * This is a real overstatement, not sampling noise, and it is a named constant rather than a quietly lowered
 * floor. `appendageReachRadii` roots the tail on the cell's **widest** membrane; `cell-layer.ts`'s
 * `flagellumSpec` roots the drawn tail on the membrane **at the rear**, which the speed stretch tapers. The bound
 * is therefore safe but loose, and a tailed cell is framed smaller than it needs to be — measured here at 1.07×
 * at rest and **1.19× at speed** (tier-III flagellum swimming, the worst row).
 *
 * Tightening it is ticket #491. It moves every tailed row's framing by about a fifth, which would be a third
 * framing change landing on top of ticket #488's orbit, so the call was to land the honest number now and the
 * tightening measured on its own. **When #491 lands this goes to 1**, and this spec is what will tell you.
 *
 * **If a tailed row fails on this floor, raise this number, never `MEASURED_FILL_FLOOR`.** The margin is thin by
 * design — 1.22 puts the floor at 0.811 against a worst measured row of 0.8387, about 3.4 % — because the slack
 * is a defect being tracked, not headroom being granted, and every point of it is framing a reader does not get.
 * The walk is deterministic, so this will not flake; a new row landing under it means that row's tail is rooted
 * even further inside its bound than the ones measured here, which is #491 getting worse rather than this
 * constant being wrong. Lowering `MEASURED_FILL_FLOOR` instead would quietly weaken every tail-less row too.
 */
const TAIL_BOUND_SLACK = 1.22;

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
      expect(body.fraction, `${spec.scene}: ${reportBand(body)}`).toBeLessThanOrEqual(
        PREVIEW_LENS_SAFE_RADIUS_FRACTION,
      );
      expect(drawn.fraction, `${spec.scene}: ${reportBand(drawn)}`).toBeLessThanOrEqual(
        PREVIEW_LENS_RIM_RADIUS_FRACTION,
      );
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
      // A tailed cell's lens comes from a bound that overstates its tail; every other row has to fill exactly.
      const hasTail = spec.traits.some((owned) => owned.traitId === FLAGELLUM_TRAIT);
      const floor = hasTail ? MEASURED_FILL_FLOOR / TAIL_BOUND_SLACK : MEASURED_FILL_FLOOR;
      expect(
        fill,
        `${spec.scene} (${spec.motion}) is framed ${(1 / fill).toFixed(2)}× looser than its contents need: ` +
          `${reportBand(body)}, and ${reportBand(drawn)}. A cell scene's lens comes from cellDrawExtentRadii, which bounds ` +
          'every term the renderer samples, so the measured worst tick lands a little inside the fill fractions — ' +
          `but only a little: ${floor.toFixed(3)} is this row's floor. A number far under it means the framing ` +
          'stopped following the subject, not that the bound loosened — the single 4.4 constant this replaced ' +
          'scores 0.33 to 0.94 here. A tailed row gets TAIL_BOUND_SLACK of extra room for the tail-root ' +
          'overstatement ticket #491 tightens; a tail-less row has to fill exactly.',
      ).toBeGreaterThanOrEqual(floor);
    }
  });
});
