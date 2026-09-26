// The `engulf` preview scene (docs/architecture/encyclopedia.md §12.7, docs/ecology/absorption.md §6.1): the
// subject as predator. A smaller cell drifts in, the membrane covers it, the arms close and fold into the seal,
// the prey sinks under the film, and the payout fires — `cell_absorbed` at the prey, which the effect layer
// turns into the dissolving ghost and the DNA streams while the predator's seal relaxes. A beat later a `respawn`
// puts the prey back where it started, **with the same id**, so its look is identical every loop (§12.7).
//
// **The phases are the balance's.** Progress climbs from contact to the payout over the three
// `engulfPhaseSpanSeconds`, so a patched `ENGULF_COVER_SECONDS`, `ENGULF_WRAP_SECONDS` or `ENGULF_ABSORB_SECONDS`
// retimes the arms, the seal and the payout as the loop plays (`engulf-pair.ts`). The predator's speed while it holds is the
// simulation's `predatorEngulfSpeedFactor`, so its stretch eases through the cover and wrap and returns once
// sealed. The prey is passive here: it neither steers nor sprints, which is what lets the engulf run its course.
//
// **The prey leaves on the payout tick and returns on the respawn tick**, the ticks the two effects are emitted
// at. The ghost needs the prey drawn the frame before its `cell_absorbed`, and the respawn clip needs a cell to
// play on the frame its effect arrives — the same contract the eat scene keeps with its mote.

import {
  EFFECT_KIND,
  ENGULF_PHASE,
  MILLISECONDS_PER_SECOND,
  MOTION_CLIP,
  MOTION_CLIPS,
  TICK_INTERVAL_S,
  engulfPhaseOf,
  entityId,
  predatorEngulfSpeedFactor,
  type BalanceConfig,
  type CellView,
  type GameEffect,
} from '@evolution/shared';
import { engulfDeformationPeak } from '../../cells/cell-clips';
import { restingDrawState } from '../../cells/cell-draw-extent';
import { effectSpriteReachRadii } from '../../effects/effect-reach';
import { PREVIEW_ACTION_REST_SECONDS } from '../../constants';
import { previewScene } from '../preview-scene';
import type { PreviewScene, PreviewSceneContent, ScheduledPreviewEffect } from '../preview-scene';
import { ACTION_SUBJECT_CELL_ID, NO_FRAGMENTS, NO_MOTES, NO_SPEED, actionSubjectCellView } from './action-subject';
import { PREVIEW_SUBJECT_PLAYER_ID } from './cell-scene';
import {
  COMPLETE_PROGRESS,
  ENGULF_PARTNER_CELL_ID,
  ENGULF_ROLE,
  FREE_PROGRESS,
  FREE_SPEED_FACTOR,
  NO_PREDATOR,
  NO_PREY,
  PREVIEW_PARTNER_PLAYER_ID,
  RESTING_SPEED_RATIO,
  SWIMMING_SPEED_RATIO,
  alongApproach,
  alongApproachVelocity,
  approachOffsetWu,
  engulfPairFraming,
  engulfPairGeometry,
  engulfPartnerCellView,
  engulfProgressAfter,
  engulfSpanSeconds,
  heldOffsetWu,
  isAtOrAfter,
  isAtOrBefore,
  predatorLinks,
  preyLinks,
  wholeTicksOf,
  type EngulfPairGeometry,
} from './engulf-pair';

/** The predator's arms, notch and seal at their widest, from the real `clipDeformation` over the whole progress. */
const ENGULF_PEAK = engulfDeformationPeak();

/** The ghost dissolves for the `absorbed` clip's length before the prey may return (§12.7). */
const GHOST_SECONDS = MOTION_CLIPS[MOTION_CLIP.absorbed].duration / MILLISECONDS_PER_SECOND;
/** The prey fades back in for the `respawn` clip's length; the loop outlasts it before it starts again. */
const RESPAWN_SECONDS = MOTION_CLIPS[MOTION_CLIP.respawn].duration / MILLISECONDS_PER_SECOND;

/** The loop's beats, in whole ticks (`engulf-pair.ts`); everything after contact is the balance's. */
interface EngulfTimeline {
  readonly geometry: EngulfPairGeometry;
  readonly contactTick: number;
  /** The payout: `cell_absorbed`, the prey's last frame. */
  readonly absorbedTick: number;
  /** `respawn`: the prey's first frame back, once the ghost has gone and a still beat has passed. */
  readonly respawnTick: number;
  readonly periodTicks: number;
}

function engulfTimeline(balance: BalanceConfig): EngulfTimeline {
  const geometry = engulfPairGeometry(ENGULF_ROLE.predator, balance);
  const contactTick = geometry.contactTick;
  const absorbedTick = contactTick + wholeTicksOf(engulfSpanSeconds(balance));
  const respawnTick = absorbedTick + wholeTicksOf(GHOST_SECONDS) + wholeTicksOf(PREVIEW_ACTION_REST_SECONDS);
  return {
    geometry,
    contactTick,
    absorbedTick,
    respawnTick,
    periodTicks: respawnTick + wholeTicksOf(RESPAWN_SECONDS) + wholeTicksOf(PREVIEW_ACTION_REST_SECONDS),
  };
}

export function engulfPreviewScene(): PreviewScene {
  return previewScene({
    subjectPlayerId: PREVIEW_SUBJECT_PLAYER_ID,
    framing: (balance) =>
      engulfPairFraming(
        ENGULF_ROLE.predator,
        {
          // The predator swims the whole loop and wears the arms at their widest: one bound over both halves.
          subject: {
            speedRatio: SWIMMING_SPEED_RATIO,
            isSprinting: false,
            clip: ENGULF_PEAK,
            effectRadii: NO_EFFECT_SPRITES,
          },
          // The prey returns at the start distance under the respawn halo, the widest thing drawn around it.
          partnerFree: {
            ...restingDrawState(RESTING_SPEED_RATIO),
            effectRadii: effectSpriteReachRadii(MOTION_CLIP.respawn),
          },
          partnerEngaged: restingDrawState(RESTING_SPEED_RATIO),
        },
        balance,
      ),
    periodSecondsFor: (balance) => engulfTimeline(balance).periodTicks * TICK_INTERVAL_S,
    contentAt: engulfContent,
    schedule: engulfSchedule,
  });
}

/** The predator's own clips draw no sprite; the prey's respawn halo is the partner's. */
const NO_EFFECT_SPRITES = 0;

/** The prey's progress at `loopTick`, or `null` while it is free — before contact, and once absorbed. */
function progressAt(loopTick: number, timeline: EngulfTimeline, balance: BalanceConfig): number | null {
  if (loopTick < timeline.contactTick || !isAtOrBefore(loopTick, timeline.absorbedTick)) return null;
  return engulfProgressAfter(loopTick - timeline.contactTick, balance);
}

function engulfContent(loopSeconds: number, balance: BalanceConfig): PreviewSceneContent {
  const timeline = engulfTimeline(balance);
  const loopTick = loopSeconds / TICK_INTERVAL_S;
  const progress = progressAt(loopTick, timeline, balance);
  const isPreyPresent = isAtOrBefore(loopTick, timeline.absorbedTick) || isAtOrAfter(loopTick, timeline.respawnTick);
  const predator = predatorView(progress, isPreyPresent, balance);
  const cells = isPreyPresent ? [predator, preyView({ loopTick, progress }, predator, timeline, balance)] : [predator];
  return { cells, motes: NO_MOTES, fragments: NO_FRAGMENTS };
}

/** One frame's place in the loop: the tick, and the prey's progress if it is held. */
interface EngulfMoment {
  readonly loopTick: number;
  readonly progress: number | null;
}

/** The subject: swimming toward its prey at its top speed, held to the engulf's factor while it holds one. */
function predatorView(progress: number | null, isPreyPresent: boolean, balance: BalanceConfig): CellView {
  const speedFactor =
    progress === null
      ? FREE_SPEED_FACTOR
      : predatorEngulfSpeedFactor(engulfPhaseOf(progress, balance.absorption), balance.absorption);
  return actionSubjectCellView(
    {
      ...alongApproachVelocity(balance.growth.CELL_BASE_SPEED * speedFactor),
      ...predatorLinks(progress === null || !isPreyPresent ? NO_PREY : ENGULF_PARTNER_CELL_ID),
    },
    balance,
  );
}

/** The partner: drifting in, then held and sinking, then carried; back at the start once respawned. */
function preyView(
  { loopTick, progress }: EngulfMoment,
  predator: CellView,
  timeline: EngulfTimeline,
  balance: BalanceConfig,
): CellView {
  const { geometry } = timeline;
  const offsetWu =
    progress === null
      ? loopTick < timeline.contactTick
        ? approachOffsetWu(loopTick, geometry)
        : geometry.startDistanceWu
      : heldOffsetWu(progress, geometry, balance);
  const isCarried = progress !== null && engulfPhaseOf(progress, balance.absorption) === ENGULF_PHASE.absorb;
  return engulfPartnerCellView(
    {
      mass: geometry.preyMass,
      ...alongApproach(offsetWu),
      // A sealed prey rides with its predator; before that it is passive, and it is still once respawned.
      velocityX: isCarried ? predator.velocityX : NO_SPEED,
      velocityY: isCarried ? predator.velocityY : NO_SPEED,
      ...preyLinks(progress === null ? NO_PREDATOR : ACTION_SUBJECT_CELL_ID, progress ?? FREE_PROGRESS),
    },
    balance,
  );
}

/** The payout at the prey — where the server places `cell_absorbed` — and the respawn where the prey comes back. */
function engulfSchedule(balance: BalanceConfig): readonly ScheduledPreviewEffect[] {
  const timeline = engulfTimeline(balance);
  const { geometry } = timeline;
  const absorbedAt = alongApproach(heldOffsetWu(COMPLETE_PROGRESS, geometry, balance));
  const respawnAt = alongApproach(geometry.startDistanceWu);
  const absorbed: GameEffect = {
    kind: EFFECT_KIND.cellAbsorbed,
    tick: 0,
    x: absorbedAt.x,
    y: absorbedAt.y,
    cellId: entityId(ENGULF_PARTNER_CELL_ID),
    playerId: PREVIEW_PARTNER_PLAYER_ID,
    predatorCellId: entityId(ACTION_SUBJECT_CELL_ID),
    predatorMassGained: geometry.preyMass * balance.absorption.ENGULF_MASS_YIELD,
    predatorDnaGained: balance.absorption.ENGULF_DNA_BASE,
  };
  const respawn: GameEffect = {
    kind: EFFECT_KIND.respawn,
    tick: 0,
    x: respawnAt.x,
    y: respawnAt.y,
    cellId: entityId(ENGULF_PARTNER_CELL_ID),
    playerId: PREVIEW_PARTNER_PLAYER_ID,
  };
  return [
    { atLoopTick: timeline.absorbedTick, effect: absorbed },
    { atLoopTick: timeline.respawnTick, effect: respawn },
  ];
}
