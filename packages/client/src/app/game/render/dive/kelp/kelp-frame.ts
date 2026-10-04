// One frame of the kelp band, worked out before anything draws (docs/rendering/opening-dive.md §4, ticket #802): which
// of its parts draw at the camera, each by the test the mockup gave it (its size on screen, its zoom cut, a grid's
// cell cap), how far each band is faded in, and the few numbers that move: the foam's flicker, the close barnacles'
// fade, how far the camera is inside the drop. Pure, so a spec pins every switch.

import { KELP_BLADE_FLOOR, KELP_DROP } from '../../constants/dive-kelp-drop';
import {
  KELP_BLADE,
  KELP_BLADE_LOOK,
  KELP_BULB,
  KELP_CLOSE_BARNACLES,
  KELP_FOCAL_ROCK,
  KELP_RIBBON_REACH,
  KELP_STIPE_LOOK,
} from '../../constants/dive-kelp';
import { SHORE_BOULDER } from '../../constants/dive-shore-boulders';
import { SHORE_FOCAL_ROCK } from '../../constants/dive-shore-objects';
import { RGBA_CHANNELS } from '../../colour';
import { SHORE_OCTAVE } from '../../constants/dive-shore';
import { smoothstep } from '../../geometry';
import type { DiveStageFrame, DiveView } from '../dive-view';
import { areBeadsShown, cellsInView } from './kelp-beads';
import { KELP_OCTAVE_SLOT, KELP_OCTAVE_SLOTS } from './kelp-shader-common';

/** What the kelp band draws this frame. */
export interface KelpFrame extends DiveStageFrame {
  /** The boulder and the bull kelp's fade (`DIVE_KELP_WINDOW`). */
  readonly kelpAlpha: number;
  /** The beads' and the drop's fade (`DIVE_DROP_WINDOW`). */
  readonly dropAlpha: number;
  readonly isRockShown: boolean;
  readonly hasBlades: boolean;
  readonly isStipeShown: boolean;
  readonly isBulbShown: boolean;
  readonly isFloorShown: boolean;
  readonly hasBeads: boolean;
  readonly isDropShown: boolean;
  /** The close barnacles' strength, 0 while they do not draw. */
  readonly barnacleAlpha: number;
  /** The foam round the rock's waterline, flickering. */
  readonly foamAlpha: number;
  /** How far the camera has sunk into the drop, 0 → 1. */
  readonly dropInside: number;
  /** How far the ribbons' strips reach past their margins, and a shadow's, in metres. */
  readonly ribbonReachM: number;
  readonly shadowReachM: number;
  /** Blade 0's width in css px: the blades' level of detail. */
  readonly bladeWidthPx: number;
  /** The self-similar tiles' octaves this frame, a vector each (\`KELP_OCTAVE_SLOT\`). */
  readonly octaves: Float32Array;
}

/** A self-similar tile's two octaves at a scale (\`octaves\`): the coarse tile, the fine one, the fine one's weight. */
export function octavesOf(tileM: number, targetPx: number, pixelsPerMetre: number): readonly [number, number, number] {
  const ratio = SHORE_OCTAVE.ratio;
  const level = Math.log((pixelsPerMetre * tileM) / targetPx) / Math.log(ratio);
  const whole = Math.floor(level);
  const coarse = tileM / ratio ** whole;
  return [coarse, coarse / ratio, smoothstep(0, 1, level - whole)];
}

/** The blade's grain, the rock's and its crystals' octaves, packed for \`uOctaves\`. */
function kelpOctaves(pixelsPerMetre: number): Float32Array {
  const surface = KELP_BLADE_LOOK.surface;
  const radius = SHORE_FOCAL_ROCK.radiusM;
  const { rock, grain } = SHORE_BOULDER;
  const packed = new Float32Array(KELP_OCTAVE_SLOTS * RGBA_CHANNELS);
  packed.set(octavesOf(surface.tileM, surface.targetPx, pixelsPerMetre), KELP_OCTAVE_SLOT.blade * RGBA_CHANNELS);
  packed.set(octavesOf(radius * rock.tileRadii, rock.targetPx, pixelsPerMetre), KELP_OCTAVE_SLOT.rock * RGBA_CHANNELS);
  packed.set(
    octavesOf(radius * grain.tileRadii, grain.targetPx, pixelsPerMetre),
    KELP_OCTAVE_SLOT.grain * RGBA_CHANNELS,
  );
  return packed;
}

function isRockInView(view: DiveView): boolean {
  const { camera } = view;
  const radius = SHORE_FOCAL_ROCK.radiusM;
  const reach = radius * SHORE_BOULDER.visibleRadii;
  return (
    Math.abs(SHORE_FOCAL_ROCK.x) - reach < camera.halfWidthM &&
    Math.abs(SHORE_FOCAL_ROCK.y) - reach < camera.halfHeightM &&
    radius * camera.pixelsPerMetre >= SHORE_BOULDER.minRadiusPx
  );
}

function closeBarnacleAlpha(view: DiveView): number {
  const barnacles = KELP_CLOSE_BARNACLES;
  const zoom = view.camera.zoom;
  if (zoom >= barnacles.showBelowZoom || cellsInView(view.camera, barnacles.cellM) > barnacles.maxCells) return 0;
  return smoothstep(barnacles.showBelowZoom, barnacles.fullBelowZoom, zoom);
}

/** The kelp's own parts: the rock, the stipe, the blades and the bulb, while its band is active. */
function kelpParts(view: DiveView): Pick<KelpFrame, 'isRockShown' | 'hasBlades' | 'isStipeShown' | 'isBulbShown'> {
  const isActive = view.bands.kelp.isActive;
  const scale = view.camera.pixelsPerMetre;
  return {
    isRockShown: isActive && isRockInView(view),
    hasBlades: isActive && KELP_BLADE.widthM * scale >= KELP_BLADE_LOOK.minPx,
    isStipeShown:
      isActive &&
      view.camera.zoom > KELP_STIPE_LOOK.hideAtOrBelowZoom &&
      KELP_STIPE_LOOK.widthM * scale >= KELP_STIPE_LOOK.minPx,
    isBulbShown: isActive && KELP_BULB.radiusM * scale >= KELP_BULB.minPx,
  };
}

/** The drop band's parts: the blade under everything close in, the beads and the drop. */
function dropParts(view: DiveView): Pick<KelpFrame, 'isFloorShown' | 'hasBeads' | 'isDropShown'> {
  const isActive = view.bands.drop.isActive;
  const { camera } = view;
  return {
    isFloorShown: isActive && camera.zoom <= KELP_BLADE_FLOOR.showAtOrBelowZoom,
    hasBeads: isActive && areBeadsShown(camera),
    isDropShown:
      isActive &&
      KELP_DROP.radiusM * camera.pixelsPerMetre > KELP_DROP.minPx &&
      camera.zoom > KELP_DROP.hideAtOrBelowZoom,
  };
}

export function kelpFrameOf(view: DiveView): KelpFrame {
  const { camera } = view;
  const scale = camera.pixelsPerMetre;
  const foam = SHORE_BOULDER.waterline.foam;
  return {
    stageWidthPx: camera.viewport.width,
    stageHeightPx: camera.viewport.height,
    pixelsPerMetre: scale,
    zoom: camera.zoom,
    timeSeconds: view.timeSeconds,
    kelpAlpha: view.bands.kelp.weight,
    dropAlpha: view.bands.drop.weight,
    ...kelpParts(view),
    ...dropParts(view),
    barnacleAlpha: closeBarnacleAlpha(view),
    foamAlpha: foam.alpha + foam.flicker * Math.sin(view.timeSeconds * foam.rate + KELP_FOCAL_ROCK.seed),
    dropInside: smoothstep(KELP_DROP.insideFromZoom, KELP_DROP.insideToZoom, camera.zoom),
    ribbonReachM: KELP_RIBBON_REACH.strokeM + KELP_RIBBON_REACH.px / scale,
    shadowReachM: KELP_RIBBON_REACH.px / scale,
    bladeWidthPx: KELP_BLADE.widthM * scale,
    octaves: kelpOctaves(scale),
  };
}

/**
 * What draws before the band's bakes have landed (a scrub or a skip can get there first; a play waits): the parts
 * that need no bake (the blades, the bulb, the blade floor and the drop, without their grain), so the labels point
 * at the kelp; the rock, the stipe and the beads wait for their bakes.
 */
export function kelpStandInOf(frame: KelpFrame): KelpFrame {
  return { ...frame, isRockShown: false, isStipeShown: false, hasBeads: false };
}

/** Whether anything of the band draws this frame. */
export function isKelpFrameShown(frame: KelpFrame): boolean {
  return (
    frame.isRockShown ||
    frame.hasBlades ||
    frame.isStipeShown ||
    frame.isBulbShown ||
    frame.isFloorShown ||
    frame.hasBeads ||
    frame.isDropShown
  );
}
