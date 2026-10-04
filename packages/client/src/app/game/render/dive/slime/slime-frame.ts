// One frame of the slime band, worked out before anything draws (docs/rendering/opening-dive.md §4, ticket #803):
// which of its parts draw at the camera, each by the test the mockup gave it (its size on screen, a grid's cell cap,
// the dark field), how far the slime and the dish's dark field are faded in, and the few numbers that move: the caustic
// sheets' drift, the pocket's and the skin's widths. Pure, so a spec pins every switch.

import { RGBA_CHANNELS } from '../../colour';
import { KELP_DROP } from '../../constants/dive-kelp-drop';
import {
  SLIME_CLOUDS,
  SLIME_DROP_SKIN,
  SLIME_EDGE_ABOVE_ZOOM,
  SLIME_FLOOR,
  SLIME_FLOOR_DIATOMS,
  SLIME_PICTURE_REACH_PX,
  SLIME_POCKET,
  SLIME_POCKET_RADIUS_M,
} from '../../constants/dive-slime';
import { SLIME_MOTES, SLIME_RODS } from '../../constants/dive-slime-bacteria';
import { HALF, smoothstep } from '../../geometry';
import type { DiveCamera } from '../dive-camera';
import type { DiveView } from '../dive-view';
import { cellsInView } from '../kelp/kelp-beads';

/** The pocket's widths in its radii, its alpha, and how far its quad reaches (metres). */
export interface SlimePocketFrame {
  readonly ringRadii: number;
  readonly rimRadii: number;
  readonly accentRadii: number;
  readonly alpha: number;
  readonly reachM: number;
}

/** The skin's widths and inset (metres), and how far its quad reaches round the drop's centre. */
export interface SlimeSkinFrame {
  readonly lineM: number;
  readonly bandM: number;
  readonly insetM: number;
  readonly reachM: number;
}

/** What the slime band draws this frame. */
export interface SlimeFrame {
  readonly stageWidthPx: number;
  readonly stageHeightPx: number;
  /** Css px per metre (the mockup's `s`). */
  readonly pixelsPerMetre: number;
  readonly zoom: number;
  readonly timeSeconds: number;
  /** The slime's fade (`DIVE_SLIME_WINDOW`, the mockup's `inA`). */
  readonly slimeAlpha: number;
  /** The dish's dark field arriving (its band's weight, the mockup's `df`). */
  readonly darkField: number;
  readonly isShown: boolean;
  /** The drop still shows under the slime (on the same stage), so the floor leaves it clear outside the drop. */
  readonly isOverTheDrop: boolean;
  /** The drop's edge is in view: the slime is clipped to it, and the blade outside darkens. */
  readonly isEdgeShown: boolean;
  readonly cellAlpha: number;
  readonly causticAlpha: number;
  /** Each caustic sheet's drift (metres), tile (metres) and alpha, packed for `uCaustics`. */
  readonly caustics: Float32Array;
  readonly hasClouds: boolean;
  readonly hasDiatoms: boolean;
  readonly isPocketShown: boolean;
  readonly isOutsideShown: boolean;
  readonly hasRods: boolean;
  readonly hasMotes: boolean;
  readonly isSkinShown: boolean;
  readonly pocket: SlimePocketFrame;
  readonly skin: SlimeSkinFrame;
}

/** A scatter's draw test: big enough on screen, and its grid under its cell cap. */
function isScatterShown(camera: DiveCamera, look: { cellM: number; maxCells: number }, isBigEnough: boolean): boolean {
  return isBigEnough && cellsInView(camera, look.cellM) <= look.maxCells;
}

function causticSheets(timeSeconds: number): Float32Array {
  const { sheets, driftShare } = SLIME_FLOOR.caustic;
  const packed = new Float32Array(sheets.length * RGBA_CHANNELS);
  sheets.forEach((sheet, index) => {
    const drift = timeSeconds * sheet.tileM * driftShare;
    packed.set([drift * sheet.driftX, drift * sheet.driftY, sheet.tileM, sheet.alpha], index * RGBA_CHANNELS);
  });
  return packed;
}

/** The pocket's widths (`drawDish`'s `w`, the rim's and the accent's line widths) at this scale. */
function pocketFrame(pixelsPerMetre: number, alpha: number): SlimePocketFrame {
  const { ring, rim, accent } = SLIME_POCKET;
  const radiiOfPx = (cssPx: number): number => cssPx / pixelsPerMetre / SLIME_POCKET_RADIUS_M;
  const ringRadii = Math.max(ring.width, radiiOfPx(ring.widthPx));
  const accentRadii = Math.max(accent.width, radiiOfPx(accent.widthPx));
  return {
    ringRadii,
    rimRadii: Math.max(radiiOfPx(rim.widthPx), rim.width),
    accentRadii,
    alpha,
    reachM: SLIME_POCKET_RADIUS_M * (1 + Math.max(ringRadii, accentRadii)) + SLIME_PICTURE_REACH_PX / pixelsPerMetre,
  };
}

/** The skin's widths (its two strokes' line widths and the band's inset) at this scale. */
function skinFrame(pixelsPerMetre: number): SlimeSkinFrame {
  const { line, band } = SLIME_DROP_SKIN;
  const metresOfPx = (cssPx: number): number => cssPx / pixelsPerMetre;
  const radius = KELP_DROP.radiusM;
  const lineM = Math.max(metresOfPx(line.widthPx), radius * line.widthRadii);
  const bandM = Math.max(metresOfPx(band.widthPx), radius * band.widthRadii);
  return {
    lineM,
    bandM,
    insetM: Math.max(metresOfPx(band.insetPx), radius * band.insetRadii),
    reachM: radius + Math.max(lineM, bandM) * HALF + metresOfPx(SLIME_PICTURE_REACH_PX),
  };
}

function partsOf(
  view: DiveView,
  darkField: number,
): Pick<SlimeFrame, 'hasClouds' | 'hasDiatoms' | 'isPocketShown' | 'isOutsideShown' | 'hasRods' | 'hasMotes'> {
  const { camera } = view;
  const scale = camera.pixelsPerMetre;
  const pocketPx = SLIME_POCKET_RADIUS_M * scale;
  const hasBacteria = scale * SLIME_RODS.micronM >= SLIME_RODS.minPxPerMicron;
  return {
    hasClouds: isScatterShown(camera, SLIME_CLOUDS, scale * SLIME_CLOUDS.minSizeM >= SLIME_CLOUDS.minPx),
    hasDiatoms: isScatterShown(
      camera,
      SLIME_FLOOR_DIATOMS,
      scale * SLIME_FLOOR_DIATOMS.minSizeM >= SLIME_FLOOR_DIATOMS.minPx,
    ),
    isPocketShown: darkField < 1 && pocketPx >= SLIME_POCKET.minPx,
    isOutsideShown: darkField > 0 && pocketPx > SLIME_POCKET.minPx,
    hasRods: isScatterShown(camera, SLIME_RODS, hasBacteria),
    hasMotes: isScatterShown(camera, SLIME_MOTES, hasBacteria),
  };
}

/** The band's meshes, by name, in the mockup's order (the plankton is a container of its own). */
export const SLIME_MESH_NAMES = [
  'floor',
  'clouds',
  'diatoms',
  'pocket',
  'plankton',
  'outside',
  'rods',
  'motes',
  'skin',
] as const;
export type SlimeMeshName = (typeof SLIME_MESH_NAMES)[number];

/** Which of the band's meshes show: each part by its frame's test, the atlases' only once they are bound. */
export type SlimeShown = Readonly<Record<SlimeMeshName, boolean>>;

export const SLIME_NOTHING_SHOWN = Object.fromEntries(SLIME_MESH_NAMES.map((name) => [name, false])) as SlimeShown;

/** What shows of `frame`; the rods and the specks only with their atlas. */
export function slimeShownOf(frame: SlimeFrame, hasAtlases: boolean): SlimeShown {
  if (!frame.isShown) return SLIME_NOTHING_SHOWN;
  return {
    floor: true,
    clouds: frame.hasClouds,
    diatoms: frame.hasDiatoms,
    pocket: frame.isPocketShown,
    plankton: true,
    outside: frame.isOutsideShown,
    rods: hasAtlases && frame.hasRods,
    motes: hasAtlases && frame.hasMotes,
    skin: frame.isSkinShown,
  };
}

export function slimeFrameOf(view: DiveView): SlimeFrame {
  const { camera } = view;
  const zoom = camera.zoom;
  const slimeAlpha = view.bands.slime.weight;
  const darkField = view.bands.dish.weight;
  const isShown = view.bands.slime.isActive;
  const isEdgeShown = zoom > SLIME_EDGE_ABOVE_ZOOM;
  const { cells, caustic } = SLIME_FLOOR;
  return {
    stageWidthPx: camera.viewport.width,
    stageHeightPx: camera.viewport.height,
    pixelsPerMetre: camera.pixelsPerMetre,
    zoom,
    timeSeconds: view.timeSeconds,
    slimeAlpha,
    darkField,
    isShown,
    isOverTheDrop: view.bands.drop.isActive,
    isEdgeShown,
    cellAlpha:
      smoothstep(cells.fadeIn[0], cells.fadeIn[1], zoom) * smoothstep(cells.fadeOut[0], cells.fadeOut[1], zoom),
    causticAlpha: slimeAlpha * (1 - darkField) * smoothstep(caustic.fadeIn[0], caustic.fadeIn[1], zoom),
    caustics: causticSheets(view.timeSeconds),
    ...partsOf(view, darkField),
    isSkinShown: isEdgeShown && slimeAlpha > 0,
    pocket: pocketFrame(camera.pixelsPerMetre, slimeAlpha * (1 - darkField)),
    skin: skinFrame(camera.pixelsPerMetre),
  };
}
