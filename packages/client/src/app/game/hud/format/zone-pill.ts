// The zone pill (docs/ui/hud.md §3.1.5): what it says and when it is up. The zone is the one the server's metabolism
// used this tick (`massFlow.zone`), so the pill, the zone beat and the VENT tag agree. Shown for `ZONE_PILL_SECONDS`
// on entering a zone other than the open broth; the first alive snapshot of a new own cell counts as an entry, and a
// re-entry within `ZONE_PILL_COOLDOWN_SECONDS` shows nothing. Every number in the text comes from the live balance.
// Pure: the memory is carried from snapshot to snapshot by the caller.

import {
  BACTERIUM_VARIANT,
  ZONE_ID,
  foldModifiers,
  gelSpeedFactor,
  secondsToTicks,
  type BacteriumVariant,
  type BalanceConfig,
  type EntityId,
  type OwnedTrait,
  type ZoneId,
} from '@evolution/shared';
import { MULTIPLIER_SIGN } from '../../quantities/quantity-unit';
import { ZONE_PILL_COOLDOWN_SECONDS, ZONE_PILL_SECONDS } from '../../render/constants';

/** The zones' names, as the pill and the status mirror say them; uppercased by the `label` role when drawn. */
export const ZONE_NAME: Readonly<Record<ZoneId, string>> = {
  [ZONE_ID.warmVent]: 'Warm vent',
  [ZONE_ID.sunlitShallows]: 'Sunlit shallows',
  [ZONE_ID.viscousGel]: 'Viscous gel',
  [ZONE_ID.openBroth]: 'Open broth',
};

/** The rods a zone breeds, named by the colour the player sees them in (principles-and-palette.md §2). */
const ROD_WORDS: Readonly<Partial<Record<BacteriumVariant, string>>> = {
  [BACTERIUM_VARIANT.aerobic]: 'orange rods',
  [BACTERIUM_VARIANT.photosynthetic]: 'green rods',
};

const SEPARATOR = ' · ';
const MULTIPLIER_DECIMALS = 1;

function multiplierText(value: number): string {
  return `${MULTIPLIER_SIGN}${Number(value.toFixed(MULTIPLIER_DECIMALS))}`;
}

/** The coloured variant a zone's rod weights favour; `null` where no coloured rod spawns. */
function rodWordsFor(zone: ZoneId, balance: Pick<BalanceConfig, 'ecology'>): string | null {
  const weights: Readonly<Partial<Record<ZoneId, Readonly<Record<BacteriumVariant, number>>>>> =
    balance.ecology.BACTERIUM_VARIANT_WEIGHTS_BY_ZONE;
  const table = weights[zone];
  if (table === undefined) return null;
  const coloured = Object.keys(ROD_WORDS) as BacteriumVariant[];
  const larger = coloured.reduce((best, variant) => (table[variant] > table[best] ? variant : best));
  return table[larger] > 0 ? (ROD_WORDS[larger] ?? null) : null;
}

export interface ZonePillInput {
  readonly zone: ZoneId;
  readonly mass: number;
  readonly traits: readonly OwnedTrait[];
  readonly balance: Pick<BalanceConfig, 'ecology' | 'growth' | 'traits'>;
}

/** `Warm vent · decay ×1.5 · orange rods`; `null` in the open broth, which has no pill. */
export function zonePillText(input: ZonePillInput): string | null {
  const { zone, balance } = input;
  const parts = [ZONE_NAME[zone]];
  if (zone === ZONE_ID.openBroth) return null;
  if (zone === ZONE_ID.warmVent) parts.push(`decay ${multiplierText(balance.ecology.VENT_DECAY_MULTIPLIER)}`);
  if (zone === ZONE_ID.sunlitShallows) parts.push('light');
  if (zone === ZONE_ID.viscousGel) {
    const floor = foldModifiers(input.traits, balance.traits.TRAIT_TIERS).gelSpeedFactorFloor;
    parts.push(`your speed ${multiplierText(gelSpeedFactor(input.mass, balance.growth, floor))}`);
  }
  const rods = rodWordsFor(zone, balance);
  if (rods !== null) parts.push(rods);
  return parts.join(SEPARATOR);
}

/** One snapshot as the pill's timing reads it. */
export interface ZoneEntrySample {
  readonly cellId: EntityId;
  readonly zone: ZoneId;
  readonly tick: number;
}

export interface ZoneEntryMemory {
  readonly cellId: EntityId;
  readonly zone: ZoneId;
  /** The zone the pill is up for and the tick it comes down at; `null` when none is up. */
  readonly shown: { readonly zone: ZoneId; readonly untilTick: number } | null;
  /** The last entry tick per zone: what a re-entry's cooldown is measured from. */
  readonly lastEntryTick: Readonly<Partial<Record<ZoneId, number>>>;
}

function isEntryCooledDown(memory: ZoneEntryMemory | null, sample: ZoneEntrySample): boolean {
  const last = memory?.lastEntryTick[sample.zone];
  return last === undefined || sample.tick - last >= secondsToTicks(ZONE_PILL_COOLDOWN_SECONDS);
}

/** The memory after `sample`: a new own cell id forgets the cooldowns, so a respawn inside a zone is told. */
export function zoneEntryFor(previous: ZoneEntryMemory | null, sample: ZoneEntrySample): ZoneEntryMemory {
  const carried = previous?.cellId === sample.cellId ? previous : null;
  const isEntry = carried === null || carried.zone !== sample.zone;
  if (!isEntry) return carried;
  const isShown = sample.zone !== ZONE_ID.openBroth && isEntryCooledDown(carried, sample);
  return {
    cellId: sample.cellId,
    zone: sample.zone,
    shown: isShown ? { zone: sample.zone, untilTick: sample.tick + secondsToTicks(ZONE_PILL_SECONDS) } : null,
    lastEntryTick: { ...carried?.lastEntryTick, [sample.zone]: sample.tick },
  };
}

/** Whether the pill is up at `tick`: its time is not up and the cell is still in the zone it was shown for. */
export function isZonePillUp(memory: ZoneEntryMemory | null, tick: number): boolean {
  const shown = memory?.shown ?? null;
  return shown !== null && shown.zone === memory?.zone && tick < shown.untilTick;
}
