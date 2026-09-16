// The bench's worst-case legibility cues (docs/rendering/budget.md §7, `?bench&cues=1`, #385): the own cell of the
// bench scene drawn with every cue of docs/ui/hud.md §3.1.5 at once, so the `effects` stage is measured with all of
// them — a shrinking mass chip with its trend glyph, `RATE_TAG_ROWS_MAX` rate tags (the DECAY one with its trait glyph
// and share), the zone pill, and `FLOATER_MAX_VISIBLE` floaters kept alive by an eat, an engulf payout and a sprint
// landing in turn every `RENDER_BENCH_CUES.floaterEveryFrames`. Pure over the frame and the frame count, so a bench
// run is reproducible.

import {
  EFFECT_KIND,
  ENTITY_KIND,
  ZONE_ID,
  entityId,
  type CellView,
  type GameEffect,
  type MassFlowView,
  type OwnProgressView,
  type OwnedTrait,
  type PlayerId,
  type ValueOf,
} from '@evolution/shared';
import type { RenderFrame } from '../../net/world-store';
import { formatUnsignedMassRate, rateTagsFor } from '../../hud/format/mass-cues';
import { zonePillText } from '../../hud/format/zone-pill';
import { MASS_TREND } from '../../state/mass-trend';
import { ownCellIndicatorsFor, type OwnCellIndicators } from '../../state/own-cell-indicators';
import { RENDER_BENCH_CUES } from '../constants';
import { NO_HUD_INPUTS, type RenderInputs } from '../game-renderer';

/** The one-off change that lands on a floater frame. */
export const BENCH_CUE_STEP = { eat: 'eat', engulf: 'engulf', sprint: 'sprint' } as const;
export type BenchCueStep = ValueOf<typeof BENCH_CUE_STEP>;
/** The order the steps land in, one per floater frame, round and round. */
const BENCH_CUE_STEP_ORDER: readonly BenchCueStep[] = [
  BENCH_CUE_STEP.eat,
  BENCH_CUE_STEP.engulf,
  BENCH_CUE_STEP.sprint,
];

/** Mitochondrion I: the worked example's trait, whose ghost the DECAY tag draws. */
const BENCH_CUE_TRAITS: readonly OwnedTrait[] = [{ traitId: 'mitochondrion', tier: 1 }];
const BENCH_CUE_MOTE_ID = entityId('bench-cue-mote');
const BENCH_CUE_PREY_ID = entityId('bench-cue-prey');
const NO_RATE = 0;

export interface BenchCueFrame {
  readonly frame: RenderFrame;
  readonly inputs: RenderInputs;
}

/** The step a frame lands, or `null` between floater frames. */
export function benchCueStepAt(frameIndex: number): BenchCueStep | null {
  const { floaterEveryFrames } = RENDER_BENCH_CUES;
  if (frameIndex % floaterEveryFrames !== 0) return null;
  return BENCH_CUE_STEP_ORDER[(frameIndex / floaterEveryFrames) % BENCH_CUE_STEP_ORDER.length] ?? null;
}

function eatEffect(ownCell: CellView, tick: number): GameEffect {
  return {
    kind: EFFECT_KIND.eat,
    tick,
    x: ownCell.x,
    y: ownCell.y,
    cellId: ownCell.id,
    eatenId: BENCH_CUE_MOTE_ID,
    eatenKind: ENTITY_KIND.foodMote,
    massGained: RENDER_BENCH_CUES.eatMassGained,
    dnaGained: RENDER_BENCH_CUES.eatDnaGained,
  };
}

function engulfEffect(ownCell: CellView, tick: number, ownPlayerId: PlayerId): GameEffect {
  return {
    kind: EFFECT_KIND.cellAbsorbed,
    tick,
    x: ownCell.x,
    y: ownCell.y,
    cellId: BENCH_CUE_PREY_ID,
    playerId: ownPlayerId,
    predatorCellId: ownCell.id,
    predatorMassGained: RENDER_BENCH_CUES.engulfMassGained,
    predatorDnaGained: NO_RATE,
  };
}

/** The worked example's mass flow: three causes in the vent and the Mitochondrion I share. */
function benchMassFlow(): MassFlowView {
  return {
    ratesPerSecond: { ...RENDER_BENCH_CUES.ratesPerSecond },
    decayTraitShare: RENDER_BENCH_CUES.decayTraitShare,
    zone: ZONE_ID.warmVent,
  };
}

interface WorstCaseInput {
  readonly ownCell: CellView;
  readonly ownProgress: OwnProgressView;
  readonly frame: RenderFrame;
  /** The frame count when this frame lands a sprint; `null` otherwise. */
  readonly sprintTick: number | null;
}

function worstCaseRecord(input: WorstCaseInput): OwnCellIndicators {
  const { ownCell, frame, sprintTick } = input;
  const { balance } = frame;
  const massFlow = benchMassFlow();
  const ownProgress = { ...input.ownProgress, massFlow };
  const base = ownCellIndicatorsFor({ ownCell, ownProgress, balance, threats: [], previewTraitId: null });
  const netRate = Object.values(massFlow.ratesPerSecond).reduce((sum, rate) => sum + rate, NO_RATE);
  const rateText = formatUnsignedMassRate(netRate);
  const pillText = zonePillText({ zone: massFlow.zone, mass: ownCell.mass, traits: BENCH_CUE_TRAITS, balance });
  return {
    ...base,
    massChip: { ...base.massChip, trend: MASS_TREND.down, ratePerSecond: netRate, rateText },
    rateTags: rateTagsFor(massFlow, BENCH_CUE_TRAITS, balance),
    zone: { zone: massFlow.zone, pillText },
    sprintSpent: sprintTick === null ? null : { amount: RENDER_BENCH_CUES.sprintSpent, tick: sprintTick },
  };
}

/** This step's own-cell effects added to the frame's. */
function effectsFor(step: BenchCueStep | null, frame: RenderFrame, ownCell: CellView, ownPlayerId: PlayerId) {
  const effects: GameEffect[] = [...frame.effects];
  if (step === BENCH_CUE_STEP.eat) effects.push(eatEffect(ownCell, frame.renderTick));
  if (step === BENCH_CUE_STEP.engulf) effects.push(engulfEffect(ownCell, frame.renderTick, ownPlayerId));
  return effects;
}

/**
 * The frame with this step's own-cell effect added and the HUD crossings carrying the worst-case record; the frame
 * untouched and no record when the scene has no own cell or no progress for it.
 */
export function benchCueFrame(frame: RenderFrame, ownPlayerId: PlayerId | null, frameIndex: number): BenchCueFrame {
  const ownCell = frame.cells.find((cell) => cell.playerId === ownPlayerId);
  const ownProgress = frame.latest.ownProgress;
  if (ownCell === undefined || ownProgress === null || ownPlayerId === null) return { frame, inputs: NO_HUD_INPUTS };
  const step = benchCueStepAt(frameIndex);
  const sprintTick = step === BENCH_CUE_STEP.sprint ? frameIndex : null;
  const ownCellIndicators = worstCaseRecord({ ownCell, ownProgress, frame, sprintTick });
  return {
    frame: { ...frame, effects: effectsFor(step, frame, ownCell, ownPlayerId) },
    inputs: { ...NO_HUD_INPUTS, ownCellIndicators },
  };
}
