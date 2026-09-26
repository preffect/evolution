// What the two-cell action scenes share (docs/architecture/encyclopedia.md §12.7, docs/ecology/absorption.md §6.1,
// ticket #364): a predator and a prey at exactly the required mass ratio, the contact rule and the phase spans the
// server plays by, the pair's lens, and the approach both `engulf` and `escape` open with.
//
// **The subject holds the lens centre and its partner moves**, whichever side of the engulf the subject is on. The
// camera parks on the subject as `ownPlayerId`, so in `engulf` the prey drifts in toward a predator that is really
// the one swimming, and in `escape` the predator closes on a resting prey and then falls behind a fleeing one —
// both exactly what the player's own camera shows.
//
// **Everything with a time in it is the simulation's.** The pair sits at exactly `ENGULF_MASS_RATIO`, so
// `engulfMassFactor` is 1 and each phase lasts exactly `engulfPhaseSpanSeconds`; contact is the server's
// `predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION` (`contact.ts`); the approach closes at the predator's
// own top speed. The preview's own numbers are framing only — where the partner starts, how deep a held prey
// sinks, when the escaping prey decides to sprint (`render/constants/preview.ts`).
//
// **The timeline is in whole ticks.** An effect lands on a tick, and the bodies it removes or returns compare a
// loop tick against that same tick, so every breakpoint is `wholeTicksOf` its seconds and `TICK_TOLERANCE`
// absorbs the float noise of `loopSeconds / TICK_INTERVAL_S`. The eat scene leans on 1.1 s being exactly 66
// ticks instead (ticket #505); a derived timeline cannot.

import {
  CELL_KIND,
  CELL_STATE,
  ENGULF_PHASE,
  RADIANS_PER_FULL_TURN,
  TICK_INTERVAL_S,
  engulfPhaseSpanSeconds,
  engulfProgressDelta,
  engulfSealProgress,
  playerId,
  predatorEngulfSpeedFactor,
  preyHeldSpeedFactor,
  radiusForMass,
  type BalanceConfig,
  type CellView,
  type PlayerId,
  type ValueOf,
} from '@evolution/shared';
import { cellDrawExtentRadii, type CellDrawState } from '../../cells/cell-draw-extent';
import { summariseCellTraits } from '../../cells/cell-traits';
import {
  ENGULF_WARNING_RING_RADII,
  PREVIEW_CELL_BODY_FILL_FRACTION,
  PREVIEW_CELL_DRAWN_FILL_FRACTION,
  PREVIEW_CELL_MASS,
  PREVIEW_ENGULF_APPROACH_TURNS,
  PREVIEW_ENGULF_PARTNER_TRAITS,
  PREVIEW_ENGULF_SINK_FRACTION,
  PREVIEW_ENGULF_START_GAP_RADII,
} from '../../constants';
import { previewCellView, type PreviewCellSpec } from '../preview-frame';
import type { PreviewFraming } from '../preview-scene';
import {
  ACTION_SUBJECT_CENTRE,
  AT_REST_POSE,
  actionSubjectCellView,
  pointFromSubject,
  velocityAlong,
} from './action-subject';

/** Which side of the engulf the subject — the cell the camera follows — plays. */
export const ENGULF_ROLE = { predator: 'predator', prey: 'prey' } as const;
export type EngulfRole = ValueOf<typeof ENGULF_ROLE>;

/** The cell across from the subject; one id and one player for both scenes, so its cosmetic fork is shared. */
export const ENGULF_PARTNER_CELL_ID = 'preview-engulf-partner';
export const PREVIEW_PARTNER_PLAYER_ID: PlayerId = playerId('preview-partner');
/** The second palette, so the pair reads apart at a glance. */
const PARTNER_AVATAR_INDEX = 1;
/** What the threat label calls the partner while it can engulf the subject: `RIVAL CAN ENGULF YOU`. */
export const ENGULF_PARTNER_NAME = 'Rival';

/** The direction from the subject to its partner (world frame, radians). */
export const APPROACH_ANGLE = PREVIEW_ENGULF_APPROACH_TURNS * RADIANS_PER_FULL_TURN;

/** Progress runs to here; the payout fires when it arrives. A free cell carries none. */
export const COMPLETE_PROGRESS = 1;
export const FREE_PROGRESS = 0;
/** The speed ratios the two scenes pose their cells at, and the speed factor of a cell no engulf holds. */
export const SWIMMING_SPEED_RATIO = 1;
export const RESTING_SPEED_RATIO = 0;
export const FREE_SPEED_FACTOR = 1;
/** A cell that holds nobody, and one nobody holds. */
export const NO_PREY = null;
export const NO_PREDATOR = null;
/** A millionth of a tick: the float noise a loop time carries after its trip through seconds and back. */
export const TICK_TOLERANCE = 1e-6;
/** The whole tick at or after `seconds`, so every breakpoint an effect lands on is a tick a frame can hit. */
export function wholeTicksOf(seconds: number): number {
  return Math.ceil(seconds / TICK_INTERVAL_S - TICK_TOLERANCE);
}
export function isAtOrAfter(loopTick: number, eventTick: number): boolean {
  return loopTick >= eventTick - TICK_TOLERANCE;
}
export function isAtOrBefore(loopTick: number, eventTick: number): boolean {
  return loopTick <= eventTick + TICK_TOLERANCE;
}

/** The pair at the live balance, for a subject on `subjectRole`'s side. */
export interface EngulfPairGeometry {
  readonly predatorMass: number;
  readonly preyMass: number;
  readonly partnerMass: number;
  readonly subjectRadiusWu: number;
  readonly partnerRadiusWu: number;
  /** The server's contact rule: centres this close, the predator's membrane lies over the prey's centre. */
  readonly contactReachWu: number;
  /** Where the partner starts, and returns to: clear water between the two membranes. */
  readonly startDistanceWu: number;
  /** The tick the predator, closing from the start distance at its own top speed, makes contact. */
  readonly contactTick: number;
}

export function engulfPairGeometry(subjectRole: EngulfRole, balance: BalanceConfig): EngulfPairGeometry {
  const ratio = balance.absorption.ENGULF_MASS_RATIO;
  const isSubjectPredator = subjectRole === ENGULF_ROLE.predator;
  // Exactly the required ratio, so `engulfMassFactor` is 1 and the phases play at their base spans.
  const predatorMass = isSubjectPredator ? PREVIEW_CELL_MASS : PREVIEW_CELL_MASS * ratio;
  const preyMass = isSubjectPredator ? PREVIEW_CELL_MASS / ratio : PREVIEW_CELL_MASS;
  const predatorRadiusWu = radiusForMass(predatorMass, balance.growth);
  const preyRadiusWu = radiusForMass(preyMass, balance.growth);
  const subjectRadiusWu = radiusForMass(PREVIEW_CELL_MASS, balance.growth);
  const contactReachWu = predatorRadiusWu - preyRadiusWu * balance.absorption.ENGULF_COVERAGE_FRACTION;
  const startDistanceWu = predatorRadiusWu + preyRadiusWu + PREVIEW_ENGULF_START_GAP_RADII * subjectRadiusWu;
  return {
    predatorMass,
    preyMass,
    partnerMass: isSubjectPredator ? preyMass : predatorMass,
    subjectRadiusWu,
    partnerRadiusWu: isSubjectPredator ? preyRadiusWu : predatorRadiusWu,
    contactReachWu,
    startDistanceWu,
    contactTick: wholeTicksOf((startDistanceWu - contactReachWu) / balance.growth.CELL_BASE_SPEED),
  };
}

/** The three spans summed: contact to payout with nobody fighting — at this pair's ratio, the base duration itself. */
export function engulfSpanSeconds(balance: BalanceConfig): number {
  return Object.values(ENGULF_PHASE).reduce((sum, phase) => sum + engulfPhaseSpanSeconds(phase, balance.absorption), 0);
}

/** Progress `sinceContactTicks` after contact with nobody fighting: linear over the spans, capped at the payout. */
export function engulfProgressAfter(sinceContactTicks: number, balance: BalanceConfig): number {
  return Math.min(COMPLETE_PROGRESS, (sinceContactTicks * TICK_INTERVAL_S) / engulfSpanSeconds(balance));
}

/**
 * Where a held prey's centre sits from its predator's: the contact reach it was caught at, sinking to
 * `PREVIEW_ENGULF_SINK_FRACTION` of it by the seal, and carried there through the absorb. Progress-driven, like
 * the arms, so an escape's decay plays it backwards.
 */
export function heldOffsetWu(progress: number, geometry: EngulfPairGeometry, balance: BalanceConfig): number {
  const sealShare = Math.min(1, progress / engulfSealProgress(balance.absorption));
  return geometry.contactReachWu * (1 - (1 - PREVIEW_ENGULF_SINK_FRACTION) * sealShare);
}

/** The partner's centre distance while the predator closes: from the start to the reach, at its top speed. */
export function approachOffsetWu(loopTick: number, geometry: EngulfPairGeometry): number {
  const share = Math.min(1, loopTick / geometry.contactTick);
  return geometry.startDistanceWu - (geometry.startDistanceWu - geometry.contactReachWu) * share;
}

/** The point `distanceWu` out from the subject's centre along the approach. */
export function alongApproach(distanceWu: number): { readonly x: number; readonly y: number } {
  return pointFromSubject(APPROACH_ANGLE, distanceWu);
}

/** A velocity of `speed` along the approach: toward the partner when positive, away from it when negative. */
export function alongApproachVelocity(speed: number): { readonly velocityX: number; readonly velocityY: number } {
  return velocityAlong(APPROACH_ANGLE, speed);
}

type EngulfLinks = Pick<PreviewCellSpec, 'states' | 'engulfProgress' | 'engulfingCellId' | 'engulfedByCellId'>;

const FREE_LINKS: EngulfLinks = { states: [CELL_STATE.free] };

/** The predator's half of a running engulf: it names the prey it holds. */
export function predatorLinks(preyCellId: string | null): EngulfLinks {
  return preyCellId === null ? FREE_LINKS : { states: [CELL_STATE.engulfing], engulfingCellId: preyCellId };
}

/** The prey's half: its predator and the progress the arms, the film and the escape arc are drawn from. */
export function preyLinks(predatorCellId: string | null, progress: number): EngulfLinks {
  if (predatorCellId === null) return FREE_LINKS;
  return { states: [CELL_STATE.beingEngulfed], engulfedByCellId: predatorCellId, engulfProgress: progress };
}

/** The partner's placement this frame; its identity and traits are fixed. */
export type EngulfPartnerPose = Pick<PreviewCellSpec, 'mass' | 'x' | 'y' | 'velocityX' | 'velocityY'> & EngulfLinks;

export function engulfPartnerCellView(pose: EngulfPartnerPose, balance: BalanceConfig): CellView {
  return previewCellView(
    {
      id: ENGULF_PARTNER_CELL_ID,
      kind: CELL_KIND.player,
      playerId: PREVIEW_PARTNER_PLAYER_ID,
      avatarIndex: PARTNER_AVATAR_INDEX,
      traits: PREVIEW_ENGULF_PARTNER_TRAITS,
      ...pose,
    },
    balance,
  );
}

/** What each body of the pair is doing at its widest, for the lens. */
export interface EngulfPairDrawStates {
  readonly subject: CellDrawState;
  /** The partner out at the start distance: approaching, receding, or just respawned. */
  readonly partnerFree: CellDrawState;
  /** The partner at the contact reach: holding, or held. */
  readonly partnerEngaged: CellDrawState;
}

/**
 * The tightest lens that holds both bodies in the safe band and everything drawn inside the rim, over the whole
 * loop — the `cell` family's rule over two cells. The partner is bounded twice, because its two widest moments
 * are not the same moment: out at the start distance it is resting, and at the contact reach it wears the
 * engulf's arms (as the predator) or sits under the film (as the prey). Bounding it once, at the start distance
 * with the arms, would frame for a frame that never happens.
 */
export function engulfPairFraming(
  subjectRole: EngulfRole,
  states: EngulfPairDrawStates,
  balance: BalanceConfig,
): PreviewFraming {
  const geometry = engulfPairGeometry(subjectRole, balance);
  const subjectTraits = summariseCellTraits(actionSubjectCellView(AT_REST_POSE, balance));
  const partnerTraits = summariseCellTraits(
    engulfPartnerCellView(
      { mass: geometry.partnerMass, ...ACTION_SUBJECT_CENTRE, ...AT_REST_POSE, ...FREE_LINKS },
      balance,
    ),
  );
  const subject = cellDrawExtentRadii(subjectTraits, states.subject);
  const free = cellDrawExtentRadii(partnerTraits, states.partnerFree);
  const engaged = cellDrawExtentRadii(partnerTraits, states.partnerEngaged);
  // The warning ring circles the partner while it can engulf the subject: a drawn extent the cell's own is not.
  const freeDrawnRadii =
    subjectRole === ENGULF_ROLE.prey ? Math.max(free.drawnRadii, ENGULF_WARNING_RING_RADII) : free.drawnRadii;
  const { subjectRadiusWu, partnerRadiusWu, startDistanceWu, contactReachWu } = geometry;
  const bodyWu = Math.max(
    subject.bodyRadii * subjectRadiusWu,
    startDistanceWu + free.bodyRadii * partnerRadiusWu,
    contactReachWu + engaged.bodyRadii * partnerRadiusWu,
  );
  const drawnWu = Math.max(
    subject.drawnRadii * subjectRadiusWu,
    startDistanceWu + freeDrawnRadii * partnerRadiusWu,
    contactReachWu + engaged.drawnRadii * partnerRadiusWu,
  );
  return {
    target: { ...ACTION_SUBJECT_CENTRE, radius: subjectRadiusWu },
    viewRadiusWu: Math.max(bodyWu / PREVIEW_CELL_BODY_FILL_FRACTION, drawnWu / PREVIEW_CELL_DRAWN_FILL_FRACTION),
  };
}

/** The prey steers straight away from its predator: the struggle formula's full effort. */
const FULL_AWAY_EFFORT = 1;
/** The pair wears no grip or resistance traits: the wrap's speed cap is the balance's plain factor. */
export const NO_GRIP_BONUS = 0;

/** The escape decay, as the server applies it to a wrap that has lost contact, at this pair's masses. */
export function escapeDecayPerTick(geometry: EngulfPairGeometry, balance: BalanceConfig): number {
  return -engulfProgressDelta(
    {
      phase: ENGULF_PHASE.wrap,
      predatorMass: geometry.predatorMass,
      preyMass: geometry.preyMass,
      isInContact: false,
      awayEffort: FULL_AWAY_EFFORT,
      predator: balance.traits.DEFAULT_CELL_MODIFIERS,
      prey: balance.traits.DEFAULT_CELL_MODIFIERS,
    },
    balance.absorption,
  );
}

/** The prey's held sprint speed less the predator's held chase: how fast the pair parts once the sprint starts. */
export function recedeSpeedOf(balance: BalanceConfig): number {
  const { absorption, growth, controls } = balance;
  const preySprint =
    growth.CELL_BASE_SPEED *
    controls.SPRINT_SPEED_MULTIPLIER *
    preyHeldSpeedFactor(ENGULF_PHASE.wrap, NO_GRIP_BONUS, NO_GRIP_BONUS, absorption);
  const predatorChase = growth.CELL_BASE_SPEED * predatorEngulfSpeedFactor(ENGULF_PHASE.wrap, absorption);
  return preySprint - predatorChase;
}
