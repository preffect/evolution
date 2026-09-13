// Keyframe lookups for specs that time a clip (docs/RENDERING.md §4): a spec reads the moment and the
// value it asserts from `MOTION_CLIPS`, so retuning a clip moves the table and never a restated number.

import type { MotionKeyframe } from '@evolution/shared';

/** The keyframe with the highest value in `track` (the first of equals); throws on an empty track. */
export function peakKeyframe(track: readonly MotionKeyframe[] | undefined): MotionKeyframe {
  const [first, ...rest] = track ?? [];
  if (first === undefined) throw new Error('peakKeyframe needs a track with at least one keyframe.');
  return rest.reduce((peak, keyframe) => (keyframe.value > peak.value ? keyframe : peak), first);
}
