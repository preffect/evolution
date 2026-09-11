// A ghost's instance row (docs/RENDERING.md §2.3): the prey's last view, drawn with the
// `absorbed` clip's dissolve (cytoplasm alpha) and rim dash, no clips of its own, no tells.

import { SEAT_MARK_BEADS } from '@evolution/shared';
import {
  CELL_QUAD_EXTENT_RADII,
  CILIA_BEAT_IDLE_HZ,
  HALO_KIND,
  JITTER_AMPLITUDE,
  PREY_UNDER_FILM_ALPHA,
} from '../constants';
import { cellLodFor } from './cell-lod';
import type { CellInstance } from './cell-instance';
import { summariseCellTraits } from './cell-traits';
import type { Ghost } from './ghost-cells';

/** The membrane's rest terms for a ghost: no motion, no clips, the traits' wobble only. */
function ghostSurface(
  ghost: Ghost,
): Pick<
  CellInstance,
  | 'heading'
  | 'speedRatio'
  | 'breathing'
  | 'wobbleAmplitude'
  | 'wobbleMode'
  | 'wobblePhase'
  | 'axialAlong'
  | 'axialAcross'
  | 'pulse'
  | 'bumps'
> {
  const traits = summariseCellTraits(ghost.view);
  return {
    heading: 0,
    speedRatio: 0,
    breathing: 0,
    wobbleAmplitude: traits.wobble.amplitude,
    wobbleMode: traits.wobble.mode,
    wobblePhase: 0,
    axialAlong: 1,
    axialAcross: 1,
    pulse: 1,
    bumps: [],
  };
}

export function ghostInstance(ghost: Ghost, zoom: number): CellInstance {
  const { view } = ghost;
  const traits = summariseCellTraits(view);
  const lod = cellLodFor(view.radius * zoom);
  return {
    ...ghostSurface(ghost),
    x: view.x,
    y: view.y,
    radius: view.radius,
    quadExtentRadii: CELL_QUAD_EXTENT_RADII,
    paletteIndex: view.avatarIndex,
    lodBlend: lod.interiorBlend,
    ciliaCount: traits.ciliaCount,
    wallScale: traits.wallScale,
    speckleDensity: 0,
    filamentCount: 0,
    tintMix: traits.tintMix,
    nucleusOffsetX: 0,
    nucleusOffsetY: 0,
    haloKind: traits.isProtocell ? HALO_KIND.protocell : HALO_KIND.default,
    beadCount: lod.hasTells ? (SEAT_MARK_BEADS[view.avatarIndex] ?? 1) : 0,
    isOwn: false,
    warningRingPx: 0,
    selfRingFill: 1,
    alpha: ghost.tracks['cytoplasmAlpha'] ?? 1,
    stripRow: 0,
    stripPhase: 0,
    rimBrightness: 1,
    passBAlpha: PREY_UNDER_FILM_ALPHA,
    isFarDot: lod.isFarDot,
    isProtocell: traits.isProtocell,
    ciliaBeatHz: CILIA_BEAT_IDLE_HZ,
    haloRadiiScale: 1,
    lobesScale: 0,
    jitterAmplitude: JITTER_AMPLITUDE,
    rimDash: ghost.tracks['rimDash'] ?? 0,
  };
}
