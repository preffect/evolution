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
import { smoothstep } from '../../geometry';
import type { DiveView } from '../dive-view';
import { areBeadsShown, cellsInView } from './kelp-beads';

/** What the kelp band draws this frame. */
export interface KelpFrame {
  readonly stageWidthPx: number;
  readonly stageHeightPx: number;
  /** Css px per metre (the mockup's `s`). */
  readonly pixelsPerMetre: number;
  readonly zoom: number;
  readonly timeSeconds: number;
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
    isFloorShown: isActive && camera.zoom < KELP_BLADE_FLOOR.showBelowZoom,
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
  };
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
