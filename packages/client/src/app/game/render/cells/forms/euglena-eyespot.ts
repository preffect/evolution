// The euglena's eyespot (#194; docs/rendering/cells.md §2.4, visual-style/cells-and-organelles.md §4, sheet 04): the red
// dot toward the nose, a little off the axis, that makes the spindle read as a euglena down to the mid LOD. It rides
// the heading with the form (organelle slots do not, visual-style/principles-and-palette.md §2), grows with the pulse
// and moves out with the speed stretch at its own angle, so it keeps its place inside the body. Its halo brightens
// with the tier. This file is the TypeScript reference; `cell-shader-euglena.ts` paints the same dot term for term.

import {
  EYESPOT_ACROSS_RADII,
  EYESPOT_ALONG_RADII,
  EYESPOT_GLOW_PER_TIER,
  EYESPOT_HALO_ALPHA,
  EYESPOT_HALO_RADII,
  EYESPOT_RADIUS_RADII,
} from '../../constants';
import { stretchAt, type RadialProfileTerms } from '../radial-profile';
import type { HeadingPoint } from './euglena-flagellum';

/** The eyespot's angle off the heading. */
export const EYESPOT_DELTA = Math.atan2(EYESPOT_ACROSS_RADII, EYESPOT_ALONG_RADII);

/** The dot this frame: its centre in the heading frame and its radius and halo, all in radii. */
export interface EyespotPlacement {
  readonly centre: HeadingPoint;
  readonly radiusRadii: number;
  readonly haloRadii: number;
}

/** Where the eyespot sits this frame, under the pulse and the stretch at its own angle. */
export function eyespotPlacement(terms: Pick<RadialProfileTerms, 'pulse' | 'stretch'>): EyespotPlacement {
  const scale = terms.pulse * stretchAt(terms.stretch, EYESPOT_DELTA).value;
  return {
    centre: { along: EYESPOT_ALONG_RADII * scale, across: EYESPOT_ACROSS_RADII * scale },
    radiusRadii: EYESPOT_RADIUS_RADII * terms.pulse,
    haloRadii: EYESPOT_HALO_RADII * terms.pulse,
  };
}

/** The halo's alpha at `tier`: +0 / 25 / 50 % over tier I. */
export function eyespotHaloAlpha(tier: number): number {
  return EYESPOT_HALO_ALPHA * (1 + EYESPOT_GLOW_PER_TIER * (tier - 1));
}
