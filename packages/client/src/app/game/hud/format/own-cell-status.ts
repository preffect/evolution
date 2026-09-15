// The status mirror's content (docs/ui/hud.md §3.1.4): the `data-*` attributes Playwright reads and
// the sentence assistive technology hears. Pure and DOM-free — the component binds what this
// answers and owns no rule of its own.
//
// The split matters and is the whole design of the mirror. **Attributes** are rewritten every
// snapshot, because a test wants the current value and reading an attribute announces nothing.
// **Text** is rewritten only when something a player would want told about changes, because the
// element is `aria-live="polite"` and a 60 Hz stream of sentences is unusable. `shouldAnnounce`
// is that rule, and it is pinned rather than left to a component's discretion.

import { BACTERIUM_VARIANT, TRAIT_CATALOG, type BacteriumVariant, type OwnedTrait } from '@evolution/shared';
import { ENGULF_PHASE } from '@evolution/shared';
import { formatQuantity } from '../../quantities/format-quantity';
import { MULTIPLIER_SIGN, PERCENT, QUANTITY_ROUNDING, QUANTITY_UNIT } from '../../quantities/quantity-unit';
import { STATUS_ANNOUNCE_DNA_STEP_PERCENT } from '../hud-constants';
import { formatMassFigure } from './mass-cues';
import { READY } from './sprint-fill';
import { MASS_TREND } from '../../state/mass-trend';
import type { LadderCounter, OwnCellIndicators } from '../../state/own-cell-indicators';

/** `data-mass-rate` and `data-mass-causes` carry one decimal (docs/ui/hud.md §3.1.4). */
const MASS_RATE_ATTRIBUTE_DECIMALS = 1;
/** How `×` is spoken: `decay times 1.5`. */
const SPOKEN_MULTIPLIER = 'times ';

/** The sprint ring's three readings, as one word each (docs/ui/hud.md §3.1.4). */
export const SPRINT_STATUS = { ready: 'ready', cooling: 'cooling', sprinting: 'sprinting' } as const;

/** `ghost:<silhouette>`, `counters` or `none`: what the ladder orbit is showing. */
export const LADDER_STATUS_NONE = 'none';
export const LADDER_STATUS_COUNTERS = 'counters';
const LADDER_STATUS_GHOST_PREFIX = 'ghost:';

/**
 * The counters the mirror exposes by name, so a test can read `data-aerobic` without a lookup.
 * `plain` is here only to keep the record total — no trait's `unlockedBy` names it, so no counter
 * is ever built for it and `data-plain` cannot reach the DOM.
 */
export const COUNTER_ATTRIBUTE_BY_VARIANT: Readonly<Record<BacteriumVariant, string>> = {
  [BACTERIUM_VARIANT.plain]: 'data-plain',
  [BACTERIUM_VARIANT.aerobic]: 'data-aerobic',
  [BACTERIUM_VARIANT.photosynthetic]: 'data-photosynthetic',
};

/** Every attribute the mirror carries; an absent value means the attribute is not written at all. */
export interface OwnCellStatusAttributes {
  readonly [attribute: string]: string | null;
}

export interface OwnCellStatus {
  readonly attributes: OwnCellStatusAttributes;
  /** The sentence; only spoken when `shouldAnnounce` says this one differs in a way worth hearing. */
  readonly text: string;
  /** What `shouldAnnounce` compares: the facts a player would want told, not the raw record. */
  readonly announceKey: string;
}

/** `62` from 0.62: floored, so the mirror never claims a percent the ring has not filled. */
export function dnaPercentOf(dnaFraction: number): number {
  return Math.floor(dnaFraction * PERCENT);
}

function sprintStatusOf(indicators: OwnCellIndicators): string {
  if (indicators.isSprinting) return SPRINT_STATUS.sprinting;
  return indicators.sprintFill >= READY ? SPRINT_STATUS.ready : SPRINT_STATUS.cooling;
}

/**
 * The rung ghost names the ladder whenever one shows. A counter beside it (decision #285 B: the
 * envelope ghost and the unclaimed endosymbiont's tally) is read from its own attribute instead.
 */
function ladderStatusOf(indicators: OwnCellIndicators): string {
  const { ghost, counters } = indicators.ladder;
  if (ghost !== null) return `${LADDER_STATUS_GHOST_PREFIX}${ghost.silhouette}`;
  return counters.length > 0 ? LADDER_STATUS_COUNTERS : LADDER_STATUS_NONE;
}

/** The counters on the ladder right now, by variant; a hidden counter has no attribute (§3.1.4). */
function visibleCounters(indicators: OwnCellIndicators): readonly LadderCounter[] {
  return indicators.ladder.counters;
}

/** `nucleoid:1 flagellum:2` in catalog order, so two equal loadouts always read the same. */
export function formatTraits(traits: readonly OwnedTrait[]): string {
  const tierById = new Map(traits.map((owned) => [owned.traitId, owned.tier]));
  return TRAIT_CATALOG.filter((trait) => tierById.has(trait.id))
    .map((trait) => `${trait.id}:${tierById.get(trait.id)}`)
    .join(' ');
}

function counterAttributes(indicators: OwnCellIndicators): OwnCellStatusAttributes {
  const attributes: Record<string, string> = {};
  for (const counter of visibleCounters(indicators)) {
    const name = COUNTER_ATTRIBUTE_BY_VARIANT[counter.variant];
    attributes[name] = `${counter.eaten}/${counter.required}`;
  }
  return attributes;
}

/** The mass cues' attributes (§3.1.4): the trend, the net rate, the shown causes in drawn order, the zone. */
function massCueAttributes(indicators: OwnCellIndicators): OwnCellStatusAttributes {
  const causes = indicators.rateTags.map((tag) => `${tag.cause}:${asciiRate(tag.ratePerSecond)}`).join(' ');
  return {
    'data-mass-trend': indicators.massChip.trend,
    'data-mass-rate': asciiRate(indicators.massChip.ratePerSecond),
    'data-mass-causes': causes === '' ? null : causes,
    'data-zone': indicators.zone?.zone ?? null,
  };
}

/** `-9.4`: one decimal and the ASCII minus, so a test can parse it. */
function asciiRate(ratePerSecond: number): string {
  return ratePerSecond.toFixed(MASS_RATE_ATTRIBUTE_DECIMALS);
}

/** `Shrinking 9.4 a second` / `Growing 3 a second` while the chip shows a trend; `null` when steady. */
function trendTextOf(indicators: OwnCellIndicators): string | null {
  const { trend, ratePerSecond } = indicators.massChip;
  if (trend === MASS_TREND.steady) return null;
  const verb = trend === MASS_TREND.down ? 'Shrinking' : 'Growing';
  return `${verb} ${formatMassFigure(ratePerSecond)} a second`;
}

/** The zone pill's line as speech: `Warm vent · decay times 1.5`; `null` while the pill is down. */
function zoneTextOf(indicators: OwnCellIndicators): string | null {
  const pillText = indicators.zone?.pillText ?? null;
  return pillText === null ? null : pillText.replaceAll(MULTIPLIER_SIGN, SPOKEN_MULTIPLIER);
}

/** The sentence, in the order §3.1.4 sets: level, DNA, the counters, then sprint, then the mass cues. */
function statusTextOf(indicators: OwnCellIndicators): string {
  // Floored like `data-dna-percent`, so the sentence never claims a percent the ring has not filled.
  const dnaText = formatQuantity(indicators.dnaFraction, QUANTITY_UNIT.share, { rounding: QUANTITY_ROUNDING.floor });
  const parts = [formatQuantity(indicators.level, QUANTITY_UNIT.level), `DNA ${dnaText}`];
  for (const counter of visibleCounters(indicators)) {
    const name = `${counter.variant.charAt(0).toUpperCase()}${counter.variant.slice(1)}`;
    parts.push(`${name} ${counter.eaten} of ${counter.required}`);
  }
  if (indicators.escape !== null) {
    parts.push(indicators.escape.phase === ENGULF_PHASE.absorb ? 'Sealed' : 'Engulfed · sprint to escape');
  } else if (indicators.nearestThreat !== null) {
    parts.push(indicators.nearestThreat.label);
  }
  parts.push(`Sprint ${sprintStatusOf(indicators)}`);
  for (const line of [trendTextOf(indicators), zoneTextOf(indicators)]) {
    if (line !== null) parts.push(line);
  }
  return parts.join(' · ');
}

/**
 * What a change has to move before the mirror speaks again (docs/ui/hud.md §3.1.4): the level, the DNA
 * percent **quantised to `STATUS_ANNOUNCE_DNA_STEP_PERCENT`**, each counter, the sprint word, the
 * engulf phase and which cell is the nearest threat. Mass and the raw percent are deliberately
 * absent: they move every snapshot, and announcing them would drown everything worth hearing.
 */
function announceKeyOf(indicators: OwnCellIndicators): string {
  const dnaStep = Math.floor(dnaPercentOf(indicators.dnaFraction) / STATUS_ANNOUNCE_DNA_STEP_PERCENT);
  const counters = visibleCounters(indicators)
    .map((counter) => `${counter.variant}:${counter.eaten}`)
    .join(',');
  return [
    indicators.level,
    dnaStep,
    counters,
    sprintStatusOf(indicators),
    indicators.escape?.phase ?? '',
    // The threat's **identity**, not its presence: the sentence names the predator, so a swap of
    // which one is nearest has to rewrite it. Keying on presence alone leaves `data-threat`
    // pointing at one cell while the spoken line still names another, for as long as any threat
    // is on screen.
    //
    // On chattering, qualified after gameplay-qa pushed back on an earlier flat claim: two
    // *equidistant* predators cannot alternate, because `threatsFor` breaks ties on id for exactly
    // that reason. What can change often is which predator is genuinely nearest, and that is the
    // announce this key is for. Where two of them share a label the re-announce is redundant, and
    // harmless — the rendered sentence is unchanged, so the DOM does not mutate. That holds while
    // the dish is as sparse as it is; #98's wild cells will be the test of it.
    indicators.nearestThreat?.cellId ?? '',
    // The trend word, not the rate (it moves every snapshot), and the zone only while its pill is up: §3.1.4's
    // "when the trend changes" and "the zone's name on entry".
    indicators.massChip.trend,
    indicators.zone?.pillText === null || indicators.zone === null ? '' : indicators.zone.zone,
  ].join('|');
}

/** The mirror's whole content for one snapshot. */
export function formatOwnCellStatus(indicators: OwnCellIndicators): OwnCellStatus {
  return {
    attributes: {
      'data-level': String(indicators.level),
      'data-max-level': String(indicators.isMaxLevel),
      'data-dna-percent': String(dnaPercentOf(indicators.dnaFraction)),
      'data-ladder': ladderStatusOf(indicators),
      'data-sprint': sprintStatusOf(indicators),
      'data-mass': String(Math.round(indicators.mass)),
      'data-traits': formatTraits(indicators.traits),
      'data-engulfed': indicators.escape === null ? null : String(Math.round(indicators.escape.progress * PERCENT)),
      'data-engulf-phase': indicators.escape?.phase ?? null,
      'data-threat': indicators.nearestThreat?.cellId ?? null,
      ...counterAttributes(indicators),
      ...massCueAttributes(indicators),
    },
    text: statusTextOf(indicators),
    announceKey: announceKeyOf(indicators),
  };
}

/** Whether this snapshot's status is worth speaking, given what was last spoken. */
export function shouldAnnounce(previousAnnounceKey: string | null, status: OwnCellStatus): boolean {
  return previousAnnounceKey !== status.announceKey;
}
