// One snapshot as the onboarding queue samples it (docs/ui/input-and-onboarding.md §5): the facts every beat reads,
// derived from the snapshot and the records the HUD already built from it (the own cell, its progress, the indicators
// with the mass chip's trend). Pure; `OnboardingService` binds it to the live signals.

import {
  CELL_STAGE,
  EFFECT_KIND,
  MASS_RATE_CAUSE,
  PLAYER_LIFE_STATE,
  ROUND_PHASE,
  foldModifiers,
  isReachedByToxin,
  ticksToSeconds,
  type BalanceConfig,
  type CellView,
  type GameSnapshot,
  type MassFlowView,
  type OwnProgressView,
} from '@evolution/shared';
import { MASS_TREND, type MassTrend } from '../../state/mass-trend';
import type { OwnCellIndicators } from '../../state/own-cell-indicators';
import { COACH_PREY_REACH_RADII } from '../hud-constants';
import type { OnboardingObservation } from './onboarding-beats';
import type { OnboardingSample } from './onboarding-queue';
import { RELATION_RING, type Relation } from './relations-for';
import { isRoundInBloom } from './round-clock';

/** One snapshot with the records the HUD derived from it. */
export interface OnboardingSource {
  readonly snapshot: GameSnapshot;
  readonly ownCell: CellView | null;
  readonly ownProgress: OwnProgressView | null;
  readonly indicators: OwnCellIndicators | null;
  /** The on-screen relation rings (`GameStateService.relations`, `relationsFor`): the rule the rings are drawn by. */
  readonly relations: readonly Relation[];
  readonly balance: BalanceConfig | null;
  /** `sessionConfig.roundDurationSeconds`; `null` before the room's config has arrived. */
  readonly roundDurationSeconds: number | null;
}

/** A loss rate present on the wire (losses are negative; a zero cause is omitted). */
function lossOf(massFlow: MassFlowView, cause: keyof MassFlowView['ratesPerSecond']): number {
  return Math.min(0, massFlow.ratesPerSecond[cause] ?? 0);
}

/**
 * The `shrink` beat's condition on one snapshot (§5): the trend reads `down`, and decay + vent is the largest loss —
 * with no `toxin` or `swallowed` rate present, decay and the vent are the only losses left, so it is enough that they
 * are losing mass at all.
 */
export function isShrinkingFromDecay(trend: MassTrend | null, massFlow: MassFlowView | null): boolean {
  if (trend !== MASS_TREND.down || massFlow === null) return false;
  const hasOtherCause =
    massFlow.ratesPerSecond[MASS_RATE_CAUSE.toxin] !== undefined ||
    massFlow.ratesPerSecond[MASS_RATE_CAUSE.swallowed] !== undefined;
  return !hasOtherCause && lossOf(massFlow, MASS_RATE_CAUSE.decay) + lossOf(massFlow, MASS_RATE_CAUSE.vent) < 0;
}

/**
 * The `toxin` beat's condition (§5): a `toxin` rate is present, and it is not only the own engulf's prey draining
 * the own cell during cover (past cover that dose is `swallowed`, never `toxin`). The toxic cells that reach are
 * found by the rule the server drains by (`isReachedByToxin`).
 */
export function isToxinReaching(
  ownCell: CellView,
  massFlow: MassFlowView | null,
  cells: readonly CellView[],
  balance: BalanceConfig,
): boolean {
  if (massFlow === null || lossOf(massFlow, MASS_RATE_CAUSE.toxin) >= 0) return false;
  if (ownCell.engulfingCellId === null) return true;
  return cells.some((cell) => {
    if (cell.id === ownCell.id || cell.id === ownCell.engulfingCellId) return false;
    const modifiers = foldModifiers(cell.traits, balance.traits.TRAIT_TIERS);
    return modifiers.toxinDrainFractionPerSecond > 0 && isReachedByToxin(ownCell, { ...cell, modifiers });
  });
}

/** The round clock is in bloom; "not yet" before the room's config or the balance has arrived. */
function isBloomFor({ snapshot, balance, roundDurationSeconds }: OnboardingSource): boolean {
  if (balance === null) return false;
  return isRoundInBloom({
    timeLeftMs: snapshot.roundTimeLeftMs,
    roundPhase: snapshot.roundPhase,
    roundDurationSeconds,
    bloomStartFraction: balance.session.ROUND_BLOOM_START_FRACTION,
    foodBloomMultiplier: balance.ecology.FOOD_BLOOM_SPAWN_MULTIPLIER,
    dnaFragmentBloomMultiplier: balance.ecology.DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER,
  });
}

/**
 * The `prey` beat's condition (§5): a cell carrying the green ring — the rings' own `edible` rule, and not toxic,
 * whose ring is the red double line — is within `COACH_PREY_REACH_RADII` own radii of the own cell, edge to edge.
 */
export function hasPreyInReach(ownCell: CellView, relations: readonly Relation[], cells: readonly CellView[]): boolean {
  const reachWu = COACH_PREY_REACH_RADII * ownCell.radius;
  return relations.some((relation) => {
    if (relation.ring !== RELATION_RING.edible) return false;
    const prey = cells.find((cell) => cell.id === relation.cellId);
    if (prey === undefined) return false;
    return Math.sqrt(relation.distanceSquared) - ownCell.radius - prey.radius <= reachWu;
  });
}

function observationFor(
  source: OnboardingSource,
  ownCell: CellView,
  ownProgress: OwnProgressView,
): OnboardingObservation {
  const { snapshot, indicators, balance } = source;
  const massFlow = ownProgress.massFlow;
  return {
    tick: snapshot.tick,
    roundElapsedSeconds: ticksToSeconds(snapshot.tick - snapshot.roundStartTick),
    dnaCumulative: ownProgress.dnaCumulative,
    hasOffer: ownProgress.offer !== null,
    isProkaryote: ownProgress.stage === CELL_STAGE.prokaryote,
    hasThreat: indicators !== null && indicators.nearestThreat !== null,
    zone: massFlow === null ? null : massFlow.zone,
    isShrinkingFromDecay: indicators !== null && isShrinkingFromDecay(indicators.massChip.trend, massFlow),
    isBloom: isBloomFor(source),
    isToxinReaching: balance !== null && isToxinReaching(ownCell, massFlow, snapshot.cells, balance),
    hasPreyInReach: hasPreyInReach(ownCell, source.relations, snapshot.cells),
    isEngulfing: ownCell.engulfingCellId !== null,
  };
}

/** The facts one snapshot gives the queue; no observation while there is no own cell alive in play. */
export function onboardingSampleFor(source: OnboardingSource): OnboardingSample {
  const { snapshot, ownCell, ownProgress } = source;
  const isAliveInPlay =
    ownCell !== null &&
    ownProgress !== null &&
    ownProgress.lifeState === PLAYER_LIFE_STATE.alive &&
    snapshot.roundPhase === ROUND_PHASE.playing;
  return {
    tick: snapshot.tick,
    observation: isAliveInPlay ? observationFor(source, ownCell, ownProgress) : null,
    ownCell: ownCell === null ? null : { id: ownCell.id, x: ownCell.x, y: ownCell.y },
    hasOwnEat:
      ownCell !== null &&
      snapshot.effects.some((effect) => effect.kind === EFFECT_KIND.eat && effect.cellId === ownCell.id),
    isSprinting: ownCell !== null && ownCell.sprintRemainingTicks > 0,
  };
}
