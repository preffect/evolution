// The framing bands (docs/architecture/encyclopedia.md §12.7, §12.9): every **body** inside
// `PREVIEW_LENS_SAFE_RADIUS_FRACTION` of the lens radius, every **drawn** extent inside the rim, so the round crop
// never cuts a subject off — and, the half ticket #364 added, a lens no **looser** than its subject needs.
//
// The measuring lives in `testing/preview-bands.ts`: it walks a scene tick by tick and reports the worst reach of
// each band, from the extents the renderer itself would build. Retuning `FLAGELLUM_LENGTH_RADII`, the halo, a
// motion clip, the preview mass or a fill fraction therefore fails this file.

import { describe, expect, it } from 'vitest';
import { reportBand, worstBandsOf } from '../../../../testing/preview-bands';
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
 * **The floor is set by one number: 0.9433.** That is what the framing this replaced — one
 * `PREVIEW_CELL_VIEW_RADII` of 4.4 — scores on its *best* row, a tier-III flagellate, which is the case the
 * constant was sized for and so the one it got nearly right (its worst row is 0.333). A floor at or under 0.9433
 * would let a revert to 4.4 through on exactly the row it was tuned for and catch it only elsewhere, which is the
 * mistake this file exists to refuse. Everything above that number is margin, and the margin is spent as follows.
 *
 * The `cell` family measures **1.0000** on every row: its bound's only sampled term is the breathing sine, and
 * its loops are hundreds of ticks long, so some tick lands on that sine's peak.
 *
 * The **action** scenes measure 0.992–0.9998, and the shortfall is tick quantisation rather than looseness.
 * `clipDeformationPeak` and `effectSpriteReachRadii` sample their clips at 240 steps, while this walk sees the
 * clip only at 60 Hz ticks — so a peak that falls between two ticks is bounded but never measured. `level_up` is
 * the worst at 0.9922, because its burst is short and its widest ripple passes between ticks. A floor of 0.99
 * would sit 0.2 % under that, close enough that lengthening the clip by a frame could fail this spec for a
 * reason that is not a framing defect — and a guard that fails for the wrong reason teaches people to re-run it
 * rather than read it.
 */
const MEASURED_FILL_FLOOR = 0.97;

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
      expect(
        fill,
        `${spec.scene} (${spec.motion}) is framed ${(1 / fill).toFixed(2)}× looser than its contents need: ` +
          `${reportBand(body)}, and ${reportBand(drawn)}. A cell scene's lens comes from cellDrawExtentRadii, which bounds ` +
          'every term the renderer samples, so the measured worst tick lands a little inside the fill fractions — ' +
          `but only a little — ${MEASURED_FILL_FLOOR} is the floor, and every scene measures 0.992 or better. ` +
          'A number far under it means the framing stopped following the subject, not that the bound loosened: ' +
          'the single 4.4 constant this replaced scores 0.33 to 0.94 here.',
      ).toBeGreaterThanOrEqual(MEASURED_FILL_FLOOR);
    }
  });
});
