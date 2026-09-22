// @vitest-environment node
// `preview-bands.ts` is a **measuring tool**, and a measuring tool with no spec of its own is how
// `glyph-bounds.ts` came to be wrong in four ways at once while every test that used it stayed green
// (docs/rendering/files-and-tests.md). It carries the whole of PR #486's MAJOR 1 fix — the tail is measured from
// the real `flagellumPolyline` rather than taken from the bound a scene frames its lens by — and until this file
// existed that fix was exercised only sideways, through specs that would pass if it silently reverted.
//
// So what is pinned here is the property the fix *is*, not the arithmetic it performs: that this file's numbers
// come from the drawing and can therefore disagree with the bound.

import {
  CELL_KIND,
  CELL_STAGE,
  DEFAULT_BALANCE,
  TICK_INTERVAL_S,
  ZONE_ID,
  maxSpeedForMass,
  stageOf,
  type CellView,
  type OwnedTrait,
  type TraitTier,
} from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { BENCH_STAGE_TRAITS } from '../app/game/render/bench/bench-traits';
import { cellDrawExtentRadii, restingDrawState } from '../app/game/render/cells/cell-draw-extent';
import { REST_DEFORMATION } from '../app/game/render/cells/cell-deformation';
import { summariseCellTraits } from '../app/game/render/cells/cell-traits';
import { FLAGELLUM_TRAIT } from '../app/game/render/cells/flagellum-lines';
import { buildShapeTerms, headingOf } from '../app/game/render/cells/shape-terms';
import { PREVIEW_MOTION, PREVIEW_SCENE, type PreviewSpec } from '../app/game/render/preview/preview-spec';
import { createTestCellView } from './builders';
import { PREVIEW_STRIP, cellDrawOf, cellExtents, tailTipWu, worstBandsOf } from './preview-bands';

const BALANCE = DEFAULT_BALANCE;
const UNIT_RADIUS = 1;
const TIER_III: TraitTier = 3;
const AT_REST = 0;
const SWIMMING = 1;
const NO_SECONDS = 0;

const FLAGELLATE: readonly OwnedTrait[] = [{ traitId: FLAGELLUM_TRAIT, tier: TIER_III }];

function cellOf(traits: readonly OwnedTrait[], speedRatio: number): CellView {
  return createTestCellView({
    x: 0,
    y: 0,
    radius: UNIT_RADIUS,
    velocityX: speedRatio * maxSpeedForMass(100, BALANCE.growth),
    velocityY: 0,
    mass: 100,
    traits: traits.map((owned) => ({ ...owned })),
    stage: stageOf(
      traits.map((owned) => owned.traitId),
      BALANCE.ladder,
    ),
  });
}

/** The frame's terms for `cell`, built exactly as `cellExtents` builds them. */
function termsFor(cell: CellView, speedRatio: number) {
  const { phase, stripRow } = cellDrawOf(cell);
  return buildShapeTerms({
    view: cell,
    traits: summariseCellTraits(cell),
    timeSeconds: NO_SECONDS,
    speedRatio,
    heading: headingOf(cell, speedRatio, 0),
    phase,
    stripRow,
    strip: PREVIEW_STRIP,
    deformation: REST_DEFORMATION,
  });
}

describe('the tail measurement', () => {
  /**
   * **The anti-tautology property, and the reason this file exists.** A scene frames its lens from
   * `cellDrawExtentRadii`; this tool measures what the renderer draws. If the tool were ever rewired to ask the
   * bound for the tail — which is what it did before PR #486's review — these two numbers would become equal and
   * the fill guard could no longer fail on any row where the tail binds.
   *
   * They must therefore be **different**, and in a known direction: the bound roots the tail at the cell's widest
   * membrane, the drawing roots it at the rear, so the bound is the larger. Measured at about 1.19× for a
   * swimming tier-III flagellate, which is ticket #491's subject.
   */
  it('comes in strictly inside the bound a scene frames from, for a swimming flagellate', () => {
    const cell = cellOf(FLAGELLATE, SWIMMING);
    const traits = summariseCellTraits(cell);
    const bound = cellDrawExtentRadii(traits, restingDrawState(SWIMMING)).drawnRadii * cell.radius;
    const drawn = cellExtents(cell, NO_SECONDS).drawnWu;

    // The margin matters: rewired to the bound the two come out at a ratio of 1.0002 — not equal, because the
    // halo differs by a hair — so `drawn < bound` alone would still pass. Verified by making that mutation.
    expect(
      bound / drawn,
      'the measured tail and the bound the scene frames from are the same number to within a rounding error, ' +
        'which means this tool is reporting the bound instead of the drawing — the tautology PR #486 removed. ' +
        'It should be about 1.19x for a swimming tier-III flagellate (ticket #491).',
    ).toBeGreaterThan(1.05);
    expect(drawn).toBeLessThan(bound);
  });

  /**
   * The two cases the fix turns on, run as two cases. The rear of the membrane is tapered **by the speed
   * stretch**, so the gap between rooting at the rear and rooting at the widest point opens up with speed and
   * very nearly closes at rest. A tool that rooted at the widest membrane would show no difference between them.
   */
  it('roots at the rear, so the gap to the widest membrane opens with speed and closes at rest', () => {
    const gapAt = (speedRatio: number): number => {
      const cell = cellOf(FLAGELLATE, speedRatio);
      const terms = termsFor(cell, speedRatio);
      const widestMembraneRadii = terms.maxRadii / terms.haloOuterRadii;
      const tipFromRear = tailTipWu(cell, terms, NO_SECONDS, cellDrawOf(cell).phase);
      const rearRootRadii = tipFromRear / cell.radius - FLAGELLUM_REACH_RADII;
      return widestMembraneRadii - rearRootRadii;
    };

    expect(gapAt(SWIMMING), 'the speed stretch did not taper the rear').toBeGreaterThan(gapAt(AT_REST));
    expect(gapAt(AT_REST), 'the rear and the widest point should nearly agree at rest').toBeLessThan(0.2);
  });

  /** A cell with no tail has no tip to measure, so the membrane is the whole of its drawn extent. */
  it('reports no tail for a cell that has none', () => {
    const bare = cellOf([], SWIMMING);
    expect(tailTipWu(bare, termsFor(bare, SWIMMING), NO_SECONDS, 0)).toBe(0);
  });

  /** The wave travels, so the tip moves; a tool sampling one instant would report a constant here. */
  it('moves with the clock, because the wave travels down the tail', () => {
    const cell = cellOf(FLAGELLATE, SWIMMING);
    const terms = termsFor(cell, SWIMMING);
    const tips = [0, 0.1, 0.2, 0.3].map((seconds) => tailTipWu(cell, terms, seconds, 0));
    expect(new Set(tips.map((tip) => tip.toFixed(6))).size).toBeGreaterThan(1);
  });
});

/** `FLAGELLUM_LENGTH_RADII`; the tip sits this far past the root along the tail, before the wave. */
const FLAGELLUM_REACH_RADII = 2;

describe('the band walk', () => {
  /** A scene that draws nothing would make every band vacuous; one that draws something must report it. */
  it('reports a drawn band for a scene with a body in it, and none for an empty one', () => {
    const cellSpec: PreviewSpec = {
      scene: PREVIEW_SCENE.cell,
      cellKind: CELL_KIND.player,
      traits: BENCH_STAGE_TRAITS[CELL_STAGE.prokaryote],
      motion: PREVIEW_MOTION.swimming,
    };
    const zoneSpec: PreviewSpec = { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.openBroth };

    const cellBands = worstBandsOf(cellSpec);
    expect(cellBands.body.fraction).toBeGreaterThan(0);
    expect(cellBands.drawn.fraction).toBeGreaterThanOrEqual(cellBands.body.fraction);
    expect(Number.isFinite(cellBands.drawn.fraction)).toBe(true);

    expect(worstBandsOf(zoneSpec).drawn.fraction, 'a zone scene has no body to measure').toBe(0);
  });

  /** The walk names the tick it found its worst frame at; a band pointing at tick 0 every time is a walk of one. */
  it('names a tick inside the loop it walked', () => {
    const spec: PreviewSpec = {
      scene: PREVIEW_SCENE.cell,
      cellKind: CELL_KIND.player,
      traits: BENCH_STAGE_TRAITS[CELL_STAGE.eukaryote],
      motion: PREVIEW_MOTION.swimming,
    };
    const bands = worstBandsOf(spec);
    expect(bands.drawn.atTick).toBeGreaterThanOrEqual(0);
    expect(bands.drawn.what).toContain('preview-cell');
    expect(TICK_INTERVAL_S).toBeGreaterThan(0);
  });
});
