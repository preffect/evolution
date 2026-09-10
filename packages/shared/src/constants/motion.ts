// Sheet 03's motion strips as data (docs/RENDERING.md §4, docs/VISUAL-STYLE.md §5). Cosmetic: the
// renderer tweens these, the HUD opens the picker at the end of `level_up`, the sound bus cues on
// keyframes. Never imported by the server and excluded from `balance.json` (motion.test.ts pins
// both). Easing names are the only spelling; the curves live in the client's `render/easing.ts`.

import type { ValueOf } from '../types/common.js';

/** The Penner easings by name (docs/VISUAL-STYLE.md preamble); the curves are the client's `render/easing.ts`. */
export const EASING = {
  linear: 'linear',
  easeOutQuad: 'ease_out_quad',
  easeOutBack: 'ease_out_back',
  easeInOutSine: 'ease_in_out_sine',
  easeOutCubic: 'ease_out_cubic',
  easeInOutQuad: 'ease_in_out_quad',
  easeInQuad: 'ease_in_quad',
  easeOutExpo: 'ease_out_expo',
} as const;
export type EasingName = ValueOf<typeof EASING>;

export const EASING_NAMES: readonly EasingName[] = Object.values(EASING);

export interface MotionKeyframe {
  /** Milliseconds (domain `ms`) or engulf progress (domain `progress`). */
  readonly at: number;
  readonly value: number;
  /** The easing of the tween that leaves this keyframe; unused on the last one. */
  readonly easingTo: EasingName;
}

export const MOTION_CLIP = {
  eat: 'eat',
  engulf: 'engulf',
  absorbed: 'absorbed',
  levelUp: 'level_up',
  respawn: 'respawn',
  sprintRelease: 'sprint_release',
  organelleBirth: 'organelle_birth',
} as const;
export type MotionClipId = (typeof MOTION_CLIP)[keyof typeof MOTION_CLIP];

export const MOTION_DOMAIN = { milliseconds: 'ms', progress: 'progress' } as const;
export type MotionDomain = (typeof MOTION_DOMAIN)[keyof typeof MOTION_DOMAIN];

export interface MotionClip {
  readonly id: MotionClipId;
  /** `engulf` is driven by `engulfProgress`, never the clock. */
  readonly domain: MotionDomain;
  readonly duration: number;
  readonly isInterruptible: boolean;
  /** Keys are §2.1 profile terms and sprite scalars. */
  readonly tracks: Readonly<Record<string, readonly MotionKeyframe[]>>;
}

/** Sheet 03 motion rules: scale pulses never exceed this, and return through an overshoot of at most this share. */
export const MOTION_PULSE_MAX = 1.14;
export const MOTION_OVERSHOOT_MAX = 0.03;

/** The eat strip's keyframe times (ms): approach, wrap, pulse, absorb, settle. "Contact 50" is a label inside the first tween. */
const EAT_AT = [0, 100, 160, 220, 300] as const;
const EAT_EASE: readonly EasingName[] = [
  EASING.easeOutQuad,
  EASING.easeOutBack,
  EASING.linear,
  EASING.easeInOutSine,
  EASING.linear,
];
const ENGULF_AT = [0, 0.5, 1.0] as const;
const ENGULF_EASE: readonly EasingName[] = [EASING.easeOutCubic, EASING.easeInOutQuad, EASING.linear];
const ABSORBED_AT = [0, 200, 400, 600] as const;
const ABSORBED_EASE: readonly EasingName[] = [EASING.linear, EASING.easeInQuad, EASING.easeOutBack, EASING.linear];
const LEVEL_UP_AT = [0, 120, 250, 450, 700, 900] as const;
const LEVEL_UP_EASE: readonly EasingName[] = [
  EASING.easeInQuad,
  EASING.easeOutExpo,
  EASING.easeOutCubic,
  EASING.easeInOutSine,
  EASING.linear,
  EASING.linear,
];

function track(times: readonly number[], eases: readonly EasingName[], values: readonly number[]): MotionKeyframe[] {
  return times.map((time, index) => ({ at: time, value: values[index] ?? 0, easingTo: eases[index] ?? EASING.linear }));
}

/** A two-keyframe track from `fromValue` to `toValue` over `duration` with one easing. */
function tween(duration: number, easing: EasingName, fromValue: number, toValue: number): MotionKeyframe[] {
  return [
    { at: 0, value: fromValue, easingTo: easing },
    { at: duration, value: toValue, easingTo: EASING.linear },
  ];
}

const EAT_DURATION_MS = 300;
const ENGULF_DURATION_PROGRESS = 1.0;
const ABSORBED_DURATION_MS = 600;
const LEVEL_UP_DURATION_MS = 900;
const RESPAWN_DURATION_MS = 400;
const SPRINT_RELEASE_DURATION_MS = 200;
const ORGANELLE_BIRTH_DURATION_MS = 3000;

export const MOTION_CLIPS: Readonly<Record<MotionClipId, MotionClip>> = {
  [MOTION_CLIP.eat]: {
    id: MOTION_CLIP.eat,
    domain: MOTION_DOMAIN.milliseconds,
    duration: EAT_DURATION_MS,
    isInterruptible: true,
    tracks: {
      dimple: track(EAT_AT, EAT_EASE, [0, -0.12, -0.12, 0, 0]),
      wrap: track(EAT_AT, EAT_EASE, [0, 0.14, 0.14, 0, 0]),
      pulse: track(EAT_AT, EAT_EASE, [1, 1, 1.09, 1, 1]),
      stretchAlong: track(EAT_AT, EAT_EASE, [1, 1.07, 1.07, 1, 1]),
      stretchAcross: track(EAT_AT, EAT_EASE, [1, 0.95, 0.95, 1, 1]),
      haloRadii: track(EAT_AT, EAT_EASE, [1, 1, 1.5, 1.5, 1.5]),
    },
  },
  [MOTION_CLIP.engulf]: {
    id: MOTION_CLIP.engulf,
    domain: MOTION_DOMAIN.progress,
    duration: ENGULF_DURATION_PROGRESS,
    isInterruptible: true,
    tracks: {
      arm: track(ENGULF_AT, ENGULF_EASE, [0, 0.62, 0]),
      notch: track(ENGULF_AT, ENGULF_EASE, [0, -0.1, 0]),
      seal: track(ENGULF_AT, ENGULF_EASE, [0, 0, 0.6]),
    },
  },
  [MOTION_CLIP.absorbed]: {
    id: MOTION_CLIP.absorbed,
    domain: MOTION_DOMAIN.milliseconds,
    duration: ABSORBED_DURATION_MS,
    isInterruptible: false,
    tracks: {
      rimDash: track(ABSORBED_AT, ABSORBED_EASE, [0, 1, 1, 1]),
      cytoplasmAlpha: track(ABSORBED_AT, ABSORBED_EASE, [1, 0.5, 0.5, 0]),
      streamProgress: track(ABSORBED_AT, ABSORBED_EASE, [0, 0, 0, 1]),
      seal: track(ABSORBED_AT, ABSORBED_EASE, [0.6, 0.42, 0.22, 0]),
    },
  },
  [MOTION_CLIP.levelUp]: {
    id: MOTION_CLIP.levelUp,
    domain: MOTION_DOMAIN.milliseconds,
    duration: LEVEL_UP_DURATION_MS,
    isInterruptible: false,
    tracks: {
      pulse: track(LEVEL_UP_AT, LEVEL_UP_EASE, [1, 0.9, 1.14, 1, 1, 1]),
      rayRadii: track(LEVEL_UP_AT, LEVEL_UP_EASE, [1.2, 1.2, 1.2, 1.95, 1.95, 1.95]),
      shockRingRadii: track(LEVEL_UP_AT, LEVEL_UP_EASE, [1, 1, 1, 1.6, 1.6, 1.6]),
      rippleRadii: track(LEVEL_UP_AT, LEVEL_UP_EASE, [1.7, 1.7, 1.7, 1.7, 2.1, 2.5]),
      nucleusFlash: track(LEVEL_UP_AT, LEVEL_UP_EASE, [0, 0, 1, 1, 0, 0]),
    },
  },
  [MOTION_CLIP.respawn]: {
    id: MOTION_CLIP.respawn,
    domain: MOTION_DOMAIN.milliseconds,
    duration: RESPAWN_DURATION_MS,
    isInterruptible: false,
    tracks: {
      pulse: tween(RESPAWN_DURATION_MS, EASING.easeOutBack, 0.6, 1),
      alpha: tween(RESPAWN_DURATION_MS, EASING.easeOutQuad, 0, 1),
      haloRadii: tween(RESPAWN_DURATION_MS, EASING.easeOutQuad, 2, 0),
    },
  },
  [MOTION_CLIP.sprintRelease]: {
    id: MOTION_CLIP.sprintRelease,
    domain: MOTION_DOMAIN.milliseconds,
    duration: SPRINT_RELEASE_DURATION_MS,
    isInterruptible: true,
    tracks: {
      stretchSprint: tween(SPRINT_RELEASE_DURATION_MS, EASING.easeOutQuad, 1.06, 1),
      rimBrightness: tween(SPRINT_RELEASE_DURATION_MS, EASING.easeOutQuad, 1.2, 1),
    },
  },
  [MOTION_CLIP.organelleBirth]: {
    id: MOTION_CLIP.organelleBirth,
    domain: MOTION_DOMAIN.milliseconds,
    duration: ORGANELLE_BIRTH_DURATION_MS,
    isInterruptible: false,
    tracks: {
      ghostSize: tween(ORGANELLE_BIRTH_DURATION_MS, EASING.easeInOutSine, 0.44, 0.3),
      rampMix: tween(ORGANELLE_BIRTH_DURATION_MS, EASING.linear, 0, 1),
    },
  },
};

/**
 * The value of `track` at `position` (ms or progress): the bracketing keyframes' tween through `ease`, held flat before
 * the first and after the last keyframe. `ease(name, x)` maps a unit progress through the named curve.
 */
export function sampleTrack(
  track: readonly MotionKeyframe[],
  position: number,
  ease: (name: EasingName, x: number) => number,
): number {
  const first = track[0];
  if (first === undefined) {
    return 0;
  }
  if (position <= first.at) {
    return first.value;
  }
  for (let index = 1; index < track.length; index += 1) {
    const previous = track[index - 1] as MotionKeyframe;
    const next = track[index] as MotionKeyframe;
    if (position <= next.at) {
      const span = next.at - previous.at;
      const progress = span > 0 ? (position - previous.at) / span : 1;
      return previous.value + (next.value - previous.value) * ease(previous.easingTo, progress);
    }
  }
  return (track[track.length - 1] as MotionKeyframe).value;
}
