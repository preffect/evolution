// The `escape` preview scene (docs/architecture/encyclopedia.md §12.7, docs/ecology/absorption.md §6.1): the
// subject as prey. A heavier cell closes on it — the `DANGER` ring and the threat label go up — covers it, and the
// arms begin to close while the escape arc over the subject drains. Halfway through the wrap the subject sprints:
// contact breaks, progress decays at `ENGULF_ESCAPE_DECAY_MULTIPLIER` times the base rate (the arms playing
// backwards, being functions of progress), and the tick it falls back into the cover band the server releases it —
// `cell_released`, reason `escaped`, at the prey (`engulf-state.ts`). The predator falls behind and the loop rests.
//
// **Every rate is the simulation's**: the decay is `engulfProgressDelta` for a wrap out of contact at this pair's
// masses, the release tick the first at which `engulfPhaseOf` reads the decayed progress as cover, and the pair
// parts at the prey's held sprint speed less the predator's held chase (`preyHeldSpeedFactor`,
// `predatorEngulfSpeedFactor`). The preview adds **when** the prey reacts (`PREVIEW_ESCAPE_SPRINT_AT_WRAP_SHARE`)
// and one simplification: the sprint's first push clears the reach, so contact breaks on the tick the sprint
// starts — in play the held offset is a fraction of a radius.
//
// **The record matters here more than anywhere.** The escape arc, its `SPRINT TO ESCAPE` label and the threat
// label before it draw only from `RenderInputs.ownCellIndicators`, so this scene supplies the HUD's own record with
// the predator as the one threat: what the lens shows is what the HUD says.

import {
  EFFECT_KIND,
  ENGULF_PHASE,
  ENGULF_RELEASE_REASON,
  TICK_INTERVAL_S,
  canEngulf,
  engulfPhaseOf,
  engulfPhaseSpanSeconds,
  entityId,
  maxSpeedForMass,
  predatorEngulfSpeedFactor,
  preyHeldSpeedFactor,
  type BalanceConfig,
  type CellView,
  type GameEffect,
} from '@evolution/shared';
import type { OwnCellIndicators } from '../../../state/own-cell-indicators';
import { engulfDeformationPeak } from '../../cells/cell-clips';
import { restingDrawState } from '../../cells/cell-draw-extent';
import { REST_CLIP_PEAK } from '../../cells/shape-terms';
import {
  PREVIEW_ACTION_REST_SECONDS,
  PREVIEW_ACTION_SUBJECT_LEVEL,
  PREVIEW_ESCAPE_SPRINT_AT_WRAP_SHARE,
} from '../../constants';
import {
  ACTION_SUBJECT_CELL_ID,
  NO_FRAGMENTS,
  NO_MOTES,
  actionSubjectCellView,
  actionSubjectOwnCellIndicators,
  type SubjectThreats,
} from './action-subject';
import { PREVIEW_SUBJECT_PLAYER_ID } from './cell-scene';
import { previewScene } from '../preview-scene';
import type { PreviewScene, PreviewSceneContent, ScheduledPreviewEffect } from '../preview-scene';
import {
  ENGULF_PARTNER_CELL_ID,
  ENGULF_PARTNER_NAME,
  ENGULF_ROLE,
  FREE_PROGRESS,
  FREE_SPEED_FACTOR,
  NO_PREDATOR,
  NO_PREY,
  SWIMMING_SPEED_RATIO,
  alongApproach,
  alongApproachVelocity,
  approachOffsetWu,
  engulfPairFraming,
  engulfPairGeometry,
  engulfPartnerCellView,
  engulfProgressAfter,
  escapeDecayPerTick,
  heldOffsetWu,
  isAtOrAfter,
  predatorLinks,
  preyLinks,
  recedeSpeedOf,
  wholeTicksOf,
  type EngulfPairGeometry,
} from './engulf-pair';

const NO_TICKS_LEFT = 0;
/** The prey holds still until it sprints. */
const AT_REST = 0;
/** The pair wears no grip or resistance traits: the wrap's speed cap is the balance's plain factor. */
const NO_GRIP_BONUS = 0;
/** A `cell_released` starts no clip and draws no sprite; the predator's warning ring is bounded in the framing. */
const NO_EFFECT_SPRITES = 0;
/** The predator's arms at their widest, the frame the subject is framed to share the lens with. */
const ENGULF_PEAK = engulfDeformationPeak();

/** The loop's beats in whole ticks (`engulf-pair.ts`); everything after contact is the balance's. */
interface EscapeTimeline {
  readonly geometry: EngulfPairGeometry;
  readonly contactTick: number;
  /** The prey sprints and contact breaks, at this progress; the decay then takes this much a tick. */
  readonly sprintTick: number;
  readonly sprintProgress: number;
  readonly decayPerTick: number;
  /** `cell_released`: the first tick the decayed progress reads as cover. */
  readonly releaseTick: number;
  /** How fast the pair parts (wu/s), until the predator is back at the start distance and a still beat closes the loop. */
  readonly recedeSpeed: number;
  readonly recedeEndTick: number;
  readonly periodTicks: number;
}

function escapeTimeline(balance: BalanceConfig): EscapeTimeline {
  const { absorption } = balance;
  const geometry = engulfPairGeometry(ENGULF_ROLE.prey, balance);
  const contactTick = geometry.contactTick;
  const sprintAfterContactSeconds =
    engulfPhaseSpanSeconds(ENGULF_PHASE.cover, absorption) +
    engulfPhaseSpanSeconds(ENGULF_PHASE.wrap, absorption) * PREVIEW_ESCAPE_SPRINT_AT_WRAP_SHARE;
  const sprintTick = contactTick + wholeTicksOf(sprintAfterContactSeconds);
  const sprintProgress = engulfProgressAfter(sprintTick - contactTick, balance);
  const decayPerTick = escapeDecayPerTick(geometry, balance);
  // Released the first tick the decayed progress reads as cover (`engulfPhaseOf`).
  const coverBandTop = absorption.ENGULF_WRAP_START_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON;
  const releaseTick = sprintTick + Math.floor((sprintProgress - coverBandTop) / decayPerTick) + 1;
  const recedeSpeed = recedeSpeedOf(geometry, balance);
  const recedeWu = geometry.startDistanceWu - heldOffsetWu(sprintProgress, geometry, balance);
  const recedeEndTick = sprintTick + wholeTicksOf(recedeWu / recedeSpeed);
  return {
    geometry,
    contactTick,
    sprintTick,
    sprintProgress,
    decayPerTick,
    releaseTick,
    recedeSpeed,
    recedeEndTick,
    periodTicks: recedeEndTick + wholeTicksOf(PREVIEW_ACTION_REST_SECONDS),
  };
}

export function escapePreviewScene(): PreviewScene {
  return previewScene({
    subjectPlayerId: PREVIEW_SUBJECT_PLAYER_ID,
    framing: (balance) =>
      engulfPairFraming(
        ENGULF_ROLE.prey,
        {
          // The prey's widest frame is its sprint: the axial stretch and the doubled tail wave.
          subject: {
            speedRatio: SWIMMING_SPEED_RATIO,
            isSprinting: true,
            clip: REST_CLIP_PEAK,
            effectRadii: NO_EFFECT_SPRITES,
          },
          partnerFree: restingDrawState(SWIMMING_SPEED_RATIO),
          partnerEngaged: { ...restingDrawState(SWIMMING_SPEED_RATIO), clip: ENGULF_PEAK },
        },
        balance,
      ),
    periodSecondsFor: (balance) => escapeTimeline(balance).periodTicks * TICK_INTERVAL_S,
    contentAt: escapeContent,
    schedule: escapeSchedule,
    ownCellIndicators: escapeOwnCellIndicators,
  });
}

/** The prey's progress at `loopTick`, or `null` while free: before contact, and from the release on. */
function progressAt(loopTick: number, timeline: EscapeTimeline, balance: BalanceConfig): number | null {
  if (loopTick < timeline.contactTick || isAtOrAfter(loopTick, timeline.releaseTick)) return null;
  if (loopTick < timeline.sprintTick) return engulfProgressAfter(loopTick - timeline.contactTick, balance);
  return timeline.sprintProgress - (loopTick - timeline.sprintTick) * timeline.decayPerTick;
}

function escapeContent(loopSeconds: number, balance: BalanceConfig): PreviewSceneContent {
  const timeline = escapeTimeline(balance);
  const loopTick = loopSeconds / TICK_INTERVAL_S;
  const progress = progressAt(loopTick, timeline, balance);
  return {
    cells: [preyView(loopTick, progress, timeline, balance), predatorView(loopTick, progress, timeline, balance)],
    motes: NO_MOTES,
    fragments: NO_FRAGMENTS,
  };
}

/** The subject: still until it sprints, then fleeing along the approach at the speed the grip lets it. */
function preyView(
  loopTick: number,
  progress: number | null,
  timeline: EscapeTimeline,
  balance: BalanceConfig,
): CellView {
  const { controls, absorption, growth } = balance;
  const sprintedFor = loopTick - timeline.sprintTick;
  const isFleeing = isAtOrAfter(loopTick, timeline.sprintTick);
  const sprintTicks = controls.SPRINT_DURATION_SECONDS / TICK_INTERVAL_S;
  const cooldownTicks = controls.SPRINT_COOLDOWN_SECONDS / TICK_INTERVAL_S;
  const isSprinting = isFleeing && sprintedFor < sprintTicks;
  const heldFactor =
    progress === null
      ? FREE_SPEED_FACTOR
      : preyHeldSpeedFactor(engulfPhaseOf(progress, absorption), NO_GRIP_BONUS, NO_GRIP_BONUS, absorption);
  const speed =
    maxSpeedForMass(timeline.geometry.preyMass, growth) * (isSprinting ? controls.SPRINT_SPEED_MULTIPLIER : 1);
  return actionSubjectCellView(
    {
      ...alongApproachVelocity(isFleeing ? -speed * heldFactor : AT_REST),
      sprintRemainingTicks: isSprinting ? sprintTicks - sprintedFor : NO_TICKS_LEFT,
      sprintCooldownRemainingTicks:
        isFleeing && !isSprinting ? Math.max(NO_TICKS_LEFT, sprintTicks + cooldownTicks - sprintedFor) : NO_TICKS_LEFT,
      // The record draws the ladder's level pip beside the ring, so the subject wears a real level here.
      level: PREVIEW_ACTION_SUBJECT_LEVEL,
      ...preyLinks(progress === null ? NO_PREDATOR : ENGULF_PARTNER_CELL_ID, progress ?? FREE_PROGRESS),
    },
    balance,
  );
}

/** The partner: closing at its top speed, holding at the engulf's factor, then falling behind the sprint. */
function predatorView(
  loopTick: number,
  progress: number | null,
  timeline: EscapeTimeline,
  balance: BalanceConfig,
): CellView {
  const { geometry } = timeline;
  const offsetWu = isAtOrAfter(loopTick, timeline.sprintTick)
    ? Math.min(
        geometry.startDistanceWu,
        heldOffsetWu(timeline.sprintProgress, geometry, balance) +
          (loopTick - timeline.sprintTick) * TICK_INTERVAL_S * timeline.recedeSpeed,
      )
    : progress === null
      ? approachOffsetWu(loopTick, geometry)
      : heldOffsetWu(progress, geometry, balance);
  const speedFactor =
    progress === null
      ? FREE_SPEED_FACTOR
      : predatorEngulfSpeedFactor(engulfPhaseOf(progress, balance.absorption), balance.absorption);
  return engulfPartnerCellView(
    {
      mass: geometry.predatorMass,
      ...alongApproach(offsetWu),
      // Always chasing: toward the subject, which is back along the approach.
      ...alongApproachVelocity(-maxSpeedForMass(geometry.predatorMass, balance.growth) * speedFactor),
      ...predatorLinks(progress === null ? NO_PREY : ACTION_SUBJECT_CELL_ID),
    },
    balance,
  );
}

/** The prey holds the lens centre: no distance along the approach at all. */
const AT_THE_PREY = 0;

/** The release at the prey: where the server places `cell_released`. */
function escapeSchedule(balance: BalanceConfig): readonly ScheduledPreviewEffect[] {
  const released: GameEffect = {
    kind: EFFECT_KIND.cellReleased,
    tick: 0,
    ...alongApproach(AT_THE_PREY),
    cellId: entityId(ACTION_SUBJECT_CELL_ID),
    predatorCellId: entityId(ENGULF_PARTNER_CELL_ID),
    reason: ENGULF_RELEASE_REASON.escaped,
  };
  return [{ atLoopTick: escapeTimeline(balance).releaseTick, effect: released }];
}

/** The HUD's record with the predator as the one threat, by the HUD's own predicate; the record itself hides the label behind the escape arc. */
function escapeOwnCellIndicators(content: PreviewSceneContent, balance: BalanceConfig): OwnCellIndicators | null {
  const prey = content.cells.find((cell) => cell.id === entityId(ACTION_SUBJECT_CELL_ID));
  const predator = content.cells.find((cell) => cell.id === entityId(ENGULF_PARTNER_CELL_ID));
  if (prey === undefined || predator === undefined || !canEngulf(predator, prey, balance.absorption)) {
    return actionSubjectOwnCellIndicators(content, balance);
  }
  const deltaX = predator.x - prey.x;
  const deltaY = predator.y - prey.y;
  const threats: SubjectThreats = [
    { cellId: predator.id, name: ENGULF_PARTNER_NAME, distanceSquared: deltaX * deltaX + deltaY * deltaY },
  ];
  return actionSubjectOwnCellIndicators(content, balance, threats);
}
