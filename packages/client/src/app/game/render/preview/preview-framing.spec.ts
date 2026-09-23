// @vitest-environment node
// The framing bands (docs/architecture/encyclopedia.md §12.7, §12.9): every **body** inside
// `PREVIEW_LENS_SAFE_RADIUS_FRACTION` of the lens radius, every **drawn** extent inside the rim, so the round crop
// never cuts a subject off — and, the half ticket #364 added, a lens no **looser** than its subject needs.
//
// The measuring is `testing/preview-bands.ts`, which walks a scene tick by tick from the extents the renderer
// itself would draw, with the motion clips its effects start. Retuning `FLAGELLUM_LENGTH_RADII`, the halo, a
// motion clip, the preview mass, the swim orbit or a fill fraction therefore fails this file.

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
 * **The floor is set by one number: 0.9433.** That is what the framing this replaced — one
 * `PREVIEW_CELL_VIEW_RADII` of 4.4 — scores on its *best* row, a tier-III flagellate, which is the case the
 * constant was sized for and so the one it got nearly right (its worst row is 0.333). A floor at or under 0.9433
 * would let a revert to 4.4 through on exactly the row it was tuned for and catch it only elsewhere, which is the
 * mistake this file exists to refuse. Everything above that number is margin, and the margin is spent as follows.
 *
 * **Why it is this high and not a comfortable 0.9.** The framing it replaced — one `PREVIEW_CELL_VIEW_RADII` of
 * 4.4 — scores 0.333 on its worst row, but **0.9433** on its best: a tier-III flagellate, which is the case that
 * constant was sized for and so the one it got nearly right. A floor under about 0.95 would let a revert to 4.4
 * through on exactly the row it was tuned for, and catch it only elsewhere. That is the mistake this file exists
 * to refuse, so the floor sits above it.
 */
const MEASURED_FILL_FLOOR = 0.99;

/**
 * How much looser than its drawing a **tailed** cell's lens may be: the one surface term a framing bound cannot see.
 *
 * `appendageReachRadii` roots the tail on the membrane **at the rear**, as `cell-layer.ts`'s `flagellumSpec` does
 * (ticket #491 — rooting it on the widest membrane was 1.29× loose), and takes that membrane at the peak of every
 * surface term. But the rear is **one angle**, and the noise strip and the wobble's mode are fixed in the cell's
 * frame: whether the rear sits on a lobe's crest or in its trough depends on the heading. The lens must hold still
 * while a swimming subject's heading turns through its orbit, so the bound cannot take the heading, and the
 * measured tip lands a little inside it. Probed on the tier-II prokaryote at rest over 600 ticks: its rear peaks at
 * 1.07 to 1.14 radii across headings, against a heading-free bound of 1.148.
 *
 * Measured here: tier-II resting **0.9847**, the only row it matters for; both swimming rows fill 0.9996, since
 * their orbit carries the rear past its crest. 1.02 puts the floor at 0.971, 1.4 % under the worst row.
 *
 * **If a tailed row fails on this floor, find out why before raising this number, and never lower
 * `MEASURED_FILL_FLOOR`** — that would weaken every tail-less row too, and each of them fills 1.0000.
 */
const TAIL_ROOT_HEADING_SLACK = 1.02;

describe('the framing bands', () => {
  /**
   * §12.7's two bands, measured from `framing` in the canvas's square: every **body** inside
   * `PREVIEW_LENS_SAFE_RADIUS_FRACTION` of the lens radius, and every **drawn** extent — halo, flagellum, cilia,
   * and the motes and fragments — inside the rim, so the round crop never cuts anything off.
   *
   * **Coverage is `SUBJECT_SPECS`**: every family, the cell one spread across the ladder's real trait sets. The
   * two-cell scenes put two bodies through the band at once, the partner out at its start distance and the
   * predator wearing its arms, which is what the pair's framing (`engulf-pair.ts`) bounds twice.
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
      // A tail roots at one angle of the membrane, which a heading-free bound takes at its peak; see the slack.
      const hasTail = spec.traits.some((owned) => owned.traitId === FLAGELLUM_TRAIT);
      const floor = hasTail ? MEASURED_FILL_FLOOR / TAIL_ROOT_HEADING_SLACK : MEASURED_FILL_FLOOR;
      expect(
        fill,
        `${spec.scene} (${spec.motion}) is framed ${(1 / fill).toFixed(2)}× looser than its contents need: ` +
          `${reportBand(body)}, and ${reportBand(drawn)}. A cell scene's lens comes from cellDrawExtentRadii, which bounds ` +
          'every term the renderer samples, so the measured worst tick lands a little inside the fill fractions — ' +
          `but only a little: ${floor.toFixed(3)} is this row's floor. A number far under it means the framing ` +
          'stopped following the subject, not that the bound loosened — the single 4.4 constant this replaced ' +
          'scores 0.33 to 0.94 here. A tailed row gets TAIL_ROOT_HEADING_SLACK for the rear membrane a ' +
          'heading-free bound cannot sample; a tail-less row has to fill exactly.',
      ).toBeGreaterThanOrEqual(floor);
    }
  });
});
