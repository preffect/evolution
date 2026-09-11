// What the clips say about a cell this frame (docs/RENDERING.md §4): the eat and engulf tracks
// that reach the profile, the pulses of level-up and respawn, the sprint stretch and rim, the
// alpha of a respawning cell, the film over an engulfed prey and the halo blooms. The player
// holds the millisecond clips; the engulf clip is read straight from `engulfProgress`, and the
// predator's seal after payout from the ghost's `absorbed` clip.

import { MOTION_CLIP, MOTION_CLIPS, type CellView, type EntityId } from '@evolution/shared';
import { PREY_UNDER_FILM_ALPHA, SPRINT_RIM_BRIGHTNESS, SPRINT_STRETCH_SCALE } from '../constants';
import { sampleClip, type MotionClipPlayer } from '../effects/motion-clip-player';
import type { ShapeClipValues } from './shape-terms';

/** Where the mote and the prey are, cell frame, set when the clip starts and held through it. */
export interface ClipAngles {
  moteAngle: number | null;
  preyAngle: number | null;
}

export interface ClipFrameContext {
  readonly nowMs: number;
  readonly absorbedSealByPredator: ReadonlyMap<EntityId, number>;
}

export interface ClipFrameValues {
  readonly shape: ShapeClipValues;
  readonly alpha: number;
  readonly rimBrightness: number;
  readonly passBAlpha: number;
  /** The halo's outer radius scale from the eat / respawn blooms, 1 at rest. */
  readonly haloRadiiScale: number;
  /** The quad must reach the bloomed halo. */
  readonly quadExtentRadii: number;
  /** An absorbed ghost's rim dash, 0 for a living cell. */
  readonly rimDash: number;
}

const EAT_TRACKS = ['dimple', 'wrap', 'pulse', 'stretchAlong', 'stretchAcross'] as const;

function eatValues(tracks: Readonly<Record<string, number>>): ShapeClipValues['eat'] {
  if (tracks['dimple'] === undefined) return null;
  const values = {} as Record<(typeof EAT_TRACKS)[number], number>;
  for (const track of EAT_TRACKS) values[track] = tracks[track] ?? (track === 'dimple' || track === 'wrap' ? 0 : 1);
  return values;
}

/** The predator's engulf tracks come from its prey's progress, which the layer hands over as `preyProgress`. */
export function engulfTracksFor(preyProgress: number | null): ShapeClipValues['engulf'] {
  if (preyProgress === null) return null;
  const values = sampleClip(MOTION_CLIPS.engulf, preyProgress);
  return { arm: values['arm'] ?? 0, notch: values['notch'] ?? 0, seal: values['seal'] ?? 0 };
}

function sprintValues(view: CellView, tracks: Readonly<Record<string, number>>): { stretch: number; rim: number } {
  const isSprinting = view.sprintRemainingTicks > 0;
  return {
    stretch: tracks['stretchSprint'] ?? (isSprinting ? SPRINT_STRETCH_SCALE : 1),
    rim: tracks['rimBrightness'] ?? (isSprinting ? SPRINT_RIM_BRIGHTNESS : 1),
  };
}

/** The level-up / respawn pulse; an eat clip's `pulse` reaches the profile through the eat values instead. */
function bodyPulse(tracks: Readonly<Record<string, number>>): number {
  if (tracks['pulse'] === undefined || tracks['dimple'] !== undefined) return 1;
  return tracks['pulse'];
}

/** Every clip-derived value for `view` this frame; `preyProgress` is the engulfed prey's progress when the cell is a predator. */
export function clipShapeValues(
  player: MotionClipPlayer,
  view: CellView,
  context: ClipFrameContext,
  preyProgress: number | null = null,
): ClipFrameValues {
  const tracks = player.sample(context.nowMs);
  const sprint = sprintValues(view, tracks);
  const haloRadiiScale = tracks['haloRadii'] ?? 1;
  return {
    shape: {
      eat: eatValues(tracks),
      engulf: engulfTracksFor(preyProgress),
      absorbedSeal: context.absorbedSealByPredator.get(view.id) ?? null,
      pulse: bodyPulse(tracks),
      sprintStretch: sprint.stretch,
    },
    alpha: player.isPlaying(MOTION_CLIP.respawn, context.nowMs) ? (tracks['alpha'] ?? 1) : 1,
    rimBrightness: sprint.rim,
    passBAlpha: view.engulfedByCellId === null ? 1 : PREY_UNDER_FILM_ALPHA,
    haloRadiiScale,
    quadExtentRadii: haloRadiiScale,
    rimDash: tracks['rimDash'] ?? 0,
  };
}
