// The legibility cues' half of the `OwnCellIndicators` record (docs/ui/hud.md §3.1.4–§3.1.5): the mass chip, the
// rate tags, the zone and the sprint's cost, derived once from the snapshot and the two memories the caller carries
// (the mass trend and the zone entries). The floaters' other amounts are server effects the renderer reads on its
// own clock; the sprint's cost arrives on `massFlow` rather than as an effect, so the record hands it over with the
// tick it came with. Pure and DOM-free.

import type { BalanceConfig, CellView, OwnProgressView, ZoneId } from '@evolution/shared';
import { formatUnsignedMassRate, rateTagsFor, type RateTag } from '../hud/format/mass-cues';
import { isZonePillUp, zonePillText, type ZoneEntryMemory } from '../hud/format/zone-pill';
import { MASS_TREND, type MassTrend, type MassTrendMemory } from './mass-trend';

export interface MassChip {
  /** The mass, floored (docs/ui/hud.md §3: masses round down). */
  readonly mass: number;
  readonly trend: MassTrend;
  /** The net rate, mass/s; losses negative. */
  readonly ratePerSecond: number;
  /** `9/s`, unsigned: the trend glyph carries the direction. */
  readonly rateText: string;
}

export interface ZoneCue {
  /** The zone the server's metabolism used this tick. */
  readonly zone: ZoneId;
  /** The zone pill's text while it is up; `null` when it is not (its time is up, a pick is open, or an engulf holds us). */
  readonly pillText: string | null;
}

export interface SprintSpentCue {
  /** The mass the sprint start took, positive. */
  readonly amount: number;
  /** The snapshot tick it arrived with: a floater is spawned once per tick. */
  readonly tick: number;
}

export interface LegibilityCues {
  readonly massChip: MassChip;
  readonly rateTags: readonly RateTag[];
  /** `null` without mass-flow facts (the first snapshot of a new cell). */
  readonly zone: ZoneCue | null;
  readonly sprintSpent: SprintSpentCue | null;
}

export interface LegibilityCuesInput {
  readonly ownCell: CellView;
  readonly ownProgress: OwnProgressView;
  readonly balance: BalanceConfig;
  /** The newest snapshot's tick: the zone pill's clock. */
  readonly tick: number;
  readonly massTrend: MassTrendMemory | null;
  readonly zoneEntry: ZoneEntryMemory | null;
  /** The escape arc is up: the zone pill yields to it. */
  readonly isBeingEngulfed: boolean;
}

const STEADY_RATE = 0;

function massChipOf(input: LegibilityCuesInput): MassChip {
  const trend = input.massTrend?.cellId === input.ownCell.id ? input.massTrend : null;
  const ratePerSecond = trend?.ratePerSecond ?? STEADY_RATE;
  return {
    mass: Math.floor(input.ownCell.mass),
    trend: trend?.trend ?? MASS_TREND.steady,
    ratePerSecond,
    rateText: formatUnsignedMassRate(ratePerSecond),
  };
}

function zoneCueOf(input: LegibilityCuesInput): ZoneCue | null {
  const { ownProgress, ownCell } = input;
  const massFlow = ownProgress.massFlow;
  if (massFlow === null) return null;
  const isUp =
    input.zoneEntry?.cellId === ownCell.id &&
    isZonePillUp(input.zoneEntry, input.tick) &&
    ownProgress.offer === null &&
    !input.isBeingEngulfed;
  const pillText = isUp
    ? zonePillText({ zone: massFlow.zone, mass: ownCell.mass, traits: ownCell.traits, balance: input.balance })
    : null;
  return { zone: massFlow.zone, pillText };
}

export function legibilityCuesFor(input: LegibilityCuesInput): LegibilityCues {
  const { massFlow } = input.ownProgress;
  const sprintSpent = massFlow?.sprintSpent;
  return {
    massChip: massChipOf(input),
    rateTags: rateTagsFor(massFlow, input.ownCell.traits, input.balance),
    zone: zoneCueOf(input),
    sprintSpent: sprintSpent === undefined ? null : { amount: sprintSpent, tick: input.tick },
  };
}
