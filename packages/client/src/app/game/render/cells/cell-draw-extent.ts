// How far from its centre a cell is drawn (docs/rendering/cells.md §2, docs/architecture/encyclopedia.md §12.7):
// the membrane at its widest, and the widest anything reaches — the halo, the cilia hairs, or a flagellum's tip.
//
// Two readers, and they are deliberately not the same reader. The encyclopedia preview **frames its lens** by the
// bound (`peakReachRadii`, a constant of the cell), so a scene's zoom is fixed for its whole loop; the framing
// spec **measures** the membrane the renderer actually drew that tick and asks this file only for the appendages
// hanging off it. Sharing `appendageReachRadii` between the two is what keeps the framing honest: the spec's
// measurement stays independent of the bound the framing was picked from, and neither owns a private copy of how
// long a tail is.

import type { TraitTier } from '@evolution/shared';
import {
  CILIA_OUTER_RADII,
  FLAGELLUM_AMPLITUDE_BY_TIER,
  FLAGELLUM_AMPLITUDE_RADII,
  FLAGELLUM_LENGTH_RADII,
  FLAGELLUM_SPRINT_AMPLITUDE_SCALE,
} from '../constants';
import type { CellTraitSummary } from './cell-traits';
import { FLAGELLUM_TRAIT } from './flagellum-lines';
import { REST_CLIP_PEAK, haloOuterRadiiOf, peakReachRadii, type ClipDeformationPeak } from './shape-terms';

/** The hairs reach `CILIA_OUTER_RADII − 1` **past the membrane** (`cell-shader-tells.ts`'s `CILIA_REACH`). */
const CILIA_REACH_RADII = CILIA_OUTER_RADII - 1;

/** A cell with no cilia and no tail: its appendages reach no further than its membrane. */
const NO_APPENDAGE_REACH = 0;
const FULL_AMPLITUDE = 1;

/**
 * The widest an appendage reaches **past the cell's centre**, in radii, given the membrane radius at its widest.
 *
 * The tail is the long one: rooted on the membrane at the rear, `FLAGELLUM_LENGTH_RADII` further out, with the
 * wave's peak added sideways (`flagellum-lines.ts`). Adding the wave to the length instead of taking the
 * hypotenuse of the two overstates the tip slightly, which is the safe direction for a framing bound.
 *
 * `pulse` scales the tail and not the cilia, because that is what the renderer does: `flagellumSpec.radius` is
 * `r × pulse`, so an eat's pulse lengthens the tail by the same fraction, while the shader measures the cilia's
 * reach in unpulsed radii past the membrane (`frame.dr` is `d / inst.r`).
 */
export function appendageReachRadii(
  traits: CellTraitSummary,
  membraneRadii: number,
  isSprinting: boolean,
  pulse: number,
): number {
  const ciliaReach = traits.ciliaCount > 0 ? membraneRadii + CILIA_REACH_RADII : NO_APPENDAGE_REACH;
  const flagellumTier = traits.tierOf(FLAGELLUM_TRAIT);
  if (flagellumTier === 0) return ciliaReach;
  const tailRadii = (FLAGELLUM_LENGTH_RADII + waveAmplitudeRadii(flagellumTier, isSprinting)) * pulse;
  return Math.max(ciliaReach, membraneRadii + tailRadii);
}

/** The tail wave's peak in radii at this tier, doubled while sprinting (`flagellum-lines.ts`'s `amplitudeWu`). */
function waveAmplitudeRadii(tier: TraitTier, isSprinting: boolean): number {
  const tierScale = FLAGELLUM_AMPLITUDE_BY_TIER[tier - 1] ?? FULL_AMPLITUDE;
  const sprintScale = isSprinting ? FLAGELLUM_SPRINT_AMPLITUDE_SCALE : FULL_AMPLITUDE;
  return FLAGELLUM_AMPLITUDE_RADII * tierScale * sprintScale;
}

/** The two framing bands of §12.7, in radii: the body inside the safe circle, everything drawn inside the rim. */
export interface CellDrawExtentRadii {
  /** The membrane at its widest, the halo taken back out: what the **safe** band is measured against. */
  readonly bodyRadii: number;
  /** The widest anything is drawn — halo, cilia or tail: what the **rim** band is measured against. */
  readonly drawnRadii: number;
}

/** What a cell is doing, as far as its extent is concerned. */
export interface CellDrawState {
  /** 0 at rest, 1 at its own top speed: the speed stretch. */
  readonly speedRatio: number;
  /** The sprint's axial stretch and its doubled tail wave. */
  readonly isSprinting: boolean;
  /** The widest its running clips deform it (`cell-clips.ts`); `REST_CLIP_PEAK` for a cell playing none. */
  readonly clip: ClipDeformationPeak;
  /**
   * How far the clips' **effect sprites** reach from the cell's centre, in radii
   * (`effects/effect-reach.ts`); 0 when nothing is emitted. A level-up's outermost ripple is the
   * widest thing the preview draws, and it is not part of the cell at all — so it belongs in `drawnRadii` and
   * never in `bodyRadii`.
   */
  readonly effectRadii: number;
}

/** A cell swimming or resting with nothing playing on it: every scene ticket #363 built. */
export function restingDrawState(speedRatio: number): CellDrawState {
  return { speedRatio, isSprinting: false, clip: REST_CLIP_PEAK, effectRadii: NO_EFFECT_REACH };
}

const NO_EFFECT_REACH = 0;

/**
 * The bound: how far a cell of these traits can be drawn in this state, over **any** frame. Time-independent and
 * cosmetic-fork-independent, so a lens framed by it holds still.
 */
export function cellDrawExtentRadii(traits: CellTraitSummary, state: CellDrawState): CellDrawExtentRadii {
  const drawnWithHalo = peakReachRadii(traits, state.speedRatio, state.isSprinting, state.clip);
  const bodyRadii = drawnWithHalo / haloOuterRadiiOf(traits);
  return {
    bodyRadii,
    drawnRadii: Math.max(
      drawnWithHalo,
      appendageReachRadii(traits, bodyRadii, state.isSprinting, state.clip.pulse),
      state.effectRadii,
    ),
  };
}
