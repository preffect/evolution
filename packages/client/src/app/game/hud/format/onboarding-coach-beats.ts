// The coach beats (docs/ui/input-and-onboarding.md §5, decision #324 option C): each teaches one legibility cue of
// docs/ui/hud.md §3.1.5 the first time its mechanic touches the player, so they fire on a game event, not in table
// order. Their pill wears a `HINT_RIM_PX` rim in the cue's role colour. Pure, like the opening beats.

import { ZONE_ID, ticksToSeconds, type ZoneId } from '@evolution/shared';
import { DANGER, GAIN, ZONE_CUE } from '../../render/constants';
import { COACH_SHRINK_HOLD_SECONDS } from '../hud-constants';
import {
  ONBOARDING_BEAT,
  isHintTimeUp,
  timedBeat,
  type OnboardingBeat,
  type OnboardingBeatId,
} from './onboarding-beats';

const NO_RIM = { isDanger: false, isCoach: true, rimColour: null } as const;

/** One beat per zone that has a lesson; the open broth has none. */
const ZONE_BEATS: readonly (readonly [ZoneId, OnboardingBeatId])[] = [
  [ZONE_ID.warmVent, ONBOARDING_BEAT.zoneWarmVent],
  [ZONE_ID.sunlitShallows, ONBOARDING_BEAT.zoneSunlitShallows],
  [ZONE_ID.viscousGel, ONBOARDING_BEAT.zoneViscousGel],
];

/** Fires on entering `zone` (a spawn inside it counts); goes when the cell leaves it, or on the timer. */
function zoneBeat(zone: ZoneId, id: OnboardingBeatId): OnboardingBeat {
  return {
    id,
    isDanger: false,
    isCoach: true,
    rimColour: ZONE_CUE[zone] ?? null,
    isTriggered: (_observation, history) => history.enteredZone === zone,
    isStillWanted: (observation) => observation.zone === zone,
    isDismissed: (observation, history) => observation.zone !== zone || isHintTimeUp(observation, history),
  };
}

/** The trend has read `down` from decay alone for `COACH_SHRINK_HOLD_SECONDS`: a sprint alone does not. */
const shrink: OnboardingBeat = {
  id: ONBOARDING_BEAT.shrink,
  ...NO_RIM,
  isTriggered: (observation, history) =>
    history.shrinkSinceTick !== null &&
    ticksToSeconds(observation.tick - history.shrinkSinceTick) >= COACH_SHRINK_HOLD_SECONDS,
  isStillWanted: (observation) => observation.isShrinkingFromDecay,
  isDismissed: isHintTimeUp,
};

/** Contact or an aura drains the own cell; goes when no toxic cell reaches it any more, or on the timer. */
const toxin: OnboardingBeat = {
  id: ONBOARDING_BEAT.toxin,
  isDanger: true,
  isCoach: true,
  rimColour: DANGER,
  isTriggered: (observation) => observation.isToxinReaching,
  isStillWanted: (observation) => observation.isToxinReaching,
  isDismissed: (observation, history) => !observation.isToxinReaching || isHintTimeUp(observation, history),
};

/** A green-ringed cell in reach; goes when the player starts an engulf, or on the timer. */
const prey: OnboardingBeat = {
  id: ONBOARDING_BEAT.prey,
  isDanger: false,
  isCoach: true,
  rimColour: GAIN,
  isTriggered: (observation) => observation.hasPreyInReach,
  isStillWanted: (observation) => observation.hasPreyInReach && !observation.isEngulfing,
  isDismissed: (observation, history) => observation.isEngulfing || isHintTimeUp(observation, history),
};

/** §5's coach rows. */
export const COACH_BEATS: readonly OnboardingBeat[] = [
  shrink,
  ...ZONE_BEATS.map(([zone, id]) => zoneBeat(zone, id)),
  timedBeat(ONBOARDING_BEAT.bloom, (observation) => observation.isBloom, NO_RIM),
  prey,
  toxin,
];
