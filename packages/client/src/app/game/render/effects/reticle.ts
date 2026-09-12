// The pointer reticle (docs/UI.md §3.3 spawn hint, docs/RENDERING.md §6): while onboarding asks
// for it, a small ring at the pointer's world position and a dotted line from the own cell's rim
// toward it, both glow-atlas sprites in the light accent so the effects batch draws them. Pure
// placements; the effects layer positions the sprites.

import {
  LIGHT_ACCENT,
  RETICLE_ALPHA,
  RETICLE_DOT_RADIUS_PX,
  RETICLE_DOT_SPACING_PX,
  RETICLE_LINE_MAX_DOTS,
  RETICLE_RADIUS_PX,
} from '../constants';
import { DIAMETER_PER_RADIUS } from '../geometry';
import { GLOW_SPRITE } from '../textures/glow-atlas';
import type { EffectSpritePlacement } from './effect-sprites';

export interface ReticleFrame {
  readonly isVisible: boolean;
  /** The pointer in world units. */
  readonly x: number;
  readonly y: number;
  /** Screen px per wu: the reticle keeps its px size at every zoom. */
  readonly zoom: number;
  /** The own cell the dotted line starts from; no line without one. */
  readonly ownCell: { readonly x: number; readonly y: number; readonly radius: number } | null;
}

const NO_ROTATION = 0;

function dot(x: number, y: number, sizeWu: number): EffectSpritePlacement {
  return {
    sprite: GLOW_SPRITE.glow,
    x,
    y,
    widthWu: sizeWu,
    heightWu: sizeWu,
    rotation: NO_ROTATION,
    colour: LIGHT_ACCENT,
    alpha: RETICLE_ALPHA,
  };
}

/** Dots every `RETICLE_DOT_SPACING_PX` from the cell's rim to the ring's edge, capped at `RETICLE_LINE_MAX_DOTS`. */
function linePlacements(frame: ReticleFrame, ownCell: NonNullable<ReticleFrame['ownCell']>): EffectSpritePlacement[] {
  const deltaX = frame.x - ownCell.x;
  const deltaY = frame.y - ownCell.y;
  const distance = Math.hypot(deltaX, deltaY);
  const startWu = ownCell.radius;
  const endWu = distance - RETICLE_RADIUS_PX / frame.zoom;
  if (endWu <= startWu) return [];
  const spacingWu = RETICLE_DOT_SPACING_PX / frame.zoom;
  const sizeWu = (RETICLE_DOT_RADIUS_PX * DIAMETER_PER_RADIUS) / frame.zoom;
  const count = Math.min(RETICLE_LINE_MAX_DOTS, Math.floor((endWu - startWu) / spacingWu));
  const placements: EffectSpritePlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = (startWu + index * spacingWu) / distance;
    placements.push(dot(ownCell.x + deltaX * along, ownCell.y + deltaY * along, sizeWu));
  }
  return placements;
}

/** The ring at the pointer and the dotted line to it; nothing while the reticle is hidden. */
export function reticlePlacements(frame: ReticleFrame): EffectSpritePlacement[] {
  if (!frame.isVisible) return [];
  const ringSizeWu = (RETICLE_RADIUS_PX * DIAMETER_PER_RADIUS) / frame.zoom;
  const ring: EffectSpritePlacement = { ...dot(frame.x, frame.y, ringSizeWu), sprite: GLOW_SPRITE.ring };
  return [ring, ...(frame.ownCell === null ? [] : linePlacements(frame, frame.ownCell))];
}
