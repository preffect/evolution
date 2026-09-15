// What a metabolism tick applied, by cause (docs/ui/hud.md §3.1.5 "Applied, at the floor and the cap", #383).
// `loseMassToFloor` clips decay and every drain together, so a rate is never the formula's value but what was
// taken: the loss `massAtStart − massAfterFloor` is split across the requested losses in proportion to their
// formula values, and the light is `massAfterGain − massAfterFloor`, after the cap. The causes therefore always add
// up to the mass that moved.

import { MASS_RATE_CAUSE, TICK_INTERVAL_S, type MassRateCause, type ZoneId } from '@evolution/shared';
import type { MassFlowRecord } from '../world/mass-flow-ledger.js';

/** Nothing requested: no share to split. */
const NO_LOSS_SHARE = 0;

/** The losses the formula asks for, mass/s, before the floor (all ≥ 0). */
export interface MetabolismDemand {
  readonly toxin: number;
  readonly swallowed: number;
  /** The broth share: surplus × rate × the trait multiplier. */
  readonly decay: number;
  /** The vent's extra over the broth share. */
  readonly vent: number;
}

/** One cell's tick as the metabolism step measured it. */
export interface MetabolismMeasure {
  readonly demand: MetabolismDemand;
  readonly massAtStart: number;
  readonly massAfterFloor: number;
  readonly massAfterGain: number;
  readonly zone: ZoneId;
  readonly decayMultiplier: number;
}

/** The share of each requested loss the floor let through: 1 above it, less at it, 0 when nothing was asked. */
function appliedLossShare(measure: MetabolismMeasure): number {
  const { toxin, swallowed, decay, vent } = measure.demand;
  const requestedPerTick = (toxin + swallowed + decay + vent) * TICK_INTERVAL_S;
  return requestedPerTick > 0 ? (measure.massAtStart - measure.massAfterFloor) / requestedPerTick : NO_LOSS_SHARE;
}

/** Mass/s applied per cause: losses negative, the light positive. */
export function appliedRatesPerSecond(measure: MetabolismMeasure): Record<MassRateCause, number> {
  const share = appliedLossShare(measure);
  const { demand } = measure;
  return {
    [MASS_RATE_CAUSE.toxin]: -demand.toxin * share,
    [MASS_RATE_CAUSE.swallowed]: -demand.swallowed * share,
    [MASS_RATE_CAUSE.decay]: -demand.decay * share,
    [MASS_RATE_CAUSE.vent]: -demand.vent * share,
    [MASS_RATE_CAUSE.light]: (measure.massAfterGain - measure.massAfterFloor) / TICK_INTERVAL_S,
  };
}

export function massFlowRecordOf(measure: MetabolismMeasure): MassFlowRecord {
  return {
    ratesPerSecond: appliedRatesPerSecond(measure),
    decayTraitShare: measure.decayMultiplier - 1,
    zone: measure.zone,
  };
}
